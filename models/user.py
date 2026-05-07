from app import db
from datetime import datetime


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name = db.Column(db.String(150))
    role = db.Column(db.String(20), default='student')  # 'student' or 'admin'
    avatar = db.Column(db.String(300))
    bio = db.Column(db.Text)
    xp = db.Column(db.Integer, default=0)
    level = db.Column(db.Integer, default=1)
    streak = db.Column(db.Integer, default=0)
    last_active = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

    # Relationships
    enrollments = db.relationship('Enrollment', backref='student', lazy=True)
    badges = db.relationship('UserBadge', backref='user', lazy=True)
    quiz_attempts = db.relationship('QuizAttempt', backref='user', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'role': self.role,
            'avatar': self.avatar,
            'bio': self.bio,
            'xp': self.xp,
            'level': self.level,
            'streak': self.streak,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def xp_for_next_level(self):
        return self.level * 500

    def update_level(self):
        while self.xp >= self.xp_for_next_level():
            self.xp -= self.xp_for_next_level()
            self.level += 1
