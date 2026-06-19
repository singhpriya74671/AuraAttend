from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import generate_password_hash, check_password_hash
from app import db
from app.models.student import Student
from app.models.subject import Faculty
from app.models.password_reset import PasswordResetOTP
import random, datetime

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/login")
def login():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request."}), 400

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role_hint = data.get("role", "admin")

    if not email:
        return jsonify({"error": "Email is required."}), 400
    if not password:
        return jsonify({"error": "Password is required."}), 400

    if role_hint == "student":
        if "@" in email:
            user = Student.query.filter_by(email=email).first()
        else:
            user = Student.query.filter_by(roll_number=email).first()
        if user is None:
            return jsonify({"error": "No account found. Check your email / roll number."}), 404

        # If account was auto-created without a password, let them set one
        if user.password_hash:
            if not check_password_hash(user.password_hash, password):
                return jsonify({"error": "Incorrect password. Please try again."}), 401

        role = "student"
    else:
        user = Faculty.query.filter_by(email=email).first()
        if user is None:
            return jsonify({"error": "No account found with this email. Please register or contact your admin."}), 404

        if user.password_hash:
            if not check_password_hash(user.password_hash, password):
                return jsonify({"error": "Incorrect password. Please try again."}), 401

        role = getattr(user, "role", "faculty")

    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": role},
    )
    return jsonify({
        "access_token": token,
        "role": role,
        "name": user.name,
        "email": user.email,
    })


@auth_bp.post("/register/student")
def register_student():
    data = request.get_json()

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    name = data.get("name", "").strip()
    roll_number = data.get("roll_number", "").strip()

    if not name or not email or not roll_number or not password:
        return jsonify({"error": "All fields are required."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    if Student.query.filter_by(email=email).first():
        return jsonify({"error": "This email is already registered. Please sign in."}), 409
    if Student.query.filter_by(roll_number=roll_number).first():
        return jsonify({"error": "This roll number is already registered."}), 409

    student = Student(
        roll_number=roll_number,
        name=name,
        email=email,
        parent_email=data.get("parent_email"),
        phone=data.get("phone"),
        department=data.get("department", "ECE-AI"),
        semester=data.get("semester", 1),
        password_hash=generate_password_hash(password),
    )
    db.session.add(student)
    db.session.commit()

    # Register face embeddings from all provided angles
    face_images = data.get("face_images", [])
    face_registered = False
    if face_images:
        from app.services.face_service import register_face
        success_count = 0
        for img_b64 in face_images:
            result = register_face(student.id, img_b64, replace=False)
            if result.get("success"):
                success_count += 1
        face_registered = success_count > 0

    # Auto-login: return a token so the frontend can log in immediately
    token = create_access_token(
        identity=str(student.id),
        additional_claims={"role": "student"},
    )
    return jsonify({
        "message": "Registration successful!",
        "id": student.id,
        "face_registered": face_registered,
        "access_token": token,
        "role": "student",
        "name": student.name,
        "email": student.email,
    }), 201


@auth_bp.post("/register/faculty")
def register_faculty():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    name = data.get("name", "").strip()
    department = data.get("department", "").strip()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400
    if Faculty.query.filter_by(email=email).first():
        return jsonify({"error": "This email is already registered. Please sign in."}), 409

    # First registered faculty automatically becomes admin
    no_admin_exists = Faculty.query.filter_by(role="admin").count() == 0
    faculty = Faculty(
        name=name,
        email=email,
        department=department or "General",
        role="admin" if no_admin_exists else "faculty",
        password_hash=generate_password_hash(password),
    )
    db.session.add(faculty)
    db.session.commit()
    assigned_role = faculty.role
    return jsonify({
        "message": f"Registered successfully as {'Admin' if assigned_role == 'admin' else 'Faculty'}! You can now sign in.",
        "id": faculty.id,
        "role": assigned_role,
    }), 201


@auth_bp.post("/change-password")
@jwt_required()
def change_password():
    data = request.get_json()
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    if not current_password:
        return jsonify({"error": "Current password is required."}), 400
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters."}), 400

    user_id = int(get_jwt_identity())
    role = get_jwt().get("role")

    if role == "student":
        user = Student.query.get(user_id)
    else:
        user = Faculty.query.get(user_id)

    if not user:
        return jsonify({"error": "Account not found."}), 404

    if user.password_hash and not check_password_hash(user.password_hash, current_password):
        return jsonify({"error": "Current password is incorrect."}), 401

    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({"message": "Password changed successfully."})


@auth_bp.post("/forgot-password")
def forgot_password():
    email = request.get_json().get("email", "").strip().lower()
    user = Student.query.filter_by(email=email).first() or Faculty.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "No account found with this email address."}), 404

    otp = str(random.randint(100000, 999999))
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)

    # Invalidate any existing OTPs for this email, then persist the new one
    PasswordResetOTP.query.filter_by(email=email, used=False).delete()
    db.session.add(PasswordResetOTP(email=email, otp=otp, expires_at=expires_at))
    db.session.commit()

    mail_sent = False
    try:
        from app import mail
        from flask_mail import Message
        msg = Message(
            subject="AuraAttend — Password Reset OTP",
            sender=current_app.config["MAIL_DEFAULT_SENDER"],
            recipients=[email],
            body=f"Hello,\n\nYour OTP for password reset is: {otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.\n\n— AuraAttend Team",
        )
        mail.send(msg)
        mail_sent = True
        print(f"[MAIL] OTP sent to {email}")
    except Exception as e:
        print(f"[MAIL ERROR] {e}")
        print(f"[DEV] Password reset OTP for {email}: {otp}")

    if mail_sent:
        return jsonify({"message": "OTP sent to your email."})
    else:
        return jsonify({"message": "OTP generated. Email delivery failed — please contact admin to get your OTP.", "dev_otp": otp})


@auth_bp.post("/reset-password")
def reset_password():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    otp = data.get("otp", "").strip()
    new_password = data.get("new_password", "")

    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    record = PasswordResetOTP.query.filter_by(email=email, used=False)\
        .order_by(PasswordResetOTP.created_at.desc()).first()
    if not record:
        return jsonify({"error": "No OTP requested for this email."}), 400

    if datetime.datetime.utcnow() > record.expires_at:
        record.used = True
        db.session.commit()
        return jsonify({"error": "OTP has expired. Please request a new one."}), 400

    if otp != record.otp:
        return jsonify({"error": "Incorrect OTP. Please try again."}), 400

    user = Student.query.filter_by(email=email).first() or Faculty.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "Account not found."}), 404

    user.password_hash = generate_password_hash(new_password)
    record.used = True
    db.session.commit()
    return jsonify({"message": "Password reset successfully."})


@auth_bp.get("/me")
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    role = get_jwt().get("role")
    if role == "student":
        user = Student.query.get(user_id)
    else:
        user = Faculty.query.get(user_id)
    return jsonify(user.to_dict())
