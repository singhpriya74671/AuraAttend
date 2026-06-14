from flask import current_app
from flask_mail import Message
from app import mail, db
from app.models.student import Student
from app.models.attendance import AttendanceRecord
from app.models.subject import Subject
from sqlalchemy import func, case


def _send_email(to: str, subject: str, body: str):
    try:
        msg = Message(subject=subject, recipients=[to], body=body,
                      sender=current_app.config.get("MAIL_USERNAME", "noreply@auraattend.com"))
        mail.send(msg)
        return True
    except Exception as e:
        current_app.logger.error(f"Email send failed to {to}: {e}")
        return False


def send_low_attendance_alert(student_id: int, subject_id: int, percentage: float):
    student = Student.query.get(student_id)
    subject = Subject.query.get(subject_id)
    if not student or not subject:
        return

    body = f"""Dear {student.name},

This is an automated alert from AuraAttend.

Your current attendance in {subject.name} ({subject.code}) is {percentage:.1f}%, which is below the required minimum of 75%.

Please ensure regular attendance to avoid academic penalties.

Subject: {subject.name} ({subject.code})
Current Attendance: {percentage:.1f}%
Required Attendance: 75%

If you believe this is an error, please contact your faculty.

Regards,
AuraAttend System
"""
    _send_email(student.email, f"Low Attendance Alert — {subject.name}", body)

    if student.parent_email:
        parent_body = f"""Dear Parent/Guardian,

This is an automated alert from AuraAttend regarding your ward {student.name}.

Attendance in {subject.name} ({subject.code}) has dropped to {percentage:.1f}%, below the required 75%.

Please encourage regular attendance.

Regards,
AuraAttend System
"""
        _send_email(student.parent_email, f"Attendance Alert — {student.name}", parent_body)


def send_session_started_notification(subject_id: int, otp: str):
    """Notify enrolled students that an attendance session has started."""
    subject = Subject.query.get(subject_id)
    if not subject:
        return

    student_ids = (
        db.session.query(AttendanceRecord.student_id)
        .filter_by(subject_id=subject_id)
        .distinct().all()
    )

    for (sid,) in student_ids:
        student = Student.query.get(sid)
        if student and student.email:
            body = f"""Dear {student.name},

An attendance session has started for {subject.name} ({subject.code}).

Your OTP: {otp}

Please open AuraAttend and mark your attendance before the session expires.

Regards,
AuraAttend System
"""
            _send_email(student.email, f"Attendance Session Started — {subject.name}", body)


def check_and_notify_low_attendance():
    """Run periodically to find and notify students below 75%."""
    subjects = Subject.query.filter_by(is_active=True).all()
    notified = 0

    for subject in subjects:
        rows = (
            db.session.query(
                AttendanceRecord.student_id,
                func.count(AttendanceRecord.id).label("total"),
                func.sum(case((AttendanceRecord.status.in_(["present", "partial"]), 1), else_=0)).label("present"),
            )
            .filter_by(subject_id=subject.id)
            .group_by(AttendanceRecord.student_id)
            .having(func.count(AttendanceRecord.id) >= 5)
            .all()
        )

        for r in rows:
            pct = (r.present / r.total * 100) if r.total else 0
            if pct < 75:
                send_low_attendance_alert(r.student_id, subject.id, pct)
                notified += 1

    return notified
