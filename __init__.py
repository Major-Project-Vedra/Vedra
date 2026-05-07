from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_mail import Mail
from dotenv import load_dotenv
import os
load_dotenv()

db = SQLAlchemy()
jwt = JWTManager()
mail = Mail()


def create_app():
    app = Flask(__name__)

    # Config
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-jwt-secret')

    # ── Database — single definition with timeout to prevent "database is locked" ──
    db_path = os.path.join(os.path.dirname(__file__), '..', 'instance', 'vedra.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
        'DATABASE_URL',
        f'sqlite:///{os.path.abspath(db_path)}?timeout=20'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'connect_args': {'timeout': 20, 'check_same_thread': False}
    }
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 86400  # 24 hours

    # Mail config
    app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
    app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True') == 'True'
    app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME', '')
    app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD', '')

    # Upload folder
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), '..', 'uploads')
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)

    CORS(app, origins=[os.getenv('FRONTEND_URL', 'http://localhost:3000')], supports_credentials=True)

    # Serve uploaded avatar images
    from flask import send_from_directory

    @app.route('/uploads/avatars/<path:filename>')
    def serve_avatar(filename):
        avatar_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'avatars')
        return send_from_directory(avatar_dir, filename)

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.courses import courses_bp
    from app.routes.enrollment import enrollment_bp
    from app.routes.progress import progress_bp
    from app.routes.quiz import quiz_bp
    from app.routes.gamify import gamify_bp
    from app.routes.admin import admin_bp
    from app.routes.users import users_bp
    from app.routes.emotion import emotion_bp

    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(courses_bp, url_prefix='/courses')
    app.register_blueprint(enrollment_bp, url_prefix='/enroll')
    app.register_blueprint(progress_bp, url_prefix='/progress')
    app.register_blueprint(quiz_bp, url_prefix='/quiz')
    app.register_blueprint(gamify_bp, url_prefix='/gamify')
    app.register_blueprint(admin_bp, url_prefix='/admin')
    app.register_blueprint(users_bp, url_prefix='/users')
    app.register_blueprint(emotion_bp, url_prefix='/emotion')

    with app.app_context():
        db.create_all()
        _seed_data()

    return app


def _seed_data():
    """Seed initial data if DB is empty."""
    from app.models.user import User
    from app.models.course import Course
    from werkzeug.security import generate_password_hash

    if User.query.first():
        return

    admin = User(
        username='admin',
        email='admin@vedra.com',
        password_hash=generate_password_hash('Admin@123'),
        role='admin',
        full_name='System Admin',
        xp=0,
        level=1
    )
    db.session.add(admin)

    sample_courses = [
        Course(title='Python for Beginners', description='Learn Python from scratch with hands-on exercises.',
                category='Programming', difficulty='beginner', thumbnail='https://placehold.co/400x225/4F46E5/white?text=Python',
                video_url='https://www.youtube.com/embed/dQw4w9WgXcQ', duration=600, instructor='Dr. Smith'),
        Course(title='Web Development with React', description='Build modern web apps using React and hooks.',
                category='Web Dev', difficulty='intermediate', thumbnail='https://placehold.co/400x225/0EA5E9/white?text=React',
                video_url='https://www.youtube.com/embed/dQw4w9WgXcQ', duration=900, instructor='Jane Doe'),
        Course(title='Data Science Fundamentals', description='Introduction to data analysis and visualization.',
                category='Data Science', difficulty='beginner', thumbnail='https://placehold.co/400x225/10B981/white?text=DataSci',
                video_url='https://www.youtube.com/embed/dQw4w9WgXcQ', duration=750, instructor='Prof. Chen'),
        Course(title='Machine Learning Basics', description='Understand core ML algorithms and applications.',
                category='AI/ML', difficulty='advanced', thumbnail='https://placehold.co/400x225/F59E0B/white?text=ML',
                video_url='https://www.youtube.com/embed/dQw4w9WgXcQ', duration=1200, instructor='Dr. Patel'),
    ]
    for c in sample_courses:
        db.session.add(c)

    db.session.commit()