"""
emotion.py  —  backend/app/routes/emotion.py

Endpoints:
  POST /emotion/detect        → accepts base64 frame, runs deepface, returns emotion + strike state
  POST /emotion/update        → frontend reports its own emotion state (client-side detection fallback)
  POST /emotion/clear         → student left the video page
  GET  /emotion/admin/live    → admin polls for all active student sessions

In-memory session store (resets on server restart).
For production, swap _sessions for Redis.

Install requirement:
  pip install deepface opencv-python-headless tf-keras
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from datetime import datetime, timezone
import base64
import io
import numpy as np

emotion_bp = Blueprint('emotion', __name__)

# ── Constants ─────────────────────────────────────────────────────────────────
MAX_STRIKES    = 3
ENGAGED        = {'happy', 'neutral'}          # these reset / don't add strikes
STALE_SECONDS  = 30                            # prune sessions idle > 30 s

# ── In-memory session store ───────────────────────────────────────────────────
# _sessions[user_id] = {
#     user_id, username, full_name,
#     course_id, course_title,
#     emotion, strikes, slow_mode,
#     updated_at (ISO str)
# }
_sessions: dict = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_user_or_404(user_id: int):
    user = User.query.get(user_id)
    if not user:
        return None, jsonify({'error': 'User not found'}), 404
    return user, None, None


def _apply_emotion_logic(user_id: int, emotion: str) -> dict:
    """
    Core strike logic — shared between /detect and /update.
    Returns updated session dict.
    """
    sess = _sessions.get(user_id, {
        'strikes': 0,
        'slow_mode': False,
    })

    if emotion in ENGAGED:
        # Positive emotion → reset strikes, return to normal
        sess['strikes'] = 0
        sess['slow_mode'] = False
    else:
        # Negative / unknown → add strike
        new_strikes = min(sess.get('strikes', 0) + 1, MAX_STRIKES)
        sess['strikes'] = new_strikes
        if new_strikes >= MAX_STRIKES:
            sess['slow_mode'] = True

    sess['emotion'] = emotion
    sess['updated_at'] = _now()
    return sess


# ── /emotion/detect  (API-based frame processing) ─────────────────────────────
@emotion_bp.route('/detect', methods=['POST'])
@jwt_required()
def detect():
    """
    Accepts a base64-encoded webcam frame.
    Runs DeepFace emotion analysis.
    Updates the session store with the result.
    Returns: { emotion, strikes, slow_mode, confidence }

    Body (JSON):
      {
        "frame":       "<base64 JPEG/PNG string>",  // required
        "course_id":    123,                          // optional
        "course_title": "My Course"                  // optional
      }
    """
    user_id = int(get_jwt_identity())
    user, err, code = _get_user_or_404(user_id)
    if err:
        return err, code

    data   = request.get_json(silent=True) or {}
    frame_b64 = data.get('frame', '')

    emotion    = 'unknown'
    confidence = 0.0

    if frame_b64:
        try:
            # ── Decode base64 → numpy image ──────────────────────────────────
            import cv2
            from deepface import DeepFace

            # Strip data-URL prefix if present ("data:image/jpeg;base64,...")
            if ',' in frame_b64:
                frame_b64 = frame_b64.split(',', 1)[1]

            img_bytes = base64.b64decode(frame_b64)
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)
            img_bgr   = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

            if img_bgr is not None:
                # ── Run DeepFace ─────────────────────────────────────────────
                result = DeepFace.analyze(
                    img_path=img_bgr,
                    actions=['emotion'],
                    enforce_detection=False,   # don't crash if no face found
                    silent=True,
                )

                # result can be a list or a dict depending on DeepFace version
                if isinstance(result, list):
                    result = result[0]

                dominant = result.get('dominant_emotion', 'unknown')
                emotions = result.get('emotion', {})

                emotion    = dominant.lower()
                confidence = round(emotions.get(dominant, 0.0) / 100, 3)

        except ImportError:
            # deepface / cv2 not installed → fall back gracefully
            emotion = 'unknown'
        except Exception as exc:
            # Face not found, blurry frame, etc. → treat as unknown
            emotion = 'unknown'

    # ── Apply strike logic ────────────────────────────────────────────────────
    sess = _apply_emotion_logic(user_id, emotion)
    sess.update({
        'user_id':      user_id,
        'username':     user.username,
        'full_name':    user.full_name or user.username,
        'course_id':    data.get('course_id'),
        'course_title': data.get('course_title', ''),
    })
    _sessions[user_id] = sess

    return jsonify({
        'emotion':    emotion,
        'confidence': confidence,
        'strikes':    sess['strikes'],
        'slow_mode':  sess['slow_mode'],
    }), 200


# ── /emotion/update  (client-side detection fallback) ────────────────────────
@emotion_bp.route('/update', methods=['POST'])
@jwt_required()
def update_emotion():
    """
    Called by the frontend every ~4 s when using client-side (face-api.js)
    detection instead of sending raw frames to /detect.

    Body: { emotion, course_id, course_title, strikes, slow_mode }
    The frontend computes strikes itself; we just store the state for the
    admin dashboard.
    """
    user_id = int(get_jwt_identity())
    user, err, code = _get_user_or_404(user_id)
    if err:
        return err, code

    data = request.get_json(silent=True) or {}

    _sessions[user_id] = {
        'user_id':      user_id,
        'username':     user.username,
        'full_name':    user.full_name or user.username,
        'course_id':    data.get('course_id'),
        'course_title': data.get('course_title', ''),
        'emotion':      data.get('emotion', 'unknown'),
        'strikes':      int(data.get('strikes', 0)),
        'slow_mode':    bool(data.get('slow_mode', False)),
        'updated_at':   _now(),
    }
    return jsonify({'ok': True}), 200


# ── /emotion/clear ────────────────────────────────────────────────────────────
@emotion_bp.route('/clear', methods=['POST'])
@jwt_required()
def clear_session():
    """Called when the student leaves the video page."""
    user_id = int(get_jwt_identity())
    _sessions.pop(user_id, None)
    return jsonify({'ok': True}), 200


# ── /emotion/admin/live  (admin dashboard polling) ───────────────────────────
@emotion_bp.route('/admin/live', methods=['GET'])
@jwt_required()
def admin_live():
    """
    Returns all currently-active student emotion sessions.
    Admin polls this every 3 s from the Admin Dashboard.
    Restricted to admin role only.
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403

    now    = datetime.now(timezone.utc)
    active = []

    for uid, sess in list(_sessions.items()):
        try:
            updated = datetime.fromisoformat(sess['updated_at'])
            age     = (now - updated).total_seconds()
            if age <= STALE_SECONDS:
                active.append(sess)
            else:
                _sessions.pop(uid, None)   # prune stale session
        except Exception:
            active.append(sess)            # keep if timestamp unparseable

    return jsonify({'sessions': active, 'total': len(active)}), 200