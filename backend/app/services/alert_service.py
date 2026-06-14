from app import celery, mail, db
from flask_mail import Message
from app.models.student import Student
from app.models.subject import Subject
from app.models.attendance import AttendanceRecord
from app.models.anomaly import AlertSent
from sqlalchemy import func, case
import os


@celery.task
def check_and_send_low_attendance_alerts():
    threshold = int(os.getenv("ATTENDANCE_THRESHOLD", 75))
    students = Student.query.filter_by(is_active=True).all()

    for student in students:
        subjects = (
            db.session.query(Subject)
            .join(AttendanceRecord, AttendanceRecord.subject_id == Subject.id)
            .filter(AttendanceRecord.student_id == student.id)
            .distinct()
            .all()
        )
        for subject in subjects:
            total = AttendanceRecord.query.filter_by(
                student_id=student.id, subject_id=subject.id).count()
            present = AttendanceRecord.query.filter(
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.subject_id == subject.id,
                AttendanceRecord.status.in_(["present", "partial"]),
            ).count()

            if total == 0:
                continue
            pct = present / total * 100
            if pct < threshold:
                _send_alert(student, subject, pct)


def _send_alert(student: Student, subject: Subject, pct: float):
    already_sent = AlertSent.query.filter_by(
        student_id=student.id, subject_id=subject.id, alert_type="low_attendance"
    ).order_by(AlertSent.sent_at.desc()).first()

    # Don't spam — one alert per week per subject
    from datetime import datetime, timedelta
    if already_sent and (datetime.utcnow() - already_sent.sent_at) < timedelta(days=7):
        return

    recipients = [student.email]
    if student.parent_email:
        recipients.append(student.parent_email)

    body = (
        f"Dear {student.name},\n\n"
        f"Your attendance in {subject.name} ({subject.code}) is {pct:.1f}%, "
        f"which is below the required threshold.\n\n"
        f"Please contact your faculty immediately.\n\nAuraAttend System"
    )

    msg = Message(
        subject=f"Low Attendance Alert — {subject.name}",
        recipients=recipients,
        body=body,
    )
    try:
        mail.send(msg)
    except Exception:
        pass  # Log in production

    log = AlertSent(
        student_id=student.id,
        subject_id=subject.id,
        alert_type="low_attendance",
        recipient_email=",".join(recipients),
        attendance_percent=pct,
        message=body,
    )
    db.session.add(log)
    db.session.commit()
