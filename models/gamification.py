from app import db
from datetime import datetime


class Badge(db.Model):
    __tablename__ = 'badges'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    icon = db.Column(db.String(10), default='🏆')
    condition_type = db.Column(db.String(50))  # 'xp', 'courses_completed', 'streak', 'quiz_score'
    condition_value = db.Column(db.Integer, default=0)
    xp_reward = db.Column(db.Integer, default=50)

    user_badges = db.relationship('UserBadge', backref='badge', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'icon': self.icon,
            'condition_type': self.condition_type,
            'condition_value': self.condition_value,
            'xp_reward': self.xp_reward,
        }


class UserBadge(db.Model):
    __tablename__ = 'user_badges'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    badge_id = db.Column(db.Integer, db.ForeignKey('badges.id'), nullable=False)
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', 'badge_id', name='unique_user_badge'),)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'badge': self.badge.to_dict(),
            'earned_at': self.earned_at.isoformat() if self.earned_at else None,
        }
