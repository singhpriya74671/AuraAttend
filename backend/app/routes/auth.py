from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import generate_password_hash, check_password_hash
from app import db
from app.models.student import Student
from app.models.subject import Faculty
import random, datetime

# In-memory OTP store: { email: (otp, expires_at) }
_reset_otps = {}

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/login")
def login():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    role_hint = data.get("role", "admin")  # "student" or "admin"/"faculty"
    name = email.split("@")[0].replace(".", " ").replace("_", " ").title()

    if role_hint == "student":
        user = Student.query.filter_by(email=email).first()
        role = "student"
        if user is None:
            username_part = email.split("@")[0][:10].upper().replace(".", "").replace("_", "")
            roll_number = f"ST{username_part}"
            user = Student(
                roll_number=roll_number,
                name=name,
                email=email,
                department="General",
                semester=1,
                password_hash="",
            )
            db.session.add(user)
            db.session.commit()
    else:
        user = Faculty.query.filter_by(email=email).first()
        role = getattr(user, "role", "admin") if user else None
        if user is None:
            # Also check if it's a student trying to log in as faculty
            user = Student.query.filter_by(email=email).first()
            if user:
                role = "student"
            else:
                user = Faculty(
                    name=name,
                    email=email,
                    role="admin",
                    department="General",
                    password_hash="",
                )
                db.session.add(user)
                db.session.commit()
                role = "admin"

    token = create_access_token(identity=str(user.id), additional_claims={"role": role})
    return jsonify({"access_token": token, "role": role, "name": user.name})


@auth_bp.post("/register/student")
def register_student():
    data = request.get_json()
    if Student.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "This email is already registered. Please sign in."}), 409
    if Student.query.filter_by(roll_number=data["roll_number"]).first():
        return jsonify({"error": "This roll number is already registered."}), 409

    student = Student(
        roll_number=data["roll_number"],
        name=data["name"],
        email=data["email"].lower(),
        parent_email=data.get("parent_email"),
        phone=data.get("phone"),
        department=data.get("department", "ECE-AI"),
        semester=data.get("semester", 1),
        password_hash=generate_password_hash(data["password"]),
    )
    db.session.add(student)
    db.session.commit()

    # Register face embeddings from all provided angles
    face_images = data.get("face_images", [])
    if face_images:
        from app.services.face_service import register_face
        success_count = 0
        for img_b64 in face_images:
            result = register_face(student.id, img_b64, replace=False)
            if result.get("success"):
                success_count += 1
        if success_count == 0:
            return jsonify({
                "message": "Account created but face registration failed. Please register Face ID from your dashboard.",
                "id": student.id,
                "face_registered": False,
            }), 201

    return jsonify({
        "message": "Registration successful!",
        "id": student.id,
        "face_registered": len(face_images) > 0,
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

    faculty = Faculty(
        name=name,
        email=email,
        department=department or "General",
        role="faculty",
        password_hash=generate_password_hash(password),
    )
    db.session.add(faculty)
    db.session.commit()
    return jsonify({"message": "Faculty registered successfully!", "id": faculty.id}), 201


@auth_bp.post("/forgot-password")
def forgot_password():
    email = request.get_json().get("email", "").strip().lower()
    user = Student.query.filter_by(email=email).first() or Faculty.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "No account found with this email address."}), 404

    otp = str(random.randint(100000, 999999))
    _reset_otps[email] = (otp, datetime.datetime.utcnow() + datetime.timedelta(minutes=10))

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
        print(f"[MAIL] OTP sent to {email}")
    except Exception as e:
        print(f"[MAIL ERROR] {e}")
        print(f"[DEV] Password reset OTP for {email}: {otp}")

    return jsonify({"message": "OTP sent to your email."})


@auth_bp.post("/reset-password")
def reset_password():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    otp = data.get("otp", "").strip()
    new_password = data.get("new_password", "")

    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    stored = _reset_otps.get(email)
    if not stored:
        return jsonify({"error": "No OTP requested for this email."}), 400

    stored_otp, expires_at = stored
    if datetime.datetime.utcnow() > expires_at:
        del _reset_otps[email]
        return jsonify({"error": "OTP has expired. Please request a new one."}), 400

    if otp != stored_otp:
        return jsonify({"error": "Incorrect OTP. Please try again."}), 400

    # Update password
    user = Student.query.filter_by(email=email).first() or Faculty.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "Account not found."}), 404

    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    del _reset_otps[email]
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
