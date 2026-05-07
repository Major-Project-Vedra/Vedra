import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from app import db
from app.models.user import User
from datetime import datetime


auth_bp = Blueprint('auth', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_avatar_dir():
    """Always returns the avatar directory path, creating it if needed."""
    avatar_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'avatars')
    os.makedirs(avatar_dir, exist_ok=True)
    return avatar_dir


def delete_avatar_file(avatar_path):
    """Safely deletes an uploaded avatar file. Does nothing for external URLs."""
    if not avatar_path:
        return
    if not avatar_path.startswith('/uploads/avatars/'):
        return  # external URL — don't touch
    try:
        filename = avatar_path.split('/')[-1]
        full_path = os.path.join(get_avatar_dir(), filename)
        if os.path.exists(full_path):
            os.remove(full_path)
    except Exception as e:
        current_app.logger.warning(f'Could not delete avatar file: {e}')


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    required = ['username', 'email', 'password']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already taken'}), 409

    user = User(
        username=data['username'],
        email=data['email'],
        password_hash=generate_password_hash(data['password']),
        full_name=data.get('full_name', data['username']),
        role='student'
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'user': user.to_dict()}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid credentials'}), 401

    if not user.is_active:
        return jsonify({'error': 'Account deactivated'}), 403

    user.last_active = datetime.utcnow()
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'user': user.to_dict()}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict()), 200


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    data = request.get_json()

    if 'full_name' in data:
        user.full_name = data['full_name']
    if 'bio' in data:
        user.bio = data['bio']
    if 'avatar' in data:
        user.avatar = data['avatar']
    if 'password' in data and data['password']:
        user.password_hash = generate_password_hash(data['password'])

    db.session.commit()
    return jsonify(user.to_dict()), 200


# ── POST /auth/avatar ─────────────────────────────────────────────────────────
@auth_bp.route('/avatar', methods=['POST'])
@jwt_required()
def upload_avatar():
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get_or_404(user_id)

        if 'avatar' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['avatar']
        if not file or file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed. Use PNG, JPG, GIF or WEBP'}), 400

        # Enforce 5 MB limit
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
        if size > 5 * 1024 * 1024:
            return jsonify({'error': 'File too large. Max 5 MB'}), 400

        # Build unique filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"avatar_{user_id}_{uuid.uuid4().hex[:8]}.{ext}"

        # Ensure directory exists and save
        avatar_dir = get_avatar_dir()
        file.save(os.path.join(avatar_dir, filename))

        # Clean up old avatar file AFTER new one is saved successfully
        old_avatar = user.avatar  # capture before overwriting
        avatar_url = f'/uploads/avatars/{filename}'
        user.avatar = avatar_url
        db.session.commit()

        # Delete old file now that DB is updated
        delete_avatar_file(old_avatar)

        return jsonify({'avatar_url': avatar_url, 'user': user.to_dict()}), 200

    except Exception as e:
        current_app.logger.error(f'Avatar upload error: {e}')
        return jsonify({'error': 'Server error during upload'}), 500


# ── DELETE /auth/avatar ───────────────────────────────────────────────────────
@auth_bp.route('/avatar', methods=['DELETE'])
@jwt_required()
def remove_avatar():
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get_or_404(user_id)

        if not user.avatar:
            return jsonify({'error': 'No avatar to remove'}), 400

        old_avatar = user.avatar  # capture before clearing
        user.avatar = None
        db.session.commit()

        # Delete file after DB is updated
        delete_avatar_file(old_avatar)

        return jsonify({'message': 'Avatar removed', 'user': user.to_dict()}), 200

    except Exception as e:
        current_app.logger.error(f'Avatar remove error: {e}')
        return jsonify({'error': 'Server error during removal'}), 500


@auth_bp.route('/role-control', methods=['PUT'])
@jwt_required()
def role_control():
    """Admin only: change user role."""
    admin_id = int(get_jwt_identity())
    admin = User.query.get_or_404(admin_id)
    if admin.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    user = User.query.get_or_404(data['user_id'])
    user.role = data['role']
    db.session.commit()
    return jsonify(user.to_dict()), 200