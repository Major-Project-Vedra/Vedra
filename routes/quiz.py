from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.quiz import Quiz, Question, QuizAttempt
from app.models.user import User
import json

quiz_bp = Blueprint('quiz', __name__)


@quiz_bp.route('/all', methods=['GET'])
@jwt_required()
def get_all_quizzes():
    """Admin: list all quizzes with their questions."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403
    quizzes = Quiz.query.all()
    return jsonify([q.to_dict(include_questions=True) for q in quizzes]), 200


@quiz_bp.route('/my-attempts', methods=['GET'])
@jwt_required()
def my_attempts():
    """Student: return all quiz attempts for the current user."""
    user_id = int(get_jwt_identity())
    attempts = QuizAttempt.query.filter_by(user_id=user_id).order_by(QuizAttempt.attempted_at.desc()).all()
    return jsonify([a.to_dict() for a in attempts]), 200


@quiz_bp.route('/<int:quiz_id>', methods=['GET'])
@jwt_required()
def get_quiz(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    return jsonify(quiz.to_dict(include_questions=True)), 200


@quiz_bp.route('/<int:quiz_id>/submit', methods=['POST'])
@jwt_required()
def submit_quiz(quiz_id):
    user_id = int(get_jwt_identity())
    quiz = Quiz.query.get_or_404(quiz_id)
    data = request.get_json()
    answers = data.get('answers', {})  # {question_id: answer_index}

    # Grade the quiz
    correct = 0
    total = len(quiz.questions)
    correct_answers_map = {}
    for q in quiz.questions:
        correct_answers_map[q.id] = q.correct_answer
        submitted = answers.get(str(q.id))
        if submitted is not None and int(submitted) == q.correct_answer:
            correct += 1

    score = (correct / total * 100) if total > 0 else 0
    passed = score >= quiz.pass_percent
    xp_earned = quiz.xp_reward if passed else int(quiz.xp_reward * score / 100)

    attempt = QuizAttempt(
        user_id=user_id,
        quiz_id=quiz_id,
        score=score,
        passed=passed,
        answers=json.dumps(answers),
        xp_earned=xp_earned,
    )
    db.session.add(attempt)

    user = User.query.get(user_id)
    user.xp += xp_earned
    user.update_level()

    # Check and award badges (imports here to avoid circular)
    from app.routes.gamify import check_and_award_badges
    newly_awarded = check_and_award_badges(user)

    db.session.commit()

    return jsonify({
        'score': score,
        'passed': passed,
        'correct': correct,
        'total': total,
        'xp_earned': xp_earned,
        'correct_answers': correct_answers_map,
        'user': user.to_dict(),
        'newly_awarded': newly_awarded,
    }), 200


@quiz_bp.route('/', methods=['POST'])
@jwt_required()
def create_quiz():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403

    data = request.get_json()
    quiz = Quiz(
        course_id=data['course_id'],
        title=data['title'],
        description=data.get('description', ''),
        xp_reward=data.get('xp_reward', 50),
        time_limit=data.get('time_limit', 30),
        pass_percent=data.get('pass_percent', 70),
    )
    db.session.add(quiz)
    db.session.flush()

    for q_data in data.get('questions', []):
        options = q_data.get('options', [])
        options = [o for o in options if o.strip()]
        question = Question(
            quiz_id=quiz.id,
            text=q_data.get('text', ''),
            image_url=q_data.get('image_url', ''),
            question_type=q_data.get('question_type', 'text'),
            options=json.dumps(options),
            correct_answer=q_data.get('correct_answer', 0),
            explanation=q_data.get('explanation', ''),
        )
        db.session.add(question)

    db.session.commit()
    return jsonify(quiz.to_dict(include_questions=True)), 201


@quiz_bp.route('/<int:quiz_id>', methods=['PUT'])
@jwt_required()
def update_quiz(quiz_id):
    """Admin: update quiz and its questions."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403

    quiz = Quiz.query.get_or_404(quiz_id)
    data = request.get_json()

    for field in ['title', 'description', 'xp_reward', 'time_limit', 'pass_percent', 'course_id']:
        if field in data:
            setattr(quiz, field, data[field])

    if 'questions' in data:
        Question.query.filter_by(quiz_id=quiz_id).delete()
        for q_data in data['questions']:
            options = [o for o in q_data.get('options', []) if o.strip()]
            question = Question(
                quiz_id=quiz.id,
                text=q_data.get('text', ''),
                image_url=q_data.get('image_url', ''),
                question_type=q_data.get('question_type', 'text'),
                options=json.dumps(options),
                correct_answer=q_data.get('correct_answer', 0),
                explanation=q_data.get('explanation', ''),
            )
            db.session.add(question)

    db.session.commit()
    return jsonify(quiz.to_dict(include_questions=True)), 200


@quiz_bp.route('/<int:quiz_id>', methods=['DELETE'])
@jwt_required()
def delete_quiz(quiz_id):
    """Admin: delete a quiz and all its data."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403

    quiz = Quiz.query.get_or_404(quiz_id)
    QuizAttempt.query.filter_by(quiz_id=quiz_id).delete()
    Question.query.filter_by(quiz_id=quiz_id).delete()
    db.session.delete(quiz)
    db.session.commit()
    return jsonify({'message': 'Quiz deleted'}), 200