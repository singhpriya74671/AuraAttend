import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_mail import Mail
try:
    from celery import Celery
    celery = Celery()
    CELERY_AVAILABLE = True
except ImportError:
    celery = None
    CELERY_AVAILABLE = False

from config import config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
mail = Mail()

# Initialized later in create_app
limiter = None
socketio = None


def create_app(env=None):
    if env is None:
        env = os.getenv("FLASK_ENV", "default")
    global limiter, socketio
    app = Flask(__name__)
    app.config.from_object(config[env])

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Rate limiting
    try:
        from flask_limiter import Limiter
        from flask_limiter.util import get_remote_address
        limiter = Limiter(
            get_remote_address,
            app=app,
            default_limits=["200 per day", "50 per hour"],
            storage_uri=app.config.get("RATELIMIT_STORAGE_URI", "memory://"),
        )
    except ImportError:
        pass

    # WebSockets
    try:
        from flask_socketio import SocketIO
        socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
        _register_socketio_events(socketio)
    except ImportError:
        pass

    if celery is not None and "CELERY_BROKER_URL" in app.config:
        celery.conf.update(
            broker_url=app.config["CELERY_BROKER_URL"],
            result_backend=app.config["CELERY_RESULT_BACKEND"],
        )

    from app.routes.auth import auth_bp
    from app.routes.attendance import attendance_bp
    from app.routes.faculty import faculty_bp
    from app.routes.admin import admin_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(attendance_bp, url_prefix="/api/attendance")
    app.register_blueprint(faculty_bp, url_prefix="/api/faculty")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")

    @app.get("/api/health")
    def health():
        return {"status": "ok", "service": "AuraAttend"}

    return app


def _register_socketio_events(sio):
    from flask_socketio import join_room, leave_room, emit

    @sio.on("join_session")
    def on_join(data):
        subject_id = data.get("subject_id")
        join_room(f"subject_{subject_id}")
        emit("joined", {"subject_id": subject_id})

    @sio.on("leave_session")
    def on_leave(data):
        subject_id = data.get("subject_id")
        leave_room(f"subject_{subject_id}")

    @sio.on("presence_response")
    def on_presence(data):
        # Student responds to presence check with face image
        emit("presence_received", data, room=f"subject_{data.get('subject_id')}")


def broadcast_session_started(subject_id: int, otp: str, expires_at: str):
    if socketio:
        socketio.emit("session_started", {
            "subject_id": subject_id,
            "otp": otp,
            "expires_at": expires_at,
        }, room=f"subject_{subject_id}")


def broadcast_session_stopped(subject_id: int):
    if socketio:
        socketio.emit("session_stopped", {"subject_id": subject_id},
                      room=f"subject_{subject_id}")


def broadcast_presence_check(subject_id: int):
    if socketio:
        socketio.emit("presence_check", {"subject_id": subject_id, "message": "Please verify your presence."},
                      room=f"subject_{subject_id}")
