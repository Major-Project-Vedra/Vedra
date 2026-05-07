from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.enrollment import Enrollment
from app.models.quiz import QuizAttempt

progress_bp = Blueprint('progress', __name__)


@progress_bp.route('/analytics', methods=['GET'])
@jwt_required()
def analytics():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)

    enrollments = Enrollment.query.filter_by(user_id=user_id).all()
    completed_courses = [e for e in enrollments if e.completed]
    quiz_attempts = QuizAttempt.query.filter_by(user_id=user_id).all()
    passed_quizzes = [q for q in quiz_attempts if q.passed]

    return jsonify({
        'user': user.to_dict(),
        'total_enrolled': len(enrollments),
        'completed_courses': len(completed_courses),
        'total_xp': user.xp,
        'level': user.level,
        'streak': user.streak,
        'quizzes_taken': len(quiz_attempts),
        'quizzes_passed': len(passed_quizzes),
        'avg_quiz_score': sum(q.score for q in quiz_attempts) / len(quiz_attempts) if quiz_attempts else 0,
        'course_progress': [
            {
                'course_id': e.course_id,
                'course_title': e.course.title,
                'progress': e.progress_percent,
                'completed': e.completed,
            } for e in enrollments
        ],
    }), 200


@progress_bp.route('/leaderboard', methods=['GET'])
def leaderboard():
    users = User.query.filter_by(is_active=True).order_by(
        User.level.desc(), User.xp.desc()
    ).limit(20).all()
    return jsonify([{
        'rank': i + 1,
        'id': u.id,
        'username': u.username,
        'full_name': u.full_name,
        'avatar': u.avatar,
        'xp': u.xp,
        'level': u.level,
        'streak': u.streak,
    } for i, u in enumerate(users)]), 200


@progress_bp.route('/leaderboard-quiz', methods=['GET'])
def leaderboard_quiz():
    """Return quiz performance stats keyed by user_id for the leaderboard."""
    users = User.query.filter_by(is_active=True).all()
    result = {}
    for u in users:
        attempts = QuizAttempt.query.filter_by(user_id=u.id).all()
        if not attempts:
            result[u.id] = {'quizzes_taken': 0, 'avg_score': None, 'best_score': None, 'passed': 0}
        else:
            scores = [a.score for a in attempts]
            result[u.id] = {
                'quizzes_taken': len(attempts),
                'avg_score': sum(scores) / len(scores),
                'best_score': max(scores),
                'passed': sum(1 for a in attempts if a.passed),
            }
    return jsonify(result), 200


@progress_bp.route('/reports', methods=['GET'])
@jwt_required()
def reports():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    total_users = User.query.count()
    total_courses = db.session.execute(db.text('SELECT COUNT(*) FROM courses')).scalar()
    total_enrollments = Enrollment.query.count()
    completed = Enrollment.query.filter_by(completed=True).count()

    return jsonify({
        'total_users': total_users,
        'total_courses': total_courses,
        'total_enrollments': total_enrollments,
        'completed_enrollments': completed,
        'completion_rate': (completed / total_enrollments * 100) if total_enrollments > 0 else 0,
    }), 200