from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.student import Student
from app.models.subject import Subject
from app.models.anomaly import AnomalyFlag
from sqlalchemy import func, case, distinct
from datetime import date
import re

chatbot_bp = Blueprint("chatbot", __name__)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _threshold(q):
    m = re.search(r"(\d+)\s*%?", q)
    return int(m.group(1)) if m else 75


def _subject_name(subject_id):
    s = Subject.query.get(subject_id)
    return s.name if s else f"Subject {subject_id}"


def _per_student_rows(subject_id):
    return (
        db.session.query(
            Student.id.label("sid"),
            Student.name,
            Student.roll_number,
            func.count(AttendanceRecord.id).label("total"),
            func.sum(
                case((AttendanceRecord.status.in_(["present", "partial"]), 1), else_=0)
            ).label("present"),
        )
        .join(AttendanceRecord, AttendanceRecord.student_id == Student.id)
        .filter(AttendanceRecord.subject_id == subject_id)
        .group_by(Student.id, Student.name, Student.roll_number)
        .all()
    )


# ─── Faculty / Admin handlers ─────────────────────────────────────────────────

def _defaulters(subject_id, threshold):
    rows = _per_student_rows(subject_id)
    bad = sorted(
        [
            {
                "name": r.name,
                "roll": r.roll_number,
                "pct": round(r.present / r.total * 100, 1) if r.total else 0,
                "present": r.present,
                "total": r.total,
            }
            for r in rows
            if r.total and (r.present / r.total * 100) < threshold
        ],
        key=lambda x: x["pct"],
    )
    sname = _subject_name(subject_id)
    if not bad:
        return {"answer": f"All students in {sname} have attendance above {threshold}%. Great job!"}
    lines = [f"**{len(bad)} student(s) below {threshold}% in {sname}:**"]
    for d in bad[:12]:
        lines.append(f"• {d['name']} ({d['roll']}) — {d['pct']}% ({d['present']}/{d['total']})")
    if len(bad) > 12:
        lines.append(f"  ...and {len(bad) - 12} more.")
    return {"answer": "\n".join(lines), "type": "list", "data": bad}


def _absent_today(subject_id):
    today = date.today()
    enrolled = {
        r[0]
        for r in db.session.query(distinct(AttendanceRecord.student_id))
        .filter(AttendanceRecord.subject_id == subject_id)
        .all()
    }
    present = {
        r[0]
        for r in db.session.query(distinct(AttendanceRecord.student_id))
        .filter(
            AttendanceRecord.subject_id == subject_id,
            func.date(AttendanceRecord.timestamp) == today,
            AttendanceRecord.status.in_(["present", "partial"]),
        )
        .all()
    }
    sname = _subject_name(subject_id)
    if not enrolled:
        return {"answer": f"No attendance data found for {sname} yet."}
    today_count = (
        db.session.query(func.count(AttendanceRecord.id))
        .filter(
            AttendanceRecord.subject_id == subject_id,
            func.date(AttendanceRecord.timestamp) == today,
        )
        .scalar()
        or 0
    )
    if today_count == 0:
        return {"answer": f"No attendance session found for {sname} today."}
    absent_ids = enrolled - present
    if not absent_ids:
        return {"answer": f"100% attendance today in {sname}! Every student was present."}
    absent_students = (
        Student.query.filter(Student.id.in_(absent_ids))
        .order_by(Student.roll_number)
        .all()
    )
    lines = [f"**{len(absent_students)} student(s) absent today in {sname}:**"]
    for s in absent_students[:12]:
        lines.append(f"• {s.name} ({s.roll_number})")
    if len(absent_students) > 12:
        lines.append(f"  ...and {len(absent_students) - 12} more.")
    return {
        "answer": "\n".join(lines),
        "type": "list",
        "data": [{"name": s.name, "roll": s.roll_number} for s in absent_students],
    }


def _overview(subject_id):
    subject = Subject.query.get(subject_id)
    if not subject:
        return {"answer": "Subject not found."}
    rows = _per_student_rows(subject_id)
    if not rows:
        return {"answer": f"No attendance data for {subject.name} yet."}
    total_students = len(rows)
    tc = sum(r.total for r in rows)
    tp = sum(r.present for r in rows)
    avg_pct = round(tp / tc * 100, 1) if tc else 0.0
    sessions = (
        db.session.query(func.count(AttendanceSession.id))
        .filter(AttendanceSession.subject_id == subject_id)
        .scalar()
        or 0
    )
    below_75 = sum(1 for r in rows if r.total and (r.present / r.total * 100) < 75)
    tag = "Good" if avg_pct >= 75 else "Needs Attention"
    answer = (
        f"**{subject.name} — Overview:**\n"
        f"• Students enrolled: {total_students}\n"
        f"• Average attendance: {avg_pct}% [{tag}]\n"
        f"• Sessions held: {sessions}\n"
        f"• Students below 75%: {below_75} / {total_students}"
    )
    return {
        "answer": answer,
        "type": "stats",
        "data": {"avg_pct": avg_pct, "students": total_students, "sessions": sessions, "below_75": below_75},
    }


def _top_students(subject_id):
    rows = _per_student_rows(subject_id)
    top = sorted(
        [
            {"name": r.name, "roll": r.roll_number, "pct": round(r.present / r.total * 100, 1) if r.total else 0}
            for r in rows
            if r.total and (r.present / r.total * 100) >= 90
        ],
        key=lambda x: -x["pct"],
    )
    sname = _subject_name(subject_id)
    if not top:
        return {"answer": f"No students with 90%+ attendance in {sname} yet."}
    lines = [f"**Top students (≥90%) in {sname}:**"]
    for s in top[:10]:
        lines.append(f"• {s['name']} ({s['roll']}) — {s['pct']}%")
    return {"answer": "\n".join(lines), "type": "list", "data": top}


def _at_risk(subject_id):
    try:
        from app.services.prediction_service import predict_subject_risks
        result = predict_subject_risks(subject_id)
        high = [r for r in result if r.get("risk_level") in ("high", "medium")]
        sname = _subject_name(subject_id)
        if not high:
            return {"answer": f"No high or medium risk students found in {sname}."}
        lines = [f"**At-risk students in {sname} ({len(high)} found):**"]
        for r in high[:10]:
            level = "HIGH" if r["risk_level"] == "high" else "MED"
            lines.append(
                f"• {r.get('name', '?')} ({r.get('roll_number', '')}) [{level}] — {r.get('attendance_pct', 0):.1f}%"
            )
        return {"answer": "\n".join(lines), "type": "list", "data": high}
    except Exception:
        return {"answer": "Risk prediction service is not available right now."}


def _trends(subject_id):
    try:
        from app.services.insights_service import get_monthly_trend
        data = get_monthly_trend(subject_id)
        sname = _subject_name(subject_id)
        if not data:
            return {"answer": f"No trend data available for {sname} yet."}
        lines = [f"**Monthly Attendance Trend — {sname}:**"]
        for entry in data[-6:]:
            pct = entry.get("avg_attendance", 0)
            bar = "█" * max(1, int(pct / 10))
            lines.append(f"• {entry.get('month', '')}: {pct:.1f}%  {bar}")
        return {"answer": "\n".join(lines), "type": "trend", "data": data}
    except Exception:
        return {"answer": "Trend data is not available right now."}


def _anomalies(subject_id):
    flags = AnomalyFlag.query.filter_by(subject_id=subject_id, resolved=False).all()
    sname = _subject_name(subject_id)
    if not flags:
        return {"answer": f"No unresolved anomalies in {sname}. Clean record!"}
    lines = [f"**{len(flags)} anomaly flag(s) in {sname}:**"]
    for f in flags[:8]:
        sev = (f.severity or "").upper()
        lines.append(f"• [{sev}] {f.anomaly_type}: {f.description or ''}")
    return {"answer": "\n".join(lines), "type": "list"}


# ─── Student handlers ──────────────────────────────────────────────────────────

def _student_overall(student_id):
    rows = (
        db.session.query(
            Subject.name,
            func.count(AttendanceRecord.id).label("total"),
            func.sum(
                case((AttendanceRecord.status.in_(["present", "partial"]), 1), else_=0)
            ).label("present"),
        )
        .join(Subject, Subject.id == AttendanceRecord.subject_id)
        .filter(AttendanceRecord.student_id == student_id)
        .group_by(Subject.id, Subject.name)
        .all()
    )
    if not rows:
        return {"answer": "No attendance records found for your account yet."}
    tc = sum(r.total for r in rows)
    tp = sum(r.present for r in rows)
    overall = round(tp / tc * 100, 1) if tc else 0.0
    lines = [f"**Your Overall Attendance: {overall}%**\n"]
    for r in rows:
        pct = round(r.present / r.total * 100, 1) if r.total else 0.0
        icon = "✓" if pct >= 75 else "!"
        lines.append(f"• {r.name}: {pct}% ({r.present}/{r.total}) [{icon}]")
    return {
        "answer": "\n".join(lines),
        "type": "stats",
        "data": {"overall_pct": overall, "total_classes": tc, "attended": tp},
    }


def _student_below(student_id, threshold):
    rows = (
        db.session.query(
            Subject.name,
            func.count(AttendanceRecord.id).label("total"),
            func.sum(
                case((AttendanceRecord.status.in_(["present", "partial"]), 1), else_=0)
            ).label("present"),
        )
        .join(Subject, Subject.id == AttendanceRecord.subject_id)
        .filter(AttendanceRecord.student_id == student_id)
        .group_by(Subject.id, Subject.name)
        .all()
    )
    bad = []
    for r in rows:
        pct = round(r.present / r.total * 100, 1) if r.total else 0.0
        if pct < threshold:
            needed = (
                max(0, int((threshold * r.total - 100 * r.present) / (100 - threshold)) + 1)
                if r.total and threshold < 100
                else 0
            )
            bad.append({"subject": r.name, "pct": pct, "present": r.present, "total": r.total, "needed": needed})
    if not bad:
        return {"answer": f"You are above {threshold}% in all subjects. Keep it up!"}
    lines = [f"**Attendance shortage in {len(bad)} subject(s):**"]
    for b in bad:
        lines.append(f"• {b['subject']}: {b['pct']}% ({b['present']}/{b['total']} classes)")
        if b["needed"] > 0:
            lines.append(f"  → Attend {b['needed']} more consecutive class(es) to reach {threshold}%")
    return {"answer": "\n".join(lines), "type": "list", "data": bad}


def _student_today(student_id):
    today = date.today()
    records = AttendanceRecord.query.filter(
        AttendanceRecord.student_id == student_id,
        func.date(AttendanceRecord.timestamp) == today,
    ).all()
    if not records:
        return {"answer": "You have no attendance records for today yet."}
    subject_ids = [r.subject_id for r in records]
    subjects = {s.id: s.name for s in Subject.query.filter(Subject.id.in_(subject_ids)).all()}
    lines = [f"**Your attendance today ({today.strftime('%d %b %Y')}):**"]
    for r in records:
        sname = subjects.get(r.subject_id, f"Subject {r.subject_id}")
        lines.append(f"• {sname}: {r.status.capitalize()}")
    return {"answer": "\n".join(lines), "type": "list"}


# ─── Intent detection ──────────────────────────────────────────────────────────

def _detect_faculty_intent(q):
    if any(kw in q for kw in ["below", "defaulter", "low attendance", "shortage", "failing", "less than", "under", "poor attendance"]):
        return "defaulters"
    if ("absent" in q and "today" in q) or ("who" in q and "today" in q and "not" in q):
        return "absent_today"
    if "today" in q and any(kw in q for kw in ["who", "absent", "miss", "attendance"]):
        return "absent_today"
    if any(kw in q for kw in ["trend", "monthly", "month", "over time", "history", "graph"]):
        return "trends"
    if any(kw in q for kw in ["at risk", "risk", "predict", "danger", "warning", "might fail"]):
        return "at_risk"
    if any(kw in q for kw in ["best", "top", "highest", "100", "perfect", "excellent"]):
        return "top_students"
    if any(kw in q for kw in ["anomal", "suspicious", "fraud", "fake", "proxy", "cheat"]):
        return "anomalies"
    if any(kw in q for kw in ["overview", "summary", "how many", "stats", "status", "how is", "report"]):
        return "overview"
    if "attendance" in q or "%" in q or "percent" in q:
        return "overview"
    return "unknown"


def _detect_student_intent(q):
    if any(kw in q for kw in ["below", "shortage", "failing", "low", "less than", "at risk", "danger"]):
        return "student_below"
    if "today" in q:
        return "student_today"
    return "student_overall"


# ─── Main route ───────────────────────────────────────────────────────────────

@chatbot_bp.post("")
@jwt_required()
def chatbot():
    identity_id = int(get_jwt_identity())
    role = get_jwt().get("role", "student")
    body = request.get_json() or {}
    query = body.get("query", "").strip()
    subject_id = body.get("subject_id")
    if subject_id:
        try:
            subject_id = int(subject_id)
        except (ValueError, TypeError):
            subject_id = None

    if not query:
        return jsonify({"answer": "Please type a question."})

    q = query.lower()

    # ── Student ───────────────────────────────────────────────────────────────
    if role == "student":
        intent = _detect_student_intent(q)
        threshold = _threshold(q) if any(kw in q for kw in ["below", "%", "percent"]) else 75
        if intent == "student_below":
            return jsonify(_student_below(identity_id, threshold))
        if intent == "student_today":
            return jsonify(_student_today(identity_id))
        return jsonify(_student_overall(identity_id))

    # ── Faculty / Admin ───────────────────────────────────────────────────────
    if role not in ("faculty", "admin"):
        return jsonify({"answer": "Access denied."}), 403

    intent = _detect_faculty_intent(q)
    threshold = _threshold(q) if intent == "defaulters" else 75

    if not subject_id and intent != "unknown":
        return jsonify({"answer": "Please select a subject from the dropdown above to get specific information."})

    handlers = {
        "defaulters":   lambda: _defaulters(subject_id, threshold),
        "absent_today": lambda: _absent_today(subject_id),
        "trends":       lambda: _trends(subject_id),
        "at_risk":      lambda: _at_risk(subject_id),
        "top_students": lambda: _top_students(subject_id),
        "anomalies":    lambda: _anomalies(subject_id),
        "overview":     lambda: _overview(subject_id),
    }

    handler = handlers.get(intent)
    if handler:
        return jsonify(handler())

    suggestions = (
        "• 'Show students below 75%'\n"
        "• 'Who was absent today?'\n"
        "• 'Show at-risk students'\n"
        "• 'Monthly trends'\n"
        "• 'Subject overview'\n"
        "• 'Top students'\n"
        "• 'Show anomalies'"
    )
    return jsonify({"answer": f"I didn't understand that. Try:\n{suggestions}", "type": "text"})
