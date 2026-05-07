from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.enrollment import Enrollment, LessonProgress
from app.models.course import Course, Lesson
from app.models.user import User
from datetime import datetime

enrollment_bp = Blueprint('enrollment', __name__)


@enrollment_bp.route('/', methods=['POST'])
@jwt_required()
def enroll():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    course_id = data.get('course_id')

    course = Course.query.get_or_404(course_id)
    existing = Enrollment.query.filter_by(user_id=user_id, course_id=course_id).first()
    if existing:
        return jsonify({'error': 'Already enrolled'}), 409

    enrollment = Enrollment(user_id=user_id, course_id=course_id)
    db.session.add(enrollment)
    db.session.commit()
    return jsonify(enrollment.to_dict()), 201


@enrollment_bp.route('/<int:course_id>', methods=['DELETE'])
@jwt_required()
def unenroll(course_id):
    user_id = int(get_jwt_identity())
    enrollment = Enrollment.query.filter_by(user_id=user_id, course_id=course_id).first_or_404()
    db.session.delete(enrollment)
    db.session.commit()
    return jsonify({'message': 'Unenrolled successfully'}), 200


@enrollment_bp.route('/my', methods=['GET'])
@jwt_required()
def my_enrollments():
    user_id = int(get_jwt_identity())
    enrollments = Enrollment.query.filter_by(user_id=user_id).all()
    result = []
    for e in enrollments:
        d = e.to_dict()
        d['course'] = e.course.to_dict()
        # Include completed lesson ids so frontend knows which are done
        completed_lesson_ids = [
            lp.lesson_id for lp in
            LessonProgress.query.filter_by(user_id=user_id, completed=True).all()
        ]
        d['completed_lesson_ids'] = completed_lesson_ids
        result.append(d)
    return jsonify(result), 200


@enrollment_bp.route('/check/<int:course_id>', methods=['GET'])
@jwt_required()
def check_enrollment(course_id):
    user_id = int(get_jwt_identity())
    enrollment = Enrollment.query.filter_by(user_id=user_id, course_id=course_id).first()
    return jsonify({'enrolled': enrollment is not None}), 200


@enrollment_bp.route('/lesson/<int:lesson_id>/complete', methods=['POST'])
@jwt_required()
def complete_lesson(lesson_id):
    user_id = int(get_jwt_identity())
    lesson = Lesson.query.get_or_404(lesson_id)

    existing = LessonProgress.query.filter_by(user_id=user_id, lesson_id=lesson_id).first()
    if existing and existing.completed:
        return jsonify({'message': 'Already completed', 'xp_earned': 0}), 200

    if not existing:
        lp = LessonProgress(user_id=user_id, lesson_id=lesson_id, completed=True, completed_at=datetime.utcnow())
        db.session.add(lp)
    else:
        existing.completed = True
        existing.completed_at = datetime.utcnow()

    # Award XP
    user = User.query.get(user_id)
    user.xp += lesson.xp_reward
    user.update_level()

    # Update enrollment progress based on lessons completed
    enrollment = Enrollment.query.filter_by(user_id=user_id, course_id=lesson.course_id).first()
    if enrollment:
        total_lessons = len(lesson.course.lessons)
        completed_count = LessonProgress.query.filter_by(user_id=user_id, completed=True).join(
            Lesson, Lesson.id == LessonProgress.lesson_id
        ).filter(Lesson.course_id == lesson.course_id).count()

        enrollment.progress_percent = (completed_count / total_lessons * 100) if total_lessons > 0 else 0

        if enrollment.progress_percent >= 100:
            enrollment.completed = True
            enrollment.completed_at = datetime.utcnow()
            user.xp += lesson.course.xp_reward

    from app.routes.gamify import check_and_award_badges
    newly = check_and_award_badges(user)
    db.session.commit()
    return jsonify({'message': 'Lesson completed', 'xp_earned': lesson.xp_reward, 'user': user.to_dict(), 'newly_awarded': newly}), 200


@enrollment_bp.route('/retake/<int:course_id>', methods=['POST'])
@jwt_required()
def retake_course(course_id):
    """
    Reset a completed (or in-progress) enrollment so the student can retake the course.
    - Clears progress_percent back to 0
    - Marks completed = False / completed_at = None
    - Deletes all LessonProgress rows for this course's lessons
    XP already earned is NOT deducted (it was earned fairly).
    """
    user_id = int(get_jwt_identity())

    enrollment = Enrollment.query.filter_by(user_id=user_id, course_id=course_id).first_or_404()

    # Reset enrollment
    enrollment.progress_percent = 0
    enrollment.completed = False
    enrollment.completed_at = None

    # Delete lesson progress for this course so lessons show as incomplete
    lesson_ids = [l.id for l in enrollment.course.lessons]
    if lesson_ids:
        LessonProgress.query.filter(
            LessonProgress.user_id == user_id,
            LessonProgress.lesson_id.in_(lesson_ids)
        ).delete(synchronize_session=False)

    db.session.commit()
    return jsonify({'message': 'Course reset for retake', 'enrollment': enrollment.to_dict()}), 200


@enrollment_bp.route('/video-progress', methods=['POST'])
@jwt_required()
def update_video_progress():
    """
    Called by the frontend every ~10 s while the video is playing.
    Updates progress_percent on the enrollment based on how much of the
    video the student has watched.

    For courses WITH lessons  → progress is still driven by lesson completion;
                                 this endpoint becomes a no-op so we don't
                                 regress lesson-based progress.
    For courses WITHOUT lessons → video watch-time is the only progress signal,
                                   so we update progress_percent here.

    Body: { course_id, watched_seconds, total_seconds }
    """
    user_id = int(get_jwt_identity())
    data = request.get_json()

    course_id      = data.get('course_id')
    watched_sec    = float(data.get('watched_seconds', 0))
    total_sec      = float(data.get('total_seconds', 0))

    if not course_id or total_sec <= 0:
        return jsonify({'error': 'course_id and total_seconds are required'}), 400

    enrollment = Enrollment.query.filter_by(user_id=user_id, course_id=course_id).first()
    if not enrollment:
        return jsonify({'error': 'Not enrolled'}), 404

    course = Course.query.get_or_404(course_id)
    has_lessons = len(course.lessons) > 0

    user = User.query.get(user_id)

    if not has_lessons:
        # Video-only course — track watch progress
        video_percent = min(100.0, round((watched_sec / total_sec) * 100, 1))

        # Only move forward — never decrease progress
        if video_percent > enrollment.progress_percent:
            enrollment.progress_percent = video_percent

            # Mark complete when ≥ 95 % watched (buffer for skipping end credits etc.)
            if video_percent >= 95 and not enrollment.completed:
                enrollment.completed = True
                enrollment.completed_at = datetime.utcnow()
                # Award course XP on video completion
                user.xp += course.xp_reward
                user.update_level()
                from app.routes.gamify import check_and_award_badges
                newly = check_and_award_badges(user)
                db.session.commit()
                return jsonify({
                    'progress_percent': enrollment.progress_percent,
                    'completed': True,
                    'xp_earned': course.xp_reward,
                    'message': 'Course completed!',
                    'user': user.to_dict(),
                    'newly_awarded': newly,
                }), 200

        db.session.commit()

    # Always return user so frontend can keep XP in sync
    return jsonify({
        'progress_percent': enrollment.progress_percent,
        'completed': enrollment.completed,
        'xp_earned': 0,
        'user': user.to_dict(),
    }), 200