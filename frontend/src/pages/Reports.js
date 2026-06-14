import { useEffect, useState } from "react";
import { getSubjects, getSubjectAttendance, downloadReport } from "../services/api";
import Sidebar from "../components/Sidebar";
import toast from "react-hot-toast";
import { FileText, Download, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

const card = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "14px",
  overflow: "hidden",
};

export default function Reports() {
  const [subjects, setSubjects] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [attendanceData, setAttendanceData] = useState({});
  const [loadingData, setLoadingData] = useState({});

  useEffect(() => {
    getSubjects().then((r) => setSubjects(r.data)).catch(() => {});
  }, []);

  async function toggleSubject(subject) {
    if (expanded === subject.id) { setExpanded(null); return; }
    setExpanded(subject.id);
    if (attendanceData[subject.id]) return;
    setLoadingData((l) => ({ ...l, [subject.id]: true }));
    try {
      const { data } = await getSubjectAttendance(subject.id);
      setAttendanceData((d) => ({ ...d, [subject.id]: data }));
    } catch { toast.error("Failed to load attendance data."); }
    finally { setLoadingData((l) => ({ ...l, [subject.id]: false })); }
  }

  async function handlePDF(subjectId, subjectName) {
    const id = toast.loading("Generating PDF report…");
    try {
      const { data } = await downloadReport(subjectId);
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url;
      a.download = `${subjectName.replace(/\s+/g, "_")}_attendance.pdf`; a.click();
      toast.success("PDF downloaded.", { id });
    } catch { toast.error("Failed to generate PDF.", { id }); }
  }

  function handleCSV(subjectName, rows) {
    const headers = ["Roll No", "Name", "Total Classes", "Present", "Absent", "Percentage"];
    const lines = [
      headers.join(","),
      ...rows.map((r) => [r.roll_number, `"${r.name}"`, r.total, r.present, r.total - r.present, `${r.percentage}%`].join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${subjectName.replace(/\s+/g, "_")}_attendance.csv`; a.click();
    toast.success("CSV downloaded.");
  }

  function pctBadgeStyle(pct) {
    if (pct >= 75) return { background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" };
    if (pct >= 60) return { background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" };
    return { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" };
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8" style={{ color: "#fff" }}>
        <h1 className="text-2xl font-bold text-white mb-6">Attendance Reports</h1>

        <div className="space-y-3">
          {subjects.map((s) => {
            const isOpen = expanded === s.id;
            const rows = attendanceData[s.id] || [];
            const loading = loadingData[s.id];
            const lowCount = rows.filter((r) => r.percentage < 75).length;

            return (
              <div key={s.id} style={card}>
                {/* Header row */}
                <div onClick={() => toggleSubject(s)}
                  className="flex items-center justify-between px-5 py-4 cursor-pointer transition"
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-blue-400" />
                    <div>
                      <div className="font-medium text-white">{s.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{s.code} · Sem {s.semester}</div>
                    </div>
                    {isOpen && lowCount > 0 && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                        <AlertTriangle size={10} /> {lowCount} below 75%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {isOpen && rows.length > 0 && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleCSV(s.name, rows); }}
                          className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg transition"
                          style={{ border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(34,197,94,0.1)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <Download size={12} /> CSV
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handlePDF(s.id, s.name); }}
                          className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg transition"
                          style={{ border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.1)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <Download size={12} /> PDF
                        </button>
                      </>
                    )}
                    {isOpen ? <ChevronUp size={15} style={{ color: "rgba(255,255,255,0.3)" }} /> : <ChevronDown size={15} style={{ color: "rgba(255,255,255,0.3)" }} />}
                  </div>
                </div>

                {/* Expanded table */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                    {loading ? (
                      <div className="py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Loading…</div>
                    ) : rows.length === 0 ? (
                      <div className="py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No records found for this subject yet.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                            <tr>
                              {["Roll No", "Name", "Total", "Present", "Absent", "%"].map((h) => (
                                <th key={h} className="text-left px-4 py-3 font-medium text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.slice().sort((a, b) => a.percentage - b.percentage).map((r, i) => (
                              <tr key={r.student_id} style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                <td className="px-4 py-3" style={{ color: "rgba(255,255,255,0.5)" }}>{r.roll_number}</td>
                                <td className="px-4 py-3 font-medium text-white">{r.name}</td>
                                <td className="px-4 py-3" style={{ color: "rgba(255,255,255,0.5)" }}>{r.total}</td>
                                <td className="px-4 py-3" style={{ color: "#4ade80" }}>{r.present}</td>
                                <td className="px-4 py-3" style={{ color: "#f87171" }}>{r.total - r.present}</td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={pctBadgeStyle(r.percentage)}>
                                    {r.percentage}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Summary footer */}
                        <div className="px-4 py-3 flex gap-6 text-xs" style={{ background: "rgba(255,255,255,0.03)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                          <span style={{ color: "rgba(255,255,255,0.4)" }}>Total: <strong className="text-white">{rows.length}</strong></span>
                          <span style={{ color: "#4ade80" }}>≥75%: <strong>{rows.filter(r => r.percentage >= 75).length}</strong></span>
                          <span style={{ color: "#f87171" }}>&lt;75%: <strong>{lowCount}</strong></span>
                          <span style={{ color: "rgba(255,255,255,0.4)" }}>Avg: <strong className="text-white">
                            {rows.length ? Math.round(rows.reduce((s, r) => s + r.percentage, 0) / rows.length) : 0}%
                          </strong></span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {subjects.length === 0 && (
            <p className="py-8 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>No subjects found.</p>
          )}
        </div>
      </main>
    </div>
  );
}
