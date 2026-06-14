from app.models.student import Student, FaceEmbedding
from app.models.subject import Subject, Timetable
from app.models.attendance import AttendanceRecord
from app.models.anomaly import AnomalyFlag, AlertSent

__all__ = [
    "Student", "FaceEmbedding",
    "Subject", "Timetable",
    "AttendanceRecord",
    "AnomalyFlag", "AlertSent",
]
