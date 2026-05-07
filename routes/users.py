from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User

users_bp = Blueprint('users', __name__)


@users_bp.route('/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict()), 200


@users_bp.route('/students', methods=['GET'])
@jwt_required()
def get_students():
    current_id = int(get_jwt_identity())
    current_user = User.query.get(current_id)
    if current_user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403
    students = User.query.filter_by(role='student').all()
    return jsonify([u.to_dict() for u in students]), 200


@users_bp.route('/admins', methods=['GET'])
@jwt_required()
def get_admins():
    current_id = int(get_jwt_identity())
    current_user = User.query.get(current_id)
    if current_user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403
    admins = User.query.filter_by(role='admin').all()
    return jsonify([u.to_dict() for u in admins]), 200
