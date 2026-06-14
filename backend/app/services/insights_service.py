from datetime import datetime, timedelta
from sqlalchemy import func, case, extract
from app import db
from app.models.attendance import AttendanceRecord
from app.models.subject import Subject, Faculty
from app.models.student import Student


def get_monthly_trend(subject_id: int, months: int = 6) -> list:
    results = []
    now = datetime.utcnow()
    for i in range(months - 1, -1, -1):
        start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
        end = (start + timedelta(days=32)).replace(day=1)
        total = AttendanceRecord.query.filter(
            AttendanceRecord.subject_id == subject_id,
            AttendanceRecord.timestamp >= start,
            AttendanceRecord.timestamp < end,
        ).count()
        present = AttendanceRecord.query.filter(
            AttendanceRecord.subject_id == subject_id,
            AttendanceRecord.timestamp >= start,
            AttendanceRecord.timestamp < end,
            AttendanceRecord.status.in_(["present", "partial"]),
        ).count()
        pct = round((present / total * 100) if total else 0, 1)
        results.append({
            "month": start.strftime("%b %Y"),
            "total": total,
            "present": present,
            "percentage": pct,
        })
    return results


def get_department_stats() -> list:
    subjects = Subject.query.filter_by(is_active=True).all()
    dept_map = {}
    for subject in subjects:
        dept = subject.department or "General"
        total = AttendanceRecord.query.filter_by(subject_id=subject.id).count()
        present = AttendanceRecord.query.filter(
            AttendanceRecord.subject_id == subject.id,
            AttendanceRecord.status.in_(["present", "partial"]),
        ).count()
        if dept not in dept_map:
            dept_map[dept] = {"total": 0, "present": 0, "subjects": 0}
        dept_map[dept]["total"] += total
        dept_map[dept]["present"] += present
        dept_map[dept]["subjects"] += 1

    result = []
    for dept, data in dept_map.items():
        pct = round((data["present"] / data["total"] * 100) if data["total"] else 0, 1)
        result.append({
            "department": dept,
            "subjects": data["subjects"],
            "total_records": data["total"],
            "present": data["present"],
            "percentage": pct,
        })
    return sorted(result, key=lambda x: -x["percentage"])


def get_defaulter_heatmap(subject_id: int) -> list:
    rows = (
        db.session.query(
            func.date(AttendanceRecord.timestamp).label("date"),
            func.count(AttendanceRecord.id).label("total"),
            func.sum(case((AttendanceRecord.status.in_(["present", "partial"]), 1), else_=0)).label("present"),
        )
        .filter(AttendanceRecord.subject_id == subject_id)
        .group_by(func.date(AttendanceRecord.timestamp))
        .order_by(func.date(AttendanceRecord.timestamp))
        .all()
    )
    return [{"date": str(r.date), "total": r.total, "present": r.present,
             "absent": r.total - r.present} for r in rows]


def generate_ai_insights(subject_id: int) -> dict:
    subject = Subject.query.get(subject_id)
    if not subject:
        return {"summary": "Subject not found."}

    monthly = get_monthly_trend(subject_id, months=3)
    if len(monthly) < 2:
        return {
            "summary": f"Insufficient data for {subject.name}. Collect more attendance records to generate AI insights.",
            "monthly": monthly,
        }

    latest_pct = monthly[-1]["percentage"]
    prev_pct = monthly[-2]["percentage"]
    change = round(latest_pct - prev_pct, 1)

    from app.models.attendance import AttendanceRecord
    low_students = (
        db.session.query(
            Student.name,
            func.count(AttendanceRecord.id).label("total"),
            func.sum(case((AttendanceRecord.status.in_(["present", "partial"]), 1), else_=0)).label("present"),
        )
        .join(AttendanceRecord, AttendanceRecord.student_id == Student.id)
        .filter(AttendanceRecord.subject_id == subject_id)
        .group_by(Student.id)
        .having(
            func.sum(case((AttendanceRecord.status.in_(["present", "partial"]), 1), else_=0)) * 100.0 /
            func.count(AttendanceRecord.id) < 75
        )
        .count()
    )

    # Build natural-language summary
    trend_text = f"improved by {change}%" if change > 0 else f"declined by {abs(change)}%" if change < 0 else "remained stable"
    status_text = "good" if latest_pct >= 75 else "below the required threshold"

    summary = (
        f"Attendance in {subject.name} ({subject.code}) is currently at {latest_pct}%, which is {status_text}. "
        f"Compared to last month, attendance has {trend_text}. "
    )
    if low_students > 0:
        summary += f"{low_students} student(s) have attendance below 75% and should be contacted. "
    if change < -5:
        summary += "A significant drop has been observed — consider sending reminders to students. "
    if latest_pct >= 85:
        summary += "Overall engagement is excellent. Keep up the good work!"

    return {
        "subject": subject.name,
        "current_percentage": latest_pct,
        "trend_change": change,
        "low_attendance_students": low_students,
        "summary": summary,
        "monthly": monthly,
    }
