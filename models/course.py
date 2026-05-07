from app import db
from datetime import datetime


class Course(db.Model):
    __tablename__ = 'courses'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(100))
    difficulty = db.Column(db.String(20), default='beginner')
    thumbnail = db.Column(db.String(300))
    video_url = db.Column(db.String(300))           # Normal-paced video
    slow_video_url = db.Column(db.String(300))      # Slow-paced video (emotion fallback)
    duration = db.Column(db.Integer, default=0)
    instructor = db.Column(db.String(150))
    xp_reward = db.Column(db.Integer, default=100)
    is_published = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    enrollments = db.relationship('Enrollment', backref='course', lazy=True)
    lessons = db.relationship('Lesson', backref='course', lazy=True, cascade='all, delete-orphan')
    quizzes = db.relationship('Quiz', backref='course', lazy=True, cascade='all, delete-orphan')

    def to_dict(self, include_lessons=False):
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'category': self.category,
            'difficulty': self.difficulty,
            'thumbnail': self.thumbnail,
            'video_url': self.video_url,
            'slow_video_url': self.slow_video_url,
            'duration': self.duration,
            'instructor': self.instructor,
            'xp_reward': self.xp_reward,
            'is_published': self.is_published,
            'enrollment_count': len(self.enrollments),
            'lesson_count': len(self.lessons),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_lessons:
            data['lessons'] = [l.to_dict() for l in self.lessons]
            data['quizzes'] = [q.to_dict() for q in self.quizzes]
        return data


class Lesson(db.Model):
    __tablename__ = 'lessons'

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text)
    video_url = db.Column(db.String(300))
    order = db.Column(db.Integer, default=0)
    duration = db.Column(db.Integer, default=0)
    xp_reward = db.Column(db.Integer, default=20)

    def to_dict(self):
        return {
            'id': self.id,
            'course_id': self.course_id,
            'title': self.title,
            'content': self.content,
            'video_url': self.video_url,
            'order': self.order,
            'duration': self.duration,
            'xp_reward': self.xp_reward,
        }