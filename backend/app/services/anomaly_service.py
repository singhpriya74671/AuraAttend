from datetime import datetime, timedelta
from app import db
from app.models.attendance import AttendanceRecord
from app.models.anomaly import AnomalyFlag
from sklearn.ensemble import IsolationForest
import numpy as np


def check_anomaly(record: AttendanceRecord) -> list[AnomalyFlag]:
    flags = []

    # Rule 1: entire class checked in within 10 seconds (bulk proxy)
    window_start = record.timestamp - timedelta(seconds=10)
    bulk_count = AttendanceRecord.query.filter(
        AttendanceRecord.subject_id == record.subject_id,
        AttendanceRecord.timestamp >= window_start,
        AttendanceRecord.timestamp <= record.timestamp,
    ).count()
    if bulk_count > 5:
        flags.append(_create_flag(record, "bulk_checkin",
                                  f"{bulk_count} students checked in within 10 seconds", "high"))

    # Rule 2: geo-fence failed
    if not record.geo_verified:
        flags.append(_create_flag(record, "geo_mismatch",
                                  "Student GPS is outside campus boundary", "high"))

    # Rule 3: liveness failed
    if not record.liveness_passed:
        flags.append(_create_flag(record, "liveness_fail",
                                  "Liveness check did not pass", "medium"))

    # Rule 4: duplicate check-in within same class slot (< 1 h apart)
    recent = AttendanceRecord.query.filter(
        AttendanceRecord.student_id == record.student_id,
        AttendanceRecord.subject_id == record.subject_id,
        AttendanceRecord.id != record.id,
        AttendanceRecord.timestamp >= record.timestamp - timedelta(hours=1),
    ).count()
    if recent > 0:
        flags.append(_create_flag(record, "duplicate_checkin",
                                  "Student already checked in for this class within 1 hour", "medium"))

    for flag in flags:
        db.session.add(flag)

    return flags


def _create_flag(record: AttendanceRecord, atype: str, desc: str, severity: str) -> AnomalyFlag:
    return AnomalyFlag(
        attendance_record_id=record.id,
        student_id=record.student_id,
        subject_id=record.subject_id,
        anomaly_type=atype,
        description=desc,
        severity=severity,
    )


def train_isolation_forest(subject_id: int):
    """Train and return an IsolationForest on historical attendance features."""
    records = AttendanceRecord.query.filter_by(subject_id=subject_id).all()
    if len(records) < 20:
        return None

    features = np.array([
        [
            r.face_confidence_score or 0,
            r.mood_score or 1,
            int(r.geo_verified),
            r.timestamp.hour,
            r.timestamp.weekday(),
        ]
        for r in records
    ])

    clf = IsolationForest(contamination=0.05, random_state=42)
    clf.fit(features)
    return clf
