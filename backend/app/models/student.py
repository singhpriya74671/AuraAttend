from app import db
from datetime import datetime


class Student(db.Model):
    __tablename__ = "students"

    id = db.Column(db.Integer, primary_key=True)
    roll_number = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    parent_email = db.Column(db.String(120))
    phone = db.Column(db.String(15))
    department = db.Column(db.String(50))
    semester = db.Column(db.Integer)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    password_hash = db.Column(db.String(256))

    embeddings = db.relationship("FaceEmbedding", backref="student", lazy=True)
    attendance_records = db.relationship("AttendanceRecord", backref="student", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "roll_number": self.roll_number,
            "name": self.name,
            "email": self.email,
            "department": self.department,
            "semester": self.semester,
        }


class FaceEmbedding(db.Model):
    __tablename__ = "face_embeddings"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    embedding = db.Column(db.Text, nullable=False)  # JSON-serialised 128-d vector
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_primary = db.Column(db.Boolean, default=True)
