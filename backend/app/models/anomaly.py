from app import db
from datetime import datetime


class AnomalyFlag(db.Model):
    __tablename__ = "anomaly_flags"

    id = db.Column(db.Integer, primary_key=True)
    attendance_record_id = db.Column(db.Integer, db.ForeignKey("attendance_records.id"))
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"))
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"))
    anomaly_type = db.Column(db.String(50))   # bulk_checkin | geo_mismatch | duplicate_face | time_gap
    description = db.Column(db.Text)
    severity = db.Column(db.String(10), default="medium")  # low | medium | high
    flagged_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved = db.Column(db.Boolean, default=False)
    resolved_by = db.Column(db.Integer, db.ForeignKey("faculty.id"))


class AlertSent(db.Model):
    __tablename__ = "alerts_sent"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"))
    alert_type = db.Column(db.String(30))     # low_attendance | anomaly | general
    recipient_email = db.Column(db.String(120))
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    attendance_percent = db.Column(db.Float)
    message = db.Column(db.Text)
