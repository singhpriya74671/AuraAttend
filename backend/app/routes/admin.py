from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import generate_password_hash
from app import db
from app.models.student import Student
from app.models.subject import Subject, Faculty, Timetable
from datetime import time

admin_bp = Blueprint("admin", __name__)


def _require_admin(identity):
    return identity.get("role") == "admin"


@admin_bp.post("/faculty")
@jwt_required()
def create_faculty():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_admin(identity):
        return jsonify({"error": "Admin only"}), 403

    data = request.get_json()
    if Faculty.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already exists"}), 409

    faculty = Faculty(
        name=data["name"],
        email=data["email"].lower(),
        password_hash=generate_password_hash(data["password"]),
        department=data.get("department"),
        role=data.get("role", "faculty"),
    )
    db.session.add(faculty)
    db.session.commit()
    return jsonify({"message": "Faculty created", "id": faculty.id}), 201


@admin_bp.post("/subjects")
@jwt_required()
def create_subject():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_admin(identity):
        return jsonify({"error": "Admin only"}), 403

    data = request.get_json()
    subject = Subject(
        code=data["code"],
        name=data["name"],
        department=data.get("department"),
        semester=data.get("semester"),
        faculty_id=data.get("faculty_id"),
    )
    db.session.add(subject)
    db.session.flush()

    for slot in data.get("timetable", []):
        tt = Timetable(
            subject_id=subject.id,
            day_of_week=slot["day"],
            start_time=time.fromisoformat(slot["start"]),
            end_time=time.fromisoformat(slot["end"]),
            room=slot.get("room"),
        )
        db.session.add(tt)

    db.session.commit()
    return jsonify({"message": "Subject created", "id": subject.id}), 201


@admin_bp.get("/students")
@jwt_required()
def list_students():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_admin(identity):
        return jsonify({"error": "Admin only"}), 403

    students = Student.query.filter_by(is_active=True).all()
    return jsonify([s.to_dict() for s in students])


@admin_bp.get("/subjects")
@jwt_required()
def list_subjects():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_admin(identity):
        return jsonify({"error": "Admin only"}), 403
    subjects = Subject.query.filter_by(is_active=True).all()
    result = []
    for s in subjects:
        d = s.to_dict()
        d["faculty_name"] = s.faculty.name if s.faculty else "—"
        result.append(d)
    return jsonify(result)


@admin_bp.delete("/subjects/<int:subject_id>")
@jwt_required()
def delete_subject(subject_id):
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_admin(identity):
        return jsonify({"error": "Admin only"}), 403
    subject = Subject.query.get_or_404(subject_id)
    subject.is_active = False
    db.session.commit()
    return jsonify({"message": "Subject removed"})


@admin_bp.delete("/students/<int:student_id>")
@jwt_required()
def delete_student(student_id):
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_admin(identity):
        return jsonify({"error": "Admin only"}), 403
    student = Student.query.get_or_404(student_id)
    student.is_active = False
    db.session.commit()
    return jsonify({"message": "Student removed"})


@admin_bp.post("/students")
@jwt_required()
def create_student():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_admin(identity):
        return jsonify({"error": "Admin only"}), 403
    data = request.get_json()
    if Student.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already exists"}), 409
    if Student.query.filter_by(roll_number=data["roll_number"]).first():
        return jsonify({"error": "Roll number already exists"}), 409
    student = Student(
        roll_number=data["roll_number"],
        name=data["name"],
        email=data["email"].lower(),
        department=data.get("department", "General"),
        semester=data.get("semester", 1),
        password_hash="",
    )
    db.session.add(student)
    db.session.commit()
    return jsonify({"message": "Student added", "id": student.id}), 201


@admin_bp.get("/faculty")
@jwt_required()
def list_faculty():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_admin(identity):
        return jsonify({"error": "Admin only"}), 403
    faculty = Faculty.query.filter_by(is_active=True).all()
    return jsonify([f.to_dict() for f in faculty])


@admin_bp.delete("/faculty/<int:faculty_id>")
@jwt_required()
def delete_faculty(faculty_id):
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_admin(identity):
        return jsonify({"error": "Admin only"}), 403
    faculty = Faculty.query.get_or_404(faculty_id)
    faculty.is_active = False
    db.session.commit()
    return jsonify({"message": "Faculty removed"})


@admin_bp.get("/notifications")
@jwt_required()
def notifications():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_admin(identity):
        return jsonify({"error": "Admin only"}), 403

    from sqlalchemy import func, case as sa_case
    from app.models.attendance import AttendanceRecord
    from datetime import datetime, timedelta

    alerts = []

    # Students below 75% per subject
    subjects = Subject.query.filter_by(is_active=True).all()
    for subject in subjects:
        rows = (
            db.session.query(
                Student.id,
                Student.name,
                Student.roll_number,
                func.count(AttendanceRecord.id).label("total"),
                func.sum(sa_case((AttendanceRecord.status.in_(["present", "partial"]), 1), else_=0)).label("present"),
            )
            .join(AttendanceRecord, AttendanceRecord.student_id == Student.id)
            .filter(AttendanceRecord.subject_id == subject.id, Student.is_active == True)
            .group_by(Student.id)
            .having(func.count(AttendanceRecord.id) >= 3)
            .all()
        )
        for r in rows:
            pct = round((r.present / r.total * 100) if r.total else 0, 1)
            if pct < 75:
                alerts.append({
                    "type": "low_attendance",
                    "severity": "critical" if pct < 50 else "warning",
                    "student_name": r.name,
                    "roll_number": r.roll_number,
                    "subject_name": subject.name,
                    "subject_code": subject.code,
                    "percentage": pct,
                    "total": r.total,
                    "present": int(r.present),
                })

    # Students absent for 7+ days
    cutoff = datetime.utcnow() - timedelta(days=7)
    inactive = (
        db.session.query(Student.id, Student.name, Student.roll_number,
                         func.max(AttendanceRecord.timestamp).label("last_seen"))
        .join(AttendanceRecord, AttendanceRecord.student_id == Student.id)
        .filter(Student.is_active == True)
        .group_by(Student.id)
        .having(func.max(AttendanceRecord.timestamp) < cutoff)
        .all()
    )
    for r in inactive:
        days_ago = (datetime.utcnow() - r.last_seen).days
        alerts.append({
            "type": "long_absence",
            "severity": "warning",
            "student_name": r.name,
            "roll_number": r.roll_number,
            "subject_name": None,
            "days_absent": days_ago,
        })

    alerts.sort(key=lambda x: (x["severity"] != "critical", x.get("percentage", 100)))
    return jsonify({"alerts": alerts, "count": len(alerts)})


@admin_bp.post("/notify-low-attendance")
@jwt_required()
def notify_low_attendance():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_admin(identity):
        return jsonify({"error": "Admin only"}), 403
    from app.services.notification_service import check_and_notify_low_attendance
    count = check_and_notify_low_attendance()
    return jsonify({"message": f"Notifications sent to {count} students."})


@admin_bp.get("/dashboard/stats")
@jwt_required()
def stats():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if not _require_admin(identity):
        return jsonify({"error": "Admin only"}), 403

    return jsonify({
        "total_students": Student.query.filter_by(is_active=True).count(),
        "total_subjects": Subject.query.filter_by(is_active=True).count(),
        "total_faculty": Faculty.query.filter_by(is_active=True).count(),
    })


@admin_bp.post("/seed-subjects")
def seed_subjects():
    subjects = [
        {"code": "BEC-101", "name": "Analog Electronics", "semester": 1},
        {"code": "BEC-110", "name": "Basic Electrical Engineering", "semester": 1},
        {"code": "BCS-110", "name": "Programming in C Language", "semester": 1},
        {"code": "BAI-101", "name": "Intelligent Systems", "semester": 1},
        {"code": "BAS-109", "name": "Applied Mathematics", "semester": 1},
        {"code": "HMC-110", "name": "Communication Skills", "semester": 1},
        {"code": "BEC-104", "name": "Digital Electronics", "semester": 2},
        {"code": "BEC-106", "name": "Signals and Systems", "semester": 2},
        {"code": "BAI-110", "name": "Programming with Python", "semester": 2},
        {"code": "BAS-106", "name": "Environmental Sciences", "semester": 2},
        {"code": "BAS-108", "name": "Probability and Statistics", "semester": 2},
        {"code": "BAI-108", "name": "IT Workshop", "semester": 2},
        {"code": "BEC-205", "name": "Network Analysis and Synthesis", "semester": 3},
        {"code": "BEC-211", "name": "Communication Systems", "semester": 3},
        {"code": "BAI-205", "name": "Neural Networks and Artificial Intelligence", "semester": 3},
        {"code": "BCS-201", "name": "Data Structures", "semester": 3},
        {"code": "BEC-202", "name": "Linear Integrated Circuits", "semester": 4},
        {"code": "BEC-206", "name": "Electromagnetic Field Theory", "semester": 4},
        {"code": "BEC-210", "name": "Digital Communication Systems", "semester": 4},
        {"code": "BAI-204", "name": "Optimization Techniques and Decision Making", "semester": 4},
        {"code": "HMC-202", "name": "Disaster Management", "semester": 4},
        {"code": "BEC-303", "name": "Control Systems", "semester": 5},
        {"code": "BEC-311", "name": "Digital Signal Processing", "semester": 5},
        {"code": "BAI-301", "name": "Machine Learning", "semester": 5},
        {"code": "BAI-307", "name": "Computer Networks", "semester": 5},
        {"code": "HMC-301", "name": "Professional Ethics and Human Values", "semester": 5},
        {"code": "BEC-306", "name": "VLSI Design", "semester": 6},
        {"code": "BEC-308", "name": "Microprocessors and Microcontrollers", "semester": 6},
        {"code": "BEC-318", "name": "Digital Image Processing", "semester": 6},
        {"code": "BEC-403", "name": "Wireless and Mobile Communication", "semester": 7},
        {"code": "BAI-417", "name": "Multimodal Data Analysis", "semester": 7},
        {"code": "BAI-413", "name": "Deep Learning", "semester": 7},
        {"code": "BAI-451", "name": "Minor Project", "semester": 7},
        {"code": "BAI-418", "name": "Recent Trends in AI", "semester": 8},
        {"code": "BAI-452", "name": "Major Project/R&D Project/Start-up Project", "semester": 8},
        {"code": "GEC-402", "name": "Generic Open Elective", "semester": 8},
    ]
    added = 0
    for s in subjects:
        existing = Subject.query.filter_by(code=s["code"]).first()
        if not existing:
            db.session.add(Subject(code=s["code"], name=s["name"], department="ECE-AI", semester=s["semester"], is_active=True))
            added += 1
        elif not existing.is_active:
            existing.is_active = True
    db.session.commit()
    return jsonify({"message": f"{added} subjects added successfully!"})


@admin_bp.post("/make-admin")
def make_admin():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "Email required."}), 400
    faculty = Faculty.query.filter_by(email=email).first()
    if not faculty:
        return jsonify({"error": "No faculty account found with this email."}), 404
    faculty.role = "admin"
    db.session.commit()
    return jsonify({"message": f"{faculty.name} is now an admin. Please log out and log in again."})


@admin_bp.get("/make-admin/<email>")
def make_admin_get(email):
    email = email.strip().lower()
    faculty = Faculty.query.filter_by(email=email).first()
    if not faculty:
        return f"<h2>Error: No faculty found with email {email}</h2>", 404
    faculty.role = "admin"
    db.session.commit()
    return f"<h2>✅ Done! {faculty.name} is now an Admin. Please log out and log in again.</h2>"
