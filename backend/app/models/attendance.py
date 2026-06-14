from app import db
from datetime import datetime
import random
import string


class ClassCancellation(db.Model):
    __tablename__ = "class_cancellations"

    id          = db.Column(db.Integer, primary_key=True)
    subject_id  = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False)
    faculty_id  = db.Column(db.Integer, db.ForeignKey("faculty.id"), nullable=False)
    cancel_date = db.Column(db.Date, nullable=False)
    reason      = db.Column(db.String(500), default="")
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    is_active   = db.Column(db.Boolean, default=True)

    def to_dict(self, subject=None, faculty=None):
        return {
            "id":           self.id,
            "subject_id":   self.subject_id,
            "subject_name": subject.name if subject else "",
            "subject_code": subject.code if subject else "",
            "faculty_name": faculty.name if faculty else "",
            "cancel_date":  self.cancel_date.strftime("%Y-%m-%d"),
            "cancel_date_display": self.cancel_date.strftime("%d %b %Y"),
            "reason":       self.reason,
            "created_at":   self.created_at.isoformat(),
        }


class AttendanceSession(db.Model):
    __tablename__ = "attendance_sessions"

    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey("faculty.id"), nullable=False)
    otp = db.Column(db.String(6), nullable=False)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, default=True)

    @staticmethod
    def generate_otp():
        return ''.join(random.choices(string.digits, k=6))

    def to_dict(self):
        return {
            "id": self.id,
            "subject_id": self.subject_id,
            "otp": self.otp,
            "started_at": self.started_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "is_active": self.is_active,
        }


class AttendanceRecord(db.Model):
    __tablename__ = "attendance_records"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # ML confidence scores
    face_confidence_score = db.Column(db.Float)
    mood_score = db.Column(db.Float)          # 0.0 (drowsy) – 1.0 (alert)
    liveness_passed = db.Column(db.Boolean, default=True)

    # Location verification
    gps_lat = db.Column(db.Float)
    gps_lng = db.Column(db.Float)
    wifi_ap_id = db.Column(db.String(50))
    geo_verified = db.Column(db.Boolean, default=False)

    # Status
    status = db.Column(db.String(20), default="present")  # present | partial | absent | manual
    is_anomaly = db.Column(db.Boolean, default=False)
    manually_overridden = db.Column(db.Boolean, default=False)
    override_by = db.Column(db.Integer, db.ForeignKey("faculty.id"))
    override_note = db.Column(db.Text)

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "subject_id": self.subject_id,
            "timestamp": self.timestamp.isoformat(),
            "face_confidence_score": self.face_confidence_score,
            "mood_score": self.mood_score,
            "liveness_passed": self.liveness_passed,
            "geo_verified": self.geo_verified,
            "status": self.status,
            "is_anomaly": self.is_anomaly,
        }
