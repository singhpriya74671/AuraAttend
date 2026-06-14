"""Run once to seed subjects into the database: python seed.py"""
from app import create_app, db
from app.models.subject import Subject, Faculty

SUBJECTS = [
    # ── First Year ──────────────────────────────────────────────────────────
    # Semester 1
    {"code": "BEC-101", "name": "Analog Electronics",              "semester": 1},
    {"code": "BEC-110", "name": "Basic Electrical Engineering",    "semester": 1},
    {"code": "BCS-110", "name": "Programming in C Language",       "semester": 1},
    {"code": "BAI-101", "name": "Intelligent Systems",             "semester": 1},
    {"code": "BAS-109", "name": "Applied Mathematics",             "semester": 1},
    {"code": "HMC-110", "name": "Communication Skills",            "semester": 1},
    # Semester 2
    {"code": "BEC-104", "name": "Digital Electronics",             "semester": 2},
    {"code": "BEC-106", "name": "Signals and Systems",             "semester": 2},
    {"code": "BAI-110", "name": "Programming with Python",         "semester": 2},
    {"code": "BAS-106", "name": "Environmental Sciences",          "semester": 2},
    {"code": "BAS-108", "name": "Probability and Statistics",      "semester": 2},
    {"code": "BAI-108", "name": "IT Workshop",                     "semester": 2},

    # ── Second Year ─────────────────────────────────────────────────────────
    # Semester 3
    {"code": "BEC-205", "name": "Network Analysis and Synthesis",          "semester": 3},
    {"code": "BEC-211", "name": "Communication Systems",                   "semester": 3},
    {"code": "BAI-205", "name": "Neural Networks and Artificial Intelligence", "semester": 3},
    {"code": "BCS-201", "name": "Data Structures",                         "semester": 3},
    {"code": "GEC-201", "name": "Generic Open Elective",                   "semester": 3},
    {"code": "BEC-253", "name": "Industrial Training / Internship",        "semester": 3},
    {"code": "BAS-201", "name": "Open Elective Course",                    "semester": 3},
    # Semester 4
    {"code": "BEC-202", "name": "Linear Integrated Circuits",                      "semester": 4},
    {"code": "BEC-206", "name": "Electromagnetic Field Theory",                     "semester": 4},
    {"code": "BEC-210", "name": "Digital Communication Systems",                    "semester": 4},
    {"code": "BAI-204", "name": "Optimization Techniques and Decision Making",      "semester": 4},
    {"code": "BCS-202", "name": "Computer Organization and Architecture",           "semester": 4},
    {"code": "HMC-202", "name": "Disaster Management",                              "semester": 4},

    # ── Third Year ──────────────────────────────────────────────────────────
    # Semester 5
    {"code": "BEC-303", "name": "Control Systems",                        "semester": 5},
    {"code": "BEC-311", "name": "Digital Signal Processing",               "semester": 5},
    {"code": "BAI-301", "name": "Machine Learning",                        "semester": 5},
    {"code": "BAI-307", "name": "Computer Networks",                       "semester": 5},
    {"code": "HMC-301", "name": "Professional Ethics and Human Values",    "semester": 5},
    {"code": "BEC-353", "name": "Industrial Training / Internship",        "semester": 5},
    {"code": "GEC-301", "name": "Generic Open Elective",                   "semester": 5},
    # Semester 6
    {"code": "BEC-306", "name": "VLSI Design",                             "semester": 6},
    {"code": "BEC-308", "name": "Microprocessors and Microcontrollers",    "semester": 6},
    {"code": "BEC-318", "name": "Digital Image Processing",                "semester": 6},
    {"code": "DEC-301", "name": "Departmental Elective Course 1",          "semester": 6},
    {"code": "DEC-302", "name": "Departmental Elective Course 2",          "semester": 6},
    {"code": "HMC-302", "name": "Principles of Management",                "semester": 6},

    # ── Fourth Year ─────────────────────────────────────────────────────────
    # Semester 7
    {"code": "BEC-403", "name": "Wireless and Mobile Communication",    "semester": 7},
    {"code": "BAI-417", "name": "Multimodal Data Analysis",             "semester": 7},
    {"code": "BAI-413", "name": "Deep Learning",                        "semester": 7},
    {"code": "DEC-401", "name": "Departmental Elective Course 3",       "semester": 7},
    {"code": "DEC-402", "name": "Departmental Elective Course 4",       "semester": 7},
    {"code": "BAI-451", "name": "Minor Project",                        "semester": 7},
    {"code": "BEC-453", "name": "Industrial Training / Internship",     "semester": 7},
    # Semester 8
    {"code": "BAI-418", "name": "Recent Trends in AI",                  "semester": 8},
    {"code": "DEC-403", "name": "Departmental Elective Course 5",       "semester": 8},
    {"code": "DEC-404", "name": "Departmental Elective Course 6",       "semester": 8},
    {"code": "BAI-452", "name": "Major Project / R&D / Start-up",       "semester": 8},
    {"code": "GEC-402", "name": "Generic Open Elective",                "semester": 8},
]


def seed():
    app = create_app()
    with app.app_context():
        # Delete dependent records first, then subjects
        from app.models.attendance import AttendanceRecord, AttendanceSession
        AttendanceRecord.query.delete()
        AttendanceSession.query.delete()
        db.session.commit()
        deleted = Subject.query.delete()
        db.session.commit()
        print(f"Removed {deleted} old subjects.")

        admin = Faculty.query.filter_by(email="admin@igdtuw.ac.in").first()
        if not admin:
            admin = Faculty(
                name="Admin",
                email="admin@igdtuw.ac.in",
                role="admin",
                department="ECE-AI",
                password_hash="",
            )
            db.session.add(admin)
            db.session.flush()

        for s in SUBJECTS:
            db.session.add(Subject(
                code=s["code"],
                name=s["name"],
                department="ECE-AI",
                semester=s["semester"],
                faculty_id=admin.id,
                is_active=True,
            ))

        db.session.commit()
        print(f"Seeded {len(SUBJECTS)} subjects successfully.")


if __name__ == "__main__":
    seed()
