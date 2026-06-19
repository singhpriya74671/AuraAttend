import os
import datetime
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
    JWT_ACCESS_TOKEN_EXPIRES = datetime.timedelta(days=7)
    # Render/Heroku give "postgres://" but SQLAlchemy needs "postgresql://"
    _db_url = os.getenv("DATABASE_URL", "postgresql://postgres:@localhost:5432/aura_attend")
    SQLALCHEMY_DATABASE_URI = _db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    MAIL_SERVER = os.getenv("SMTP_HOST", "smtp.gmail.com")
    MAIL_PORT = int(os.getenv("SMTP_PORT", 587))
    MAIL_USE_TLS = True
    MAIL_USE_SSL = False
    MAIL_USERNAME = os.getenv("SMTP_USER")
    MAIL_PASSWORD = os.getenv("SMTP_PASS")
    MAIL_DEFAULT_SENDER = os.getenv("SMTP_USER")

    COLLEGE_LAT = float(os.getenv("COLLEGE_LAT", 28.6449))
    COLLEGE_LNG = float(os.getenv("COLLEGE_LNG", 77.2169))
    COLLEGE_RADIUS_METERS = int(os.getenv("COLLEGE_RADIUS_METERS", 300))
    ATTENDANCE_THRESHOLD = int(os.getenv("ATTENDANCE_THRESHOLD", 75))

    CELERY_BROKER_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    RATELIMIT_DEFAULT = "200 per day;50 per hour"
    RATELIMIT_STORAGE_URI = os.getenv("REDIS_URL", "memory://")

    FACE_EMBED_KEY = os.getenv("FACE_EMBED_KEY", "AuraAttendFaceKey123456789012345")  # 32 bytes


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
