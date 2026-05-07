from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.course import Course
from app.models.enrollment import Enrollment

admin_bp = Blueprint('admin', __name__)


def require_admin():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return None, jsonify({'error': 'Admin access required'}), 403
    return user, None, None


@admin_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def dashboard():
    result = require_admin()
    if result[1]:
        return result[1], result[2]

    total_users = User.query.count()
    total_courses = Course.query.count()
    total_enrollments = Enrollment.query.count()
    completed = Enrollment.query.filter_by(completed=True).count()
    active_users = User.query.filter_by(is_active=True).count()

    recent_users = User.query.order_by(User.created_at.desc()).limit(5).all()
    recent_enrollments = Enrollment.query.order_by(Enrollment.enrolled_at.desc()).limit(10).all()

    return jsonify({
        'stats': {
            'total_users': total_users,
            'active_users': active_users,
            'total_courses': total_courses,
            'total_enrollments': total_enrollments,
            'completed_enrollments': completed,
            'completion_rate': round((completed / total_enrollments * 100), 1) if total_enrollments > 0 else 0,
        },
        'recent_users': [u.to_dict() for u in recent_users],
        'recent_enrollments': [{**e.to_dict(), 'course_title': e.course.title} for e in recent_enrollments],
    }), 200


@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def list_users():
    result = require_admin()
    if result[1]:
        return result[1], result[2]

    page = int(request.args.get('page', 1))
    users = User.query.paginate(page=page, per_page=20, error_out=False)
    return jsonify({
        'users': [u.to_dict() for u in users.items],
        'total': users.total,
        'pages': users.pages,
    }), 200


@admin_bp.route('/users/<int:user_id>/toggle', methods=['PUT'])
@jwt_required()
def toggle_user(user_id):
    result = require_admin()
    if result[1]:
        return result[1], result[2]

    user = User.query.get_or_404(user_id)
    user.is_active = not user.is_active
    db.session.commit()
    return jsonify(user.to_dict()), 200
