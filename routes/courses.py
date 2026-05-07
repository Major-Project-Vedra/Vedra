import os
import uuid
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from app import db
from app.models.user import User
from app.models.course import Course, Lesson

courses_bp = Blueprint('courses', __name__)

ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'}
MAX_VIDEO_SIZE_MB = 500


def allowed_video(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_VIDEO_EXTENSIONS


def require_admin():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return None, jsonify({'error': 'Admin access required'}), 403
    return user, None, None


@courses_bp.route('/upload-video', methods=['POST'])
@jwt_required()
def upload_video():
    result = require_admin()
    if result[1]:
        return result[1], result[2]

    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided'}), 400

    file = request.files['video']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_video(file.filename):
        return jsonify({'error': f'Unsupported type. Allowed: {", ".join(ALLOWED_VIDEO_EXTENSIONS)}'}), 400

    content_length = request.content_length
    if content_length and content_length > MAX_VIDEO_SIZE_MB * 1024 * 1024:
        return jsonify({'error': f'File too large. Max size is {MAX_VIDEO_SIZE_MB} MB'}), 413

    ext = file.filename.rsplit('.', 1)[1].lower()
    safe_name = secure_filename(f"{uuid.uuid4().hex}.{ext}")

    videos_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'videos')
    os.makedirs(videos_dir, exist_ok=True)
    file.save(os.path.join(videos_dir, safe_name))

    host = request.host_url.rstrip('/')
    return jsonify({
        'video_url': f"{host}/courses/videos/{safe_name}",
        'filename': safe_name,
        'original_name': file.filename,
    }), 201


@courses_bp.route('/videos/<path:filename>', methods=['GET'])
def serve_video(filename):
    videos_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'videos')
    return send_from_directory(videos_dir, filename)


@courses_bp.route('/', methods=['GET'])
def get_courses():
    category = request.args.get('category')
    difficulty = request.args.get('difficulty')
    search = request.args.get('search', '')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 12))

    query = Course.query.filter_by(is_published=True)
    if category:
        query = query.filter_by(category=category)
    if difficulty:
        query = query.filter_by(difficulty=difficulty)
    if search:
        query = query.filter(Course.title.ilike(f'%{search}%'))

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'courses': [c.to_dict() for c in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages,
        'page': page,
    }), 200


@courses_bp.route('/<int:course_id>', methods=['GET'])
def get_course(course_id):
    course = Course.query.get_or_404(course_id)
    return jsonify(course.to_dict(include_lessons=True)), 200


@courses_bp.route('/', methods=['POST'])
@jwt_required()
def create_course():
    result = require_admin()
    if result[1]:
        return result[1], result[2]

    data = request.get_json()
    course = Course(
        title=data['title'],
        description=data.get('description', ''),
        category=data.get('category', ''),
        difficulty=data.get('difficulty', 'beginner'),
        thumbnail=data.get('thumbnail', ''),
        video_url=data.get('video_url', ''),
        slow_video_url=data.get('slow_video_url', ''),
        duration=data.get('duration', 0),
        instructor=data.get('instructor', ''),
        xp_reward=data.get('xp_reward', 100),
        is_published=data.get('is_published', True),
    )
    db.session.add(course)
    db.session.commit()
    return jsonify(course.to_dict()), 201


@courses_bp.route('/<int:course_id>', methods=['PUT'])
@jwt_required()
def update_course(course_id):
    result = require_admin()
    if result[1]:
        return result[1], result[2]

    course = Course.query.get_or_404(course_id)
    data = request.get_json()
    for field in ['title', 'description', 'category', 'difficulty', 'thumbnail',
                  'video_url', 'slow_video_url', 'duration', 'instructor',
                  'xp_reward', 'is_published']:
        if field in data:
            setattr(course, field, data[field])
    db.session.commit()
    return jsonify(course.to_dict()), 200


@courses_bp.route('/<int:course_id>', methods=['DELETE'])
@jwt_required()
def delete_course(course_id):
    result = require_admin()
    if result[1]:
        return result[1], result[2]

    course = Course.query.get_or_404(course_id)

    from app.models.enrollment import Enrollment, LessonProgress
    from app.models.quiz import QuizAttempt

    for lesson in course.lessons:
        LessonProgress.query.filter_by(lesson_id=lesson.id).delete()
    Enrollment.query.filter_by(course_id=course_id).delete()

    for quiz in course.quizzes:
        QuizAttempt.query.filter_by(quiz_id=quiz.id).delete()

    db.session.delete(course)
    db.session.commit()
    return jsonify({'message': 'Course deleted'}), 200


@courses_bp.route('/<int:course_id>/lessons', methods=['POST'])
@jwt_required()
def add_lesson(course_id):
    result = require_admin()
    if result[1]:
        return result[1], result[2]

    course = Course.query.get_or_404(course_id)
    data = request.get_json()
    lesson = Lesson(
        course_id=course.id,
        title=data['title'],
        content=data.get('content', ''),
        video_url=data.get('video_url', ''),
        order=data.get('order', 0),
        duration=data.get('duration', 0),
        xp_reward=data.get('xp_reward', 20),
    )
    db.session.add(lesson)
    db.session.commit()
    return jsonify(lesson.to_dict()), 201


@courses_bp.route('/categories', methods=['GET'])
def get_categories():
    cats = db.session.query(Course.category).distinct().all()
    return jsonify([c[0] for c in cats if c[0]]), 200