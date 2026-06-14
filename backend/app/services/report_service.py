from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from app import db
from app.models.student import Student
from app.models.subject import Subject
from app.models.attendance import AttendanceRecord
from sqlalchemy import func, case
import io


def generate_pdf_report(subject_id: int) -> bytes:
    subject = Subject.query.get(subject_id)
    rows = (
        db.session.query(
            Student.roll_number,
            Student.name,
            func.count(AttendanceRecord.id).label("total"),
            func.sum(case((AttendanceRecord.status.in_(["present", "partial"]), 1), else_=0)).label("present"),
        )
        .join(AttendanceRecord, AttendanceRecord.student_id == Student.id)
        .filter(AttendanceRecord.subject_id == subject_id)
        .group_by(Student.id)
        .all()
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph(f"Attendance Report — {subject.name} ({subject.code})", styles["Title"]))
    story.append(Spacer(1, 0.5 * cm))

    table_data = [["Roll No.", "Name", "Total Classes", "Present", "Percentage"]]
    for r in rows:
        pct = f"{(r.present / r.total * 100):.1f}%" if r.total else "0%"
        table_data.append([r.roll_number, r.name, str(r.total), str(r.present), pct])

    t = Table(table_data, colWidths=[3 * cm, 6 * cm, 3 * cm, 3 * cm, 3 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
    ]))
    story.append(t)
    doc.build(story)
    return buf.getvalue()
