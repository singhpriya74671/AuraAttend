from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.attendance import AttendanceRecord, AttendanceSession, ClassCancellation
from app.models.student import Student
from app.models.subject import Subject, Faculty
from app.models.anomaly import AnomalyFlag
from app.services.report_service import generate_pdf_report
from sqlalchemy import func, case
from datetime import datetime, timedelta
import io

faculty_bp = Blueprint("faculty", __name__)


def _require_faculty(identity):
    if identity["role"] not in ("faculty", "admin"):
        return False
    return True


@faculty_bp.post("/session/start")
@jwt_required()
def start_session():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403

    data = request.get_json()
    subject_id = data.get("subject_id")
    duration_minutes = data.get("duration_minutes", 10)

    # Close any existing active session for this subject
    AttendanceSession.query.filter_by(subject_id=subject_id, is_active=True).update({"is_active": False})
    db.session.flush()

    otp = AttendanceSession.generate_otp()
    session = AttendanceSession(
        subject_id=subject_id,
        faculty_id=identity["id"],
        otp=otp,
        expires_at=datetime.utcnow() + timedelta(minutes=duration_minutes),
    )
    db.session.add(session)
    db.session.commit()

    try:
        from app import broadcast_session_started
        broadcast_session_started(subject_id, otp, session.expires_at.isoformat())
    except Exception:
        pass

    return jsonify(session.to_dict()), 201


@faculty_bp.post("/session/stop")
@jwt_required()
def stop_session():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403

    data = request.get_json()
    subject_id = data.get("subject_id")
    AttendanceSession.query.filter_by(subject_id=subject_id, is_active=True).update({"is_active": False})
    db.session.commit()

    try:
        from app import broadcast_session_stopped
        broadcast_session_stopped(subject_id)
    except Exception:
        pass

    return jsonify({"message": "Session stopped"})


@faculty_bp.get("/session/active/<int:subject_id>")
@jwt_required()
def get_active_session(subject_id):
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403

    session = AttendanceSession.query.filter_by(subject_id=subject_id, is_active=True).first()
    if not session or datetime.utcnow() > session.expires_at:
        if session:
            session.is_active = False
            db.session.commit()
        return jsonify({"active": False})

    remaining = int((session.expires_at - datetime.utcnow()).total_seconds())
    return jsonify({**session.to_dict(), "active": True, "remaining_seconds": remaining})


@faculty_bp.get("/subjects")
@jwt_required()
def my_subjects():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403
    # Both admin and faculty see all active subjects
    subjects = Subject.query.filter_by(is_active=True).all()
    return jsonify([s.to_dict() for s in subjects])


@faculty_bp.get("/attendance/<int:subject_id>")
@jwt_required()
def subject_attendance(subject_id):
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403

    rows = (
        db.session.query(
            Student.id,
            Student.roll_number,
            Student.name,
            func.count(AttendanceRecord.id).label("total"),
            func.sum(
                case((AttendanceRecord.status.in_(["present", "partial"]), 1), else_=0)
            ).label("present"),
        )
        .join(AttendanceRecord, AttendanceRecord.student_id == Student.id)
        .filter(AttendanceRecord.subject_id == subject_id)
        .group_by(Student.id)
        .all()
    )

    result = []
    for r in rows:
        pct = round((r.present / r.total * 100) if r.total else 0, 2)
        result.append({
            "student_id": r.id,
            "roll_number": r.roll_number,
            "name": r.name,
            "total": r.total,
            "present": r.present,
            "percentage": pct,
        })
    return jsonify(result)


@faculty_bp.get("/heatmap/<int:subject_id>")
@jwt_required()
def heatmap(subject_id):
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403

    rows = (
        db.session.query(
            func.date(AttendanceRecord.timestamp).label("date"),
            func.count(AttendanceRecord.id).label("count"),
        )
        .filter(AttendanceRecord.subject_id == subject_id)
        .group_by(func.date(AttendanceRecord.timestamp))
        .order_by(func.date(AttendanceRecord.timestamp))
        .all()
    )
    return jsonify([{"date": str(r.date), "count": r.count} for r in rows])


@faculty_bp.post("/override")
@jwt_required()
def override_attendance():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403

    data = request.get_json()
    record = AttendanceRecord.query.get_or_404(data["record_id"])
    record.status = data["status"]
    record.manually_overridden = True
    record.override_by = identity["id"]
    record.override_note = data.get("note", "")
    db.session.commit()
    return jsonify({"message": "Attendance updated"})


@faculty_bp.get("/anomalies/<int:subject_id>")
@jwt_required()
def anomalies(subject_id):
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403

    flags = AnomalyFlag.query.filter_by(subject_id=subject_id, resolved=False).all()
    return jsonify([{
        "id": f.id,
        "student_id": f.student_id,
        "type": f.anomaly_type,
        "description": f.description,
        "severity": f.severity,
        "flagged_at": f.flagged_at.isoformat(),
    } for f in flags])


@faculty_bp.get("/report/<int:subject_id>")
@jwt_required()
def download_report(subject_id):
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403

    pdf_bytes = generate_pdf_report(subject_id)
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"attendance_report_{subject_id}.pdf",
    )


@faculty_bp.get("/insights/<int:subject_id>")
@jwt_required()
def ai_insights(subject_id):
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403
    from app.services.insights_service import generate_ai_insights
    return jsonify(generate_ai_insights(subject_id))


@faculty_bp.get("/analytics/monthly/<int:subject_id>")
@jwt_required()
def monthly_trend(subject_id):
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403
    from app.services.insights_service import get_monthly_trend
    return jsonify(get_monthly_trend(subject_id))


@faculty_bp.get("/analytics/department")
@jwt_required()
def department_stats():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403
    from app.services.insights_service import get_department_stats
    return jsonify(get_department_stats())


@faculty_bp.get("/analytics/heatmap-data/<int:subject_id>")
@jwt_required()
def heatmap_data(subject_id):
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403
    from app.services.insights_service import get_defaulter_heatmap
    return jsonify(get_defaulter_heatmap(subject_id))


@faculty_bp.get("/predictions/<int:subject_id>")
@jwt_required()
def predictions(subject_id):
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403
    from app.services.prediction_service import predict_subject_risks
    result = predict_subject_risks(subject_id)
    return jsonify(result)


@faculty_bp.get("/predictions-all")
@jwt_required()
def predictions_all():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403
    from app.services.prediction_service import predict_all_subjects
    result = predict_all_subjects()
    return jsonify(result)


@faculty_bp.post("/chatbot")
@jwt_required()
def chatbot():
    """Plain-English query → structured attendance data."""
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403

    query = request.get_json().get("query", "").lower()

    if "below 75" in query or "low attendance" in query:
        subject_id = request.get_json().get("subject_id")
        rows = (
            db.session.query(Student, func.count(AttendanceRecord.id).label("total"),
                             func.sum(case((AttendanceRecord.status.in_(["present", "partial"]), 1), else_=0)).label("present"))
            .join(AttendanceRecord, AttendanceRecord.student_id == Student.id)
            .filter(AttendanceRecord.subject_id == subject_id)
            .group_by(Student.id)
            .having(func.sum(case((AttendanceRecord.status.in_(["present", "partial"]), 1), else_=0)) * 100 / func.count(AttendanceRecord.id) < 75)
            .all()
        )
        return jsonify({
            "answer": f"Found {len(rows)} students below 75%",
            "students": [{"name": r.Student.name, "roll": r.Student.roll_number} for r in rows],
        })

    return jsonify({"answer": "Query not understood. Try: 'show students below 75%'"})


# ─── Class Cancellation ───────────────────────────────────────────────────────

@faculty_bp.post("/cancel-class")
@jwt_required()
def cancel_class():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403

    data = request.get_json()
    subject_id = data.get("subject_id")
    cancel_date_str = data.get("cancel_date")
    reason = data.get("reason", "").strip()

    if not subject_id or not cancel_date_str:
        return jsonify({"error": "subject_id and cancel_date are required."}), 400

    from datetime import date as dt_date
    try:
        cancel_date = dt_date.fromisoformat(cancel_date_str)
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400

    subject = Subject.query.get_or_404(subject_id)

    cancellation = ClassCancellation(
        subject_id=subject_id,
        faculty_id=identity["id"],
        cancel_date=cancel_date,
        reason=reason,
    )
    db.session.add(cancellation)
    db.session.commit()

    # Email all affected students
    students = Student.query.filter_by(
        department=subject.department,
        semester=subject.semester,
        is_active=True,
    ).all()

    if students:
        try:
            from flask_mail import Message
            from app import mail
            date_display = cancel_date.strftime("%d %B %Y")
            subject_line = f"[AuraAttend] Class Cancelled – {subject.name} on {date_display}"

            faculty = Faculty.query.get(identity["id"])
            faculty_name = faculty.name if faculty else "Faculty"

            for student in students:
                emails = [student.email]
                if student.parent_email:
                    emails.append(student.parent_email)

                body = f"""Dear {student.name},

This is to inform you that the class for {subject.name} ({subject.code}) scheduled on {date_display} has been CANCELLED.

{'Reason: ' + reason if reason else ''}

Faculty: {faculty_name}
Department: {subject.department}
Semester: {subject.semester}

Please check AuraAttend for further updates.

Regards,
AuraAttend System
IGDTUW"""
                msg = Message(
                    subject=subject_line,
                    recipients=emails,
                    body=body,
                )
                mail.send(msg)
        except Exception as e:
            # Email failure should not block the API response
            import traceback; traceback.print_exc()

    faculty_obj = Faculty.query.get(identity["id"])
    return jsonify({
        "message": f"Class cancellation notice created. {len(students)} student(s) notified.",
        "cancellation": cancellation.to_dict(subject=subject, faculty=faculty_obj),
    }), 201


@faculty_bp.get("/cancellations")
@jwt_required()
def get_cancellations():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403

    subject_id = request.args.get("subject_id", type=int)
    query = ClassCancellation.query.filter_by(faculty_id=identity["id"], is_active=True)
    if subject_id:
        query = query.filter_by(subject_id=subject_id)

    cancellations = query.order_by(ClassCancellation.cancel_date.desc()).all()
    faculty_obj = Faculty.query.get(identity["id"])
    result = []
    for c in cancellations:
        subj = Subject.query.get(c.subject_id)
        result.append(c.to_dict(subject=subj, faculty=faculty_obj))
    return jsonify(result)


@faculty_bp.delete("/cancellations/<int:cancellation_id>")
@jwt_required()
def delete_cancellation(cancellation_id):
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_faculty(identity):
        return jsonify({"error": "Faculty only"}), 403

    c = ClassCancellation.query.filter_by(id=cancellation_id, faculty_id=identity["id"]).first_or_404()
    c.is_active = False
    db.session.commit()
    return jsonify({"message": "Cancellation notice removed."})
