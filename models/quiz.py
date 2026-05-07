from app import db
from datetime import datetime
import json


class Quiz(db.Model):
    __tablename__ = 'quizzes'

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    xp_reward = db.Column(db.Integer, default=50)
    time_limit = db.Column(db.Integer, default=30)  # minutes
    pass_percent = db.Column(db.Float, default=70.0)

    questions = db.relationship('Question', backref='quiz', lazy=True, cascade='all, delete-orphan')
    attempts = db.relationship('QuizAttempt', backref='quiz', lazy=True)

    def to_dict(self, include_questions=False):
        data = {
            'id': self.id,
            'course_id': self.course_id,
            'title': self.title,
            'description': self.description,
            'xp_reward': self.xp_reward,
            'time_limit': self.time_limit,
            'pass_percent': self.pass_percent,
            'question_count': len(self.questions),
        }
        if include_questions:
            data['questions'] = [q.to_dict() for q in self.questions]
        return data


class Question(db.Model):
    __tablename__ = 'questions'

    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    text = db.Column(db.Text, default='')
    image_url = db.Column(db.String(500), default='')          # NEW: image for image/text+image questions
    question_type = db.Column(db.String(20), default='text')   # NEW: 'text' | 'image' | 'text_image'
    options = db.Column(db.Text)  # JSON array
    correct_answer = db.Column(db.Integer)  # index of correct option
    explanation = db.Column(db.Text)

    def to_dict(self, include_answer=False):
        data = {
            'id': self.id,
            'quiz_id': self.quiz_id,
            'text': self.text or '',
            'image_url': self.image_url or '',
            'question_type': self.question_type or 'text',
            'options': json.loads(self.options) if self.options else [],
            'explanation': self.explanation or '',
            'correct_answer': self.correct_answer,  # always include for review
        }
        return data


class QuizAttempt(db.Model):
    __tablename__ = 'quiz_attempts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    score = db.Column(db.Float, default=0.0)
    passed = db.Column(db.Boolean, default=False)
    answers = db.Column(db.Text)  # JSON
    xp_earned = db.Column(db.Integer, default=0)
    attempted_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'quiz_id': self.quiz_id,
            'score': self.score,
            'passed': self.passed,
            'xp_earned': self.xp_earned,
            'attempted_at': self.attempted_at.isoformat() if self.attempted_at else None,
        }