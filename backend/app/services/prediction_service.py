import numpy as np
import json
import os
import pickle
from datetime import datetime, timedelta
from app import db
from app.models.attendance import AttendanceRecord
from app.models.student import Student

MODEL_PATH = os.path.join(os.path.dirname(__file__), "rf_model.pkl")


def _get_student_features(student_id: int, subject_id: int) -> dict | None:
    records = (
        AttendanceRecord.query
        .filter_by(student_id=student_id, subject_id=subject_id)
        .order_by(AttendanceRecord.timestamp.desc())
        .all()
    )
    if not records:
        return None

    present_statuses = {"present", "partial"}
    total = len(records)
    present = sum(1 for r in records if r.status in present_statuses)
    attendance_pct = present / total if total else 0

    recent = records[:5]
    recent_present = sum(1 for r in recent if r.status in present_statuses)
    recent_pct = recent_present / len(recent) if recent else 0

    consecutive_absences = 0
    for r in records:
        if r.status not in present_statuses:
            consecutive_absences += 1
        else:
            break

    last_present = next((r for r in records if r.status in present_statuses), None)
    days_since_last = (datetime.utcnow() - last_present.timestamp).days if last_present else 30

    if total >= 4:
        first_half = records[total // 2:]
        second_half = records[:total // 2]
        first_pct = sum(1 for r in first_half if r.status in present_statuses) / len(first_half)
        second_pct = sum(1 for r in second_half if r.status in present_statuses) / len(second_half)
        trend = second_pct - first_pct
    else:
        trend = 0

    avg_confidence = sum((r.face_confidence_score or 0) for r in records) / total

    return {
        "attendance_pct": attendance_pct,
        "recent_pct": recent_pct,
        "consecutive_absences": min(consecutive_absences, 10),
        "days_since_last": min(days_since_last, 30),
        "trend": trend,
        "total_classes": total,
        "avg_confidence": avg_confidence,
    }


def _features_to_vector(f: dict) -> list:
    return [
        f["attendance_pct"],
        f["recent_pct"],
        f["consecutive_absences"] / 10,
        f["days_since_last"] / 30,
        (f["trend"] + 1) / 2,
        min(f["total_classes"] / 20, 1.0),
        f["avg_confidence"],
    ]


def _build_training_data():
    """Generate synthetic + real training data for the RF model."""
    from app.models.subject import Subject
    X, y = [], []

    subjects = Subject.query.filter_by(is_active=True).all()
    for subject in subjects:
        student_ids = (
            db.session.query(AttendanceRecord.student_id)
            .filter_by(subject_id=subject.id)
            .distinct().all()
        )
        for (sid,) in student_ids:
            features = _get_student_features(sid, subject.id)
            if features and features["total_classes"] >= 3:
                vec = _features_to_vector(features)
                label = 1 if features["attendance_pct"] < 0.75 else 0
                X.append(vec)
                y.append(label)

    # Augment with synthetic examples so model always has data to train on
    rng = np.random.default_rng(42)
    for _ in range(200):
        att = rng.uniform(0.3, 1.0)
        rec = max(0, att + rng.uniform(-0.2, 0.2))
        cons = rng.integers(0, 6) / 10
        days = rng.uniform(0, 1)
        trend = rng.uniform(0, 1)
        total = rng.uniform(0.1, 1.0)
        conf = rng.uniform(0.5, 1.0)
        vec = [att, min(rec, 1), cons, days, trend, total, conf]
        label = 1 if att < 0.75 else 0
        X.append(vec)
        y.append(label)

    return np.array(X), np.array(y)


def _get_or_train_model():
    """Load saved model or train a new one."""
    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.preprocessing import StandardScaler
        from sklearn.pipeline import Pipeline
    except ImportError:
        return None

    if os.path.exists(MODEL_PATH):
        try:
            with open(MODEL_PATH, "rb") as f:
                return pickle.load(f)
        except Exception:
            pass

    X, y = _build_training_data()
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("rf", RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42, class_weight="balanced")),
    ])
    model.fit(X, y)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    return model


def _compute_risk_score(features: dict, model=None) -> float:
    if model is not None:
        try:
            vec = np.array([_features_to_vector(features)])
            proba = model.predict_proba(vec)[0]
            # proba[1] = probability of being at-risk
            return round(float(proba[1]), 3)
        except Exception:
            pass

    # Fallback rule-based
    score = 0.0
    score += (1 - features["attendance_pct"]) * 0.40
    score += (1 - features["recent_pct"]) * 0.30
    score += min(features["consecutive_absences"] / 10, 1.0) * 0.15
    score += min(features["days_since_last"] / 14, 1.0) * 0.10
    if features["trend"] < 0:
        score += abs(features["trend"]) * 0.05
    return round(min(score, 1.0), 3)


def predict_subject_risks(subject_id: int) -> list:
    from app.models.subject import Subject
    model = _get_or_train_model()

    student_ids = (
        db.session.query(AttendanceRecord.student_id)
        .filter_by(subject_id=subject_id)
        .distinct().all()
    )

    results = []
    for (sid,) in student_ids:
        student = Student.query.get(sid)
        if not student or not student.is_active:
            continue
        features = _get_student_features(sid, subject_id)
        if not features or features["total_classes"] < 2:
            continue

        risk = _compute_risk_score(features, model)
        if risk < 0.25:
            risk_level = "safe"
        elif risk < 0.50:
            risk_level = "low"
        elif risk < 0.70:
            risk_level = "medium"
        else:
            risk_level = "high"

        results.append({
            "student_id": sid,
            "student_name": student.name,
            "roll_number": student.roll_number,
            "attendance_pct": round(features["attendance_pct"] * 100, 1),
            "recent_pct": round(features["recent_pct"] * 100, 1),
            "consecutive_absences": features["consecutive_absences"],
            "trend": round(features["trend"] * 100, 1),
            "risk_score": risk,
            "risk_level": risk_level,
            "model": "RandomForest" if model else "RuleBase",
        })

    results.sort(key=lambda x: -x["risk_score"])
    return results


def predict_all_subjects() -> list:
    from app.models.subject import Subject
    subjects = Subject.query.filter_by(is_active=True).all()
    all_risks = []
    for subject in subjects:
        risks = predict_subject_risks(subject.id)
        for r in risks:
            if r["risk_level"] in ("medium", "high"):
                r["subject_name"] = subject.name
                r["subject_code"] = subject.code
                r["subject_id"] = subject.id
                all_risks.append(r)
    all_risks.sort(key=lambda x: -x["risk_score"])
    return all_risks


def retrain_model():
    """Force retrain and save the model."""
    if os.path.exists(MODEL_PATH):
        os.remove(MODEL_PATH)
    return _get_or_train_model() is not None
