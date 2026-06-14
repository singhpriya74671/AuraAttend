import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import {
  getAdminStudents, addAdminStudent, deleteAdminStudent,
  getAdminSubjects, addAdminSubject, deleteAdminSubject,
  getAdminFaculty, addAdminFaculty, deleteAdminFaculty,
} from "../services/api";
import { Users, BookOpen, UserCheck, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

const inputStyle = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "10px",
  color: "#fff",
  fontSize: "14px",
  padding: "10px 12px",
  width: "100%",
  outline: "none",
};

const labelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: "500",
  color: "rgba(255,255,255,0.5)",
  marginBottom: "5px",
};

export default function AdminPanel() {
  const [tab, setTab] = useState("students");
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [modal, setModal] = useState(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [s, sub, f] = await Promise.all([getAdminStudents(), getAdminSubjects(), getAdminFaculty()]);
      setStudents(s.data); setSubjects(sub.data); setFaculty(f.data);
    } catch {}
  }

  async function handleDeleteStudent(id) {
    if (!window.confirm("Remove this student?")) return;
    try { await deleteAdminStudent(id); toast.success("Student removed"); setStudents((p) => p.filter((s) => s.id !== id)); }
    catch { toast.error("Error"); }
  }

  async function handleDeleteSubject(id) {
    if (!window.confirm("Remove this subject?")) return;
    try { await deleteAdminSubject(id); toast.success("Subject removed"); setSubjects((p) => p.filter((s) => s.id !== id)); }
    catch { toast.error("Error"); }
  }

  async function handleDeleteFaculty(id) {
    if (!window.confirm("Remove this faculty member?")) return;
    try { await deleteAdminFaculty(id); toast.success("Faculty removed"); setFaculty((p) => p.filter((f) => f.id !== id)); }
    catch { toast.error("Error"); }
  }

  const tabs = [
    { key: "students", label: "Students", icon: Users, count: students.length },
    { key: "subjects", label: "Subjects", icon: BookOpen, count: subjects.length },
    { key: "faculty", label: "Faculty", icon: UserCheck, count: faculty.length },
  ];

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8" style={{ color: "#fff" }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <button
            onClick={() => setModal(tab === "students" ? "student" : tab === "subjects" ? "subject" : "faculty")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", boxShadow: "0 4px 15px rgba(59,130,246,0.3)" }}>
            <Plus size={15} /> Add {tab === "students" ? "Student" : tab === "subjects" ? "Subject" : "Faculty"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map(({ key, label, icon: Icon, count }) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition"
              style={tab === key ? {
                background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                color: "#fff", boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
              } : {
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.55)",
              }}>
              <Icon size={14} /> {label}
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={tab === key ? { background: "rgba(255,255,255,0.25)", color: "#fff" } : { background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {tab === "students" && (
          <DarkTable
            headers={["Roll No", "Name", "Email", "Department", "Sem", ""]}
            rows={students.map((s) => [s.roll_number, s.name, s.email, s.department || "—", s.semester || "—",
              <DeleteBtn onClick={() => handleDeleteStudent(s.id)} />])}
            empty="No students found."
          />
        )}
        {tab === "subjects" && (
          <DarkTable
            headers={["Code", "Name", "Department", "Sem", "Faculty", ""]}
            rows={subjects.map((s) => [s.code, s.name, s.department || "—", s.semester || "—", s.faculty_name || "—",
              <DeleteBtn onClick={() => handleDeleteSubject(s.id)} />])}
            empty="No subjects found."
          />
        )}
        {tab === "faculty" && (
          <DarkTable
            headers={["Name", "Email", "Department", "Role", ""]}
            rows={faculty.map((f) => [f.name, f.email, f.department || "—", f.role,
              <DeleteBtn onClick={() => handleDeleteFaculty(f.id)} />])}
            empty="No faculty members found."
          />
        )}
      </main>

      {modal === "student" && <AddStudentModal onClose={() => setModal(null)} onAdded={(s) => { setStudents((p) => [...p, s]); setModal(null); }} />}
      {modal === "subject" && <AddSubjectModal faculty={faculty} onClose={() => setModal(null)} onAdded={(s) => { setSubjects((p) => [...p, s]); setModal(null); }} />}
      {modal === "faculty" && <AddFacultyModal onClose={() => setModal(null)} onAdded={(f) => { setFaculty((p) => [...p, f]); setModal(null); }} />}
    </div>
  );
}

function DarkTable({ headers, rows, empty }) {
  if (rows.length === 0) return <p className="py-8 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>{empty}</p>;
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <table className="w-full text-sm">
        <thead style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <tr>{headers.map((h, i) => <th key={i} className="text-left px-4 py-3 font-medium text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {row.map((cell, j) => <td key={j} className="px-4 py-3" style={{ color: "rgba(255,255,255,0.7)" }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeleteBtn({ onClick }) {
  return (
    <button onClick={onClick} className="transition"
      style={{ color: "rgba(248,113,113,0.6)" }}
      onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
      onMouseLeave={e => e.currentTarget.style.color = "rgba(248,113,113,0.6)"}>
      <Trash2 size={14} />
    </button>
  );
}

function DarkModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-md p-6" style={{
        background: "rgba(15,31,61,0.97)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "20px",
        boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
      }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)" }}
            onMouseEnter={e => e.currentTarget.style.color = "#fff"}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, placeholder }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function SubmitBtn({ loading, label }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition"
      style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", boxShadow: "0 4px 15px rgba(59,130,246,0.3)" }}>
      {loading ? "Saving…" : label}
    </button>
  );
}

function AddStudentModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ roll_number: "", name: "", email: "", department: "", semester: "1" });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  async function submit(e) {
    e.preventDefault(); setLoading(true);
    try {
      const { data } = await addAdminStudent({ ...form, semester: parseInt(form.semester) });
      toast.success("Student added!"); onAdded({ ...form, id: data.id, semester: parseInt(form.semester) });
    } catch (err) { toast.error(err.response?.data?.error || "Error"); } finally { setLoading(false); }
  }
  return (
    <DarkModal title="Add Student" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Roll Number" value={form.roll_number} onChange={(v) => set("roll_number", v)} required />
        <Field label="Name" value={form.name} onChange={(v) => set("name", v)} required />
        <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} required />
        <Field label="Department" value={form.department} onChange={(v) => set("department", v)} />
        <Field label="Semester" type="number" value={form.semester} onChange={(v) => set("semester", v)} />
        <SubmitBtn loading={loading} label="Add Student" />
      </form>
    </DarkModal>
  );
}

function AddSubjectModal({ faculty, onClose, onAdded }) {
  const [form, setForm] = useState({ code: "", name: "", department: "", semester: "1", faculty_id: "" });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  async function submit(e) {
    e.preventDefault(); setLoading(true);
    try {
      const payload = { ...form, semester: parseInt(form.semester), faculty_id: form.faculty_id ? parseInt(form.faculty_id) : null };
      const { data } = await addAdminSubject(payload);
      toast.success("Subject added!");
      const fac = faculty.find((f) => f.id === payload.faculty_id);
      onAdded({ ...payload, id: data.id, faculty_name: fac?.name || "—" });
    } catch (err) { toast.error(err.response?.data?.error || "Error"); } finally { setLoading(false); }
  }
  return (
    <DarkModal title="Add Subject" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Subject Code" value={form.code} onChange={(v) => set("code", v)} required placeholder="e.g. CS201" />
        <Field label="Subject Name" value={form.name} onChange={(v) => set("name", v)} required />
        <Field label="Department" value={form.department} onChange={(v) => set("department", v)} />
        <Field label="Semester" type="number" value={form.semester} onChange={(v) => set("semester", v)} />
        <div>
          <label style={labelStyle}>Assign Faculty</label>
          <select value={form.faculty_id} onChange={(e) => set("faculty_id", e.target.value)} style={inputStyle}>
            <option value="" style={{ background: "#1a3461" }}>— Select Faculty —</option>
            {faculty.map((f) => <option key={f.id} value={f.id} style={{ background: "#1a3461" }}>{f.name} ({f.department || "General"})</option>)}
          </select>
        </div>
        <SubmitBtn loading={loading} label="Add Subject" />
      </form>
    </DarkModal>
  );
}

function AddFacultyModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ name: "", email: "", department: "", role: "faculty", password: "pass123" });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  async function submit(e) {
    e.preventDefault(); setLoading(true);
    try {
      const { data } = await addAdminFaculty(form);
      toast.success("Faculty added!"); onAdded({ ...form, id: data.id });
    } catch (err) { toast.error(err.response?.data?.error || "Error"); } finally { setLoading(false); }
  }
  return (
    <DarkModal title="Add Faculty" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" value={form.name} onChange={(v) => set("name", v)} required />
        <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} required />
        <Field label="Department" value={form.department} onChange={(v) => set("department", v)} />
        <div>
          <label style={labelStyle}>Role</label>
          <select value={form.role} onChange={(e) => set("role", e.target.value)} style={inputStyle}>
            <option value="faculty" style={{ background: "#1a3461" }}>Faculty</option>
            <option value="admin" style={{ background: "#1a3461" }}>Admin</option>
          </select>
        </div>
        <SubmitBtn loading={loading} label="Add Faculty" />
      </form>
    </DarkModal>
  );
}
