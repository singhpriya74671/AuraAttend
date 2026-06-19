from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.attendance import AttendanceRecord, AttendanceSession, ClassCancellation
from app.models.subject import Subject, Timetable
from app.services.face_service import verify_face
from app.services.geofence_service import is_within_geofence
from app.services.anomaly_service import check_anomaly
from datetime import datetime, time

attendance_bp = Blueprint("attendance", __name__)

# Rate limit helpers — no-op if flask-limiter not installed
def _rate_limit(limit_str):
    def decorator(f):
        try:
            from app import limiter
            if limiter:
                return limiter.limit(limit_str)(f)
        except Exception:
            pass
        return f
    return decorator


def _active_subject_for_student(student_id):
    """Return the currently scheduled subject, or None."""
    now = datetime.utcnow()
    current_time = now.time()
    day = now.weekday()
    slot = (
        Timetable.query
        .filter_by(day_of_week=day)
        .filter(Timetable.start_time <= current_time, Timetable.end_time >= current_time)
        .first()
    )
    return slot.subject if slot else None


@attendance_bp.post("/register-face")
@jwt_required()
@_rate_limit("5 per hour")
def register_face_route():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if identity["role"] != "student":
        return jsonify({"error": "Students only"}), 403
    data = request.get_json()
    image_b64 = data.get("image")
    if not image_b64:
        return jsonify({"error": "Image required"}), 400
    from app.services.face_service import register_face
    result = register_face(identity["id"], image_b64)
    if result["success"]:
        return jsonify({"message": "Face registered successfully!"})
    return jsonify({"error": result.get("error", "Face not detected. Please ensure good lighting and try again.")}), 400


@attendance_bp.post("/face-checkin")
@jwt_required()
@_rate_limit("10 per hour")
def face_checkin():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if identity["role"] != "student":
        return jsonify({"error": "Students only"}), 403
    data = request.get_json()
    image_b64 = data.get("image")
    subject_id = data.get("subject_id")
    otp = data.get("otp", "").strip()
    gps_lat = data.get("lat")
    gps_lng = data.get("lng")
    if not image_b64:
        return jsonify({"error": "Camera image required"}), 400

    session = AttendanceSession.query.filter_by(
        subject_id=subject_id, is_active=True, otp=otp
    ).first()
    if not session or datetime.utcnow() > session.expires_at:
        return jsonify({"error": "Invalid OTP or the session has expired."}), 400

    from app.services.face_service import verify_face
    face_result = verify_face(identity["id"], image_b64)
    if not face_result.get("match"):
        err = face_result.get("error", "Face verification failed. Please try again.")
        return jsonify({"error": err, "face_result": face_result}), 401

    geo_ok = is_within_geofence(
        gps_lat, gps_lng,
        current_app.config["COLLEGE_LAT"],
        current_app.config["COLLEGE_LNG"],
        current_app.config["COLLEGE_RADIUS_METERS"],
    )

    record = AttendanceRecord(
        student_id=identity["id"],
        subject_id=subject_id,
        status="present",
        geo_verified=geo_ok,
        gps_lat=gps_lat,
        gps_lng=gps_lng,
        liveness_passed=face_result.get("liveness", True),
        face_confidence_score=face_result.get("confidence", 0),
        mood_score=face_result.get("mood_score", 1.0),
    )
    db.session.add(record)
    db.session.commit()
    subject = Subject.query.get(subject_id)
    return jsonify({
        "message": f"Attendance marked for {subject.name}!",
        "status": "present",
        "confidence": face_result.get("confidence"),
        "geo_verified": geo_ok,
    })


@attendance_bp.post("/attention-check")
@jwt_required()
def attention_check():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    data = request.get_json()
    image_b64 = data.get("image")
    session_id = data.get("session_id")
    if not image_b64:
        return jsonify({"error": "Image required"}), 400

    from app.services.attention_service import analyze_attention
    result = analyze_attention(image_b64)

    # Store attention metric
    from app.models.attendance import AttendanceSession
    if session_id:
        from app.models.attendance import AttendanceRecord
        record = (
            AttendanceRecord.query
            .filter_by(student_id=identity["id"])
            .order_by(AttendanceRecord.timestamp.desc())
            .first()
        )
        if record:
            if record.mood_score is None:
                record.mood_score = result.get("attention_score", 1.0)
            else:
                record.mood_score = (record.mood_score + result.get("attention_score", 1.0)) / 2
            db.session.commit()

    return jsonify(result)


@attendance_bp.post("/presence-check")
@jwt_required()
@_rate_limit("20 per hour")
def presence_check():
    """Student responds to a continuous presence verification prompt."""
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    data = request.get_json()
    image_b64 = data.get("image")
    subject_id = data.get("subject_id")

    if not image_b64:
        return jsonify({"error": "Image required"}), 400

    from app.services.face_service import verify_face
    face_result = verify_face(identity["id"], image_b64)

    from app.services.attention_service import analyze_attention
    attention = analyze_attention(image_b64)

    # Update latest attendance record mood score
    record = (
        AttendanceRecord.query
        .filter_by(student_id=identity["id"], subject_id=subject_id)
        .order_by(AttendanceRecord.timestamp.desc())
        .first()
    )
    if record:
        attn_score = attention.get("attention_score", 1.0)
        record.mood_score = round(((record.mood_score or 1.0) + attn_score) / 2, 3)
        if not face_result.get("match"):
            record.status = "partial"
        db.session.commit()

    return jsonify({
        "face_match": face_result.get("match", False),
        "confidence": face_result.get("confidence", 0),
        "attention": attention,
        "status": "verified" if face_result.get("match") else "failed",
    })


@attendance_bp.get("/face-status")
@jwt_required()
def face_status():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    from app.models.student import FaceEmbedding
    registered = FaceEmbedding.query.filter_by(
        student_id=identity["id"], is_primary=True
    ).first()
    return jsonify({"registered": registered is not None})


@attendance_bp.get("/active-sessions")
@jwt_required()
def active_sessions():
    sessions = AttendanceSession.query.filter_by(is_active=True).all()
    now = datetime.utcnow()
    result = []
    for s in sessions:
        if s.expires_at > now:
            subject = Subject.query.get(s.subject_id)
            remaining = int((s.expires_at - now).total_seconds())
            result.append({
                "session_id": s.id,
                "subject_id": s.subject_id,
                "subject_name": subject.name if subject else "",
                "subject_code": subject.code if subject else "",
                "otp": s.otp,
                "remaining_seconds": remaining,
            })
        else:
            s.is_active = False
    db.session.commit()
    return jsonify(result)


@attendance_bp.post("/verify-otp")
@jwt_required()
@_rate_limit("10 per hour")
def verify_otp():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    data = request.get_json()
    otp = data.get("otp", "").strip()
    subject_id = data.get("subject_id")
    gps_lat = data.get("lat")
    gps_lng = data.get("lng")

    if gps_lat is None or gps_lng is None:
        return jsonify({"error": "Location access is required to mark attendance. Please enable GPS and try again."}), 400

    session = AttendanceSession.query.filter_by(
        subject_id=subject_id, is_active=True, otp=otp
    ).first()

    if not session or datetime.utcnow() > session.expires_at:
        return jsonify({"error": "Invalid OTP or the session has expired."}), 400

    geo_ok = is_within_geofence(
        gps_lat, gps_lng,
        current_app.config["COLLEGE_LAT"],
        current_app.config["COLLEGE_LNG"],
        current_app.config["COLLEGE_RADIUS_METERS"],
    )

    record = AttendanceRecord(
        student_id=identity["id"],
        subject_id=subject_id,
        status="present",
        geo_verified=geo_ok,
        liveness_passed=True,
        gps_lat=gps_lat,
        gps_lng=gps_lng,
    )
    db.session.add(record)
    db.session.commit()
    subject = Subject.query.get(subject_id)
    return jsonify({
        "message": f"Attendance marked for {subject.name}!",
        "status": "present",
        "geo_verified": geo_ok,
    })


@attendance_bp.post("/checkin")
@jwt_required()
def checkin():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    if identity["role"] != "student":
        return jsonify({"error": "Students only"}), 403

    student_id = identity["id"]
    data = request.get_json()

    image_b64 = data.get("image")           # base64 frame from mobile camera
    gps_lat = data.get("lat")
    gps_lng = data.get("lng")
    wifi_ap = data.get("wifi_ap")

    if not image_b64:
        return jsonify({"error": "Camera frame required"}), 400
    if gps_lat is None or gps_lng is None:
        return jsonify({"error": "Location access is required to mark attendance. Please enable GPS and try again."}), 400

    # 1. Determine active class
    subject = _active_subject_for_student(student_id)
    if not subject:
        return jsonify({"error": "No class scheduled right now"}), 400

    # 2. Geo-fence check
    geo_ok = is_within_geofence(
        gps_lat, gps_lng,
        current_app.config["COLLEGE_LAT"],
        current_app.config["COLLEGE_LNG"],
        current_app.config["COLLEGE_RADIUS_METERS"],
    )

    # 3. Face verification + liveness + mood
    face_result = verify_face(student_id, image_b64)
    if not face_result["match"]:
        return jsonify({"error": "Face not recognised", "details": face_result}), 401
    if not face_result["liveness"]:
        return jsonify({"error": "Liveness check failed — please blink or turn head"}), 401

    # 4. Determine attendance status
    mood = face_result.get("mood_score", 1.0)
    status = "partial" if mood < 0.4 else "present"

    record = AttendanceRecord(
        student_id=student_id,
        subject_id=subject.id,
        face_confidence_score=face_result["confidence"],
        mood_score=mood,
        liveness_passed=face_result["liveness"],
        gps_lat=gps_lat,
        gps_lng=gps_lng,
        wifi_ap_id=wifi_ap,
        geo_verified=geo_ok,
        status=status,
    )
    db.session.add(record)
    db.session.flush()   # get record.id before commit

    # 5. Anomaly detection
    anomalies = check_anomaly(record)
    if anomalies:
        record.is_anomaly = True

    db.session.commit()
    return jsonify({
        "message": "Attendance recorded",
        "status": status,
        "subject": subject.name,
        "confidence": face_result["confidence"],
        "geo_verified": geo_ok,
        "anomaly": bool(anomalies),
    })


@attendance_bp.get("/history")
@jwt_required()
def history():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    student_id = identity["id"]
    records = (
        AttendanceRecord.query
        .filter_by(student_id=student_id)
        .order_by(AttendanceRecord.timestamp.desc())
        .limit(100)
        .all()
    )
    return jsonify([r.to_dict() for r in records])


@attendance_bp.get("/percentage/<int:student_id>/<int:subject_id>")
@jwt_required()
def percentage(student_id, subject_id):
    total = AttendanceRecord.query.filter_by(student_id=student_id, subject_id=subject_id).count()
    present = AttendanceRecord.query.filter(
        AttendanceRecord.student_id == student_id,
        AttendanceRecord.subject_id == subject_id,
        AttendanceRecord.status.in_(["present", "partial"]),
    ).count()
    pct = round((present / total * 100) if total else 0, 2)
    return jsonify({"total": total, "present": present, "percentage": pct})


@attendance_bp.get("/my-subject/<int:subject_id>")
@jwt_required()
def my_subject_detail(subject_id):
    student_id = int(get_jwt_identity())
    subject = Subject.query.get_or_404(subject_id)

    records = (
        AttendanceRecord.query
        .filter_by(student_id=student_id, subject_id=subject_id)
        .order_by(AttendanceRecord.timestamp.asc())
        .all()
    )

    total = len(records)
    present = sum(1 for r in records if r.status in ("present", "partial"))
    pct = round((present / total * 100) if total else 0, 1)

    from collections import defaultdict
    monthly_map = defaultdict(lambda: {"total": 0, "present": 0})
    for r in records:
        key = r.timestamp.strftime("%b %Y")
        monthly_map[key]["total"] += 1
        if r.status in ("present", "partial"):
            monthly_map[key]["present"] += 1

    monthly = [
        {
            "month": k,
            "total": v["total"],
            "present": v["present"],
            "absent": v["total"] - v["present"],
            "percentage": round((v["present"] / v["total"] * 100) if v["total"] else 0, 1),
        }
        for k, v in monthly_map.items()
    ]

    return jsonify({
        "subject_id": subject_id,
        "subject_name": subject.name,
        "subject_code": subject.code,
        "semester": subject.semester,
        "total": total,
        "present": present,
        "absent": total - present,
        "percentage": pct,
        "monthly": monthly,
        "records": [
            {
                "date": r.timestamp.strftime("%d %b %Y"),
                "time": r.timestamp.strftime("%H:%M"),
                "status": r.status,
                "geo_verified": r.geo_verified,
                "face_confidence": round((r.face_confidence_score or 0) * 100),
            }
            for r in reversed(records)
        ],
    })


@attendance_bp.get("/my-notices")
@jwt_required()
def my_notices():
    from app.models.student import Student
    from app.models.subject import Faculty
    student_id = int(get_jwt_identity())
    student = Student.query.get_or_404(student_id)

    # Find cancellations for subjects in the student's department
    cancellations = (
        db.session.query(ClassCancellation)
        .join(Subject, Subject.id == ClassCancellation.subject_id)
        .filter(
            Subject.department == student.department,
            ClassCancellation.is_active == True,
        )
        .order_by(ClassCancellation.cancel_date.desc())
        .all()
    )

    result = []
    for c in cancellations:
        subj = Subject.query.get(c.subject_id)
        faculty = Faculty.query.get(c.faculty_id)
        result.append(c.to_dict(subject=subj, faculty=faculty))
    return jsonify(result)


@attendance_bp.get("/my-summary")
@jwt_required()
def my_summary():
    identity = {"id": int(get_jwt_identity()), "role": get_jwt().get("role")}
    student_id = identity["id"]

    subjects = Subject.query.filter_by(is_active=True).all()
    result = []
    for subject in subjects:
        total = AttendanceRecord.query.filter_by(
            student_id=student_id, subject_id=subject.id
        ).count()
        present = AttendanceRecord.query.filter(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.subject_id == subject.id,
            AttendanceRecord.status.in_(["present", "partial"]),
        ).count()
        pct = round((present / total * 100) if total else 0, 1)

        recent = (
            AttendanceRecord.query
            .filter_by(student_id=student_id, subject_id=subject.id)
            .order_by(AttendanceRecord.timestamp.desc())
            .limit(5)
            .all()
        )

        result.append({
            "subject_id": subject.id,
            "subject_name": subject.name,
            "subject_code": subject.code,
            "semester": subject.semester,
            "total_classes": total,
            "present": present,
            "absent": total - present,
            "percentage": pct,
            "recent": [
                {"date": r.timestamp.strftime("%d %b"), "status": r.status}
                for r in recent
            ],
        })

    result.sort(key=lambda x: x["percentage"])
    return jsonify(result)
