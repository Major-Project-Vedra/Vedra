from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.gamification import Badge, UserBadge
from app.models.user import User

gamify_bp = Blueprint('gamify', __name__)


def check_and_award_badges(user):
    """
    Check all badge conditions for the user and award any newly earned badges.
    Returns list of newly awarded badge dicts.
    """
    from app.models.enrollment import Enrollment
    from app.models.quiz import QuizAttempt

    all_badges = Badge.query.all()
    already_earned = {ub.badge_id for ub in UserBadge.query.filter_by(user_id=user.id).all()}
    newly_awarded = []

    completed_courses = Enrollment.query.filter_by(user_id=user.id, completed=True).count()
    best_quiz = db.session.query(db.func.max(QuizAttempt.score)).filter_by(user_id=user.id).scalar() or 0
    quiz_passed = QuizAttempt.query.filter_by(user_id=user.id, passed=True).count()

    for badge in all_badges:
        if badge.id in already_earned:
            continue

        earned = False
        ct = badge.condition_type
        cv = badge.condition_value

        if ct == 'xp' and user.xp >= cv:
            earned = True
        elif ct == 'level' and user.level >= cv:
            earned = True
        elif ct == 'courses_completed' and completed_courses >= cv:
            earned = True
        elif ct == 'quiz_score' and best_quiz >= cv:
            earned = True
        elif ct == 'quiz_passed' and quiz_passed >= cv:
            earned = True

        if earned:
            ub = UserBadge(user_id=user.id, badge_id=badge.id)
            db.session.add(ub)
            newly_awarded.append(badge.to_dict())

    return newly_awarded


@gamify_bp.route('/badges', methods=['GET'])
def get_all_badges():
    badges = Badge.query.all()
    return jsonify([b.to_dict() for b in badges]), 200


@gamify_bp.route('/my-badges', methods=['GET'])
@jwt_required()
def my_badges():
    user_id = int(get_jwt_identity())
    user_badges = UserBadge.query.filter_by(user_id=user_id).all()
    return jsonify([ub.to_dict() for ub in user_badges]), 200


@gamify_bp.route('/xp', methods=['GET'])
@jwt_required()
def get_xp():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    return jsonify({
        'xp': user.xp,
        'level': user.level,
        'xp_for_next_level': user.xp_for_next_level(),
        'xp_percent': min(100, int(user.xp / user.xp_for_next_level() * 100)),
        'streak': user.streak,
    }), 200


@gamify_bp.route('/badges', methods=['POST'])
@jwt_required()
def create_badge():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403

    data = request.get_json()
    badge = Badge(
        name=data['name'],
        description=data.get('description', ''),
        icon=data.get('icon', '🏆'),
        condition_type=data.get('condition_type', 'xp'),
        condition_value=data.get('condition_value', 0),
        xp_reward=data.get('xp_reward', 50),
    )
    db.session.add(badge)
    db.session.commit()
    return jsonify(badge.to_dict()), 201


@gamify_bp.route('/seed-badges', methods=['POST'])
@jwt_required()
def seed_badges():
    """Seed all default badges. Admin only."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403

    DEFAULT_BADGES = [
        # ── XP / Level badges ─────────────────────────────────────────────
        {'name': 'First Steps',       'description': 'Earn your first 100 XP',       'icon': '👣', 'condition_type': 'xp',               'condition_value': 100,  'xp_reward': 0},
        {'name': 'Getting Started',   'description': 'Reach 250 XP',                 'icon': '🌱', 'condition_type': 'xp',               'condition_value': 250,  'xp_reward': 0},
        {'name': 'Level 5',           'description': 'Reach Level 5',                'icon': '⭐', 'condition_type': 'level',             'condition_value': 5,    'xp_reward': 100},
        {'name': 'Level 10',          'description': 'Reach Level 10',               'icon': '🌟', 'condition_type': 'level',             'condition_value': 10,   'xp_reward': 200},
        {'name': 'Level 20',          'description': 'Reach Level 20',               'icon': '💫', 'condition_type': 'level',             'condition_value': 20,   'xp_reward': 300},
        {'name': 'Level 30',          'description': 'Reach Level 30',               'icon': '🔥', 'condition_type': 'level',             'condition_value': 30,   'xp_reward': 500},
        {'name': 'Level 40',          'description': 'Reach Level 40',               'icon': '💎', 'condition_type': 'level',             'condition_value': 40,   'xp_reward': 750},
        {'name': 'Level 50',          'description': 'Reach Level 50 — Legend!',     'icon': '👑', 'condition_type': 'level',             'condition_value': 50,   'xp_reward': 1000},
        # ── Course / Quiz achievement badges ──────────────────────────────
        {'name': 'Quiz Debut',        'description': 'Pass your first quiz',          'icon': '🎯', 'condition_type': 'quiz_passed',       'condition_value': 1,    'xp_reward': 50},
        {'name': 'Quiz Master',       'description': 'Pass 5 quizzes',               'icon': '🧠', 'condition_type': 'quiz_passed',       'condition_value': 5,    'xp_reward': 100},
        {'name': 'Perfect Score',     'description': 'Score 100% on a quiz',         'icon': '💯', 'condition_type': 'quiz_score',        'condition_value': 100,  'xp_reward': 150},
        {'name': 'Graduate',          'description': 'Complete your first course',   'icon': '🎓', 'condition_type': 'courses_completed', 'condition_value': 1,    'xp_reward': 100},
        {'name': 'Scholar',           'description': 'Complete 3 courses',           'icon': '📚', 'condition_type': 'courses_completed', 'condition_value': 3,    'xp_reward': 200},
        {'name': 'Academic',          'description': 'Complete 10 courses',          'icon': '🏫', 'condition_type': 'courses_completed', 'condition_value': 10,   'xp_reward': 500},
    ]

    added = 0
    for b in DEFAULT_BADGES:
        exists = Badge.query.filter_by(name=b['name']).first()
        if not exists:
            badge = Badge(**b)
            db.session.add(badge)
            added += 1

    db.session.commit()
    return jsonify({'message': f'Seeded {added} badges', 'total': Badge.query.count()}), 200