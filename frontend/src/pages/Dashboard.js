import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { getSubjects, getAdminStats, getNotifications, cancelClass, getFacultyCancellations, deleteCancellation } from "../services/api";
import Sidebar from "../components/Sidebar";
import ChatBot from "../components/ChatBot";
import AttendanceWindow from "../components/AttendanceWindow";
import { Users, BookOpen, AlertTriangle, Bell, X, ChevronDown, ChevronRight, XCircle, Calendar, Trash2, ArrowRight, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

export default function Dashboard() {
  const [subjects, setSubjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [dismissedNotifs, setDismissedNotifs] = useState(new Set());
  const [openSems, setOpenSems] = useState({});
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Cancel class state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelDate, setCancelDate] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancellations, setCancellations] = useState([]);

  function toggleSem(key) {
    setOpenSems((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setSelectedSubject(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function loadDashboardData() {
    setLoadingSubjects(true);
    setLoadError(false);
    Promise.all([
      getSubjects(),
      getAdminStats(),
      getNotifications(),
    ]).then(([subj, statsRes, notifsRes]) => {
      setSubjects(subj.data);
      setStats(statsRes.data);
      setNotifications(notifsRes.data.alerts || []);
      setLoadError(false);
    }).catch(() => {
      setLoadError(true);
    }).finally(() => setLoadingSubjects(false));
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      getFacultyCancellations(selectedSubject.id)
        .then((r) => setCancellations(r.data))
        .catch(() => {});
      // Pre-fill today's date
      const today = new Date().toISOString().split("T")[0];
      setCancelDate(today);
      setCancelReason("");
    }
  }, [selectedSubject]);

  async function handleCancelClass() {
    if (!cancelDate) { toast.error("Please select a date."); return; }
    setCancelLoading(true);
    try {
      const { data } = await cancelClass(selectedSubject.id, cancelDate, cancelReason);
      toast.success(data.message || "Cancellation notice sent!");
      setCancellations((prev) => [data.cancellation, ...prev]);
      setShowCancelModal(false);
      setCancelReason("");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send notice.");
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleDeleteCancellation(id) {
    try {
      await deleteCancellation(id);
      setCancellations((prev) => prev.filter((c) => c.id !== id));
      toast.success("Cancellation notice removed.");
    } catch {
      toast.error("Failed to remove notice.");
    }
  }

  const visibleNotifs = notifications.filter((_, i) => !dismissedNotifs.has(i));

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 min-h-screen" style={{ color: "#fff" }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          {visibleNotifs.length > 0 && (
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}
            >
              <Bell size={15} />
              {visibleNotifs.length} Alert{visibleNotifs.length > 1 ? "s" : ""}
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {visibleNotifs.length}
              </span>
            </button>
          )}
        </div>

        {showNotifs && visibleNotifs.length > 0 && (
          <div className="mb-6 rounded-xl overflow-hidden glass-card">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(239,68,68,0.1)" }}>
              <span className="font-semibold text-red-300 text-sm">Smart Notifications</span>
              <button onClick={() => setShowNotifs(false)} className="text-red-400 hover:text-red-300"><X size={16} /></button>
            </div>
            <div className="divide-y max-h-72 overflow-y-auto" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {visibleNotifs.map((n, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${n.severity === "critical" ? "text-red-400" : "text-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    {n.type === "low_attendance" ? (
                      <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                        <strong>{n.student_name}</strong> ({n.roll_number}) —{" "}
                        <span className={n.severity === "critical" ? "text-red-400 font-bold" : "text-amber-400 font-semibold"}>
                          {n.percentage}%
                        </span>{" "}
                        in <strong>{n.subject_name}</strong>
                        <span className="ml-1" style={{ color: "rgba(255,255,255,0.35)" }}>({n.present}/{n.total} classes)</span>
                      </p>
                    ) : (
                      <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                        <strong>{n.student_name}</strong> — absent for {n.days_absent} consecutive days
                      </p>
                    )}
                  </div>
                  <button onClick={() => setDismissedNotifs((s) => new Set([...s, i]))}
                    style={{ color: "rgba(255,255,255,0.25)" }}
                    onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.6)"}
                    onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.25)"}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-3 gap-5 mb-8">
            <StatCard icon={<Users className="text-indigo-500" />} label="Total Students" value={stats.total_students} />
            <StatCard icon={<BookOpen className="text-emerald-500" />} label="Active Subjects" value={stats.total_subjects} />
            <StatCard icon={<AlertTriangle className="text-amber-500" />} label="Faculty Members" value={stats.total_faculty} />
          </div>
        )}

        <h2 className="text-lg font-semibold text-white mb-4">Your Subjects</h2>
        {loadingSubjects ? (
          <div className="flex items-center gap-3 py-6 mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading subjects…</span>
          </div>
        ) : loadError ? (
          <div className="p-5 mb-6 rounded-xl text-center" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>
              Could not connect to server. The backend may be waking up (Render free tier).
            </p>
            <button onClick={loadDashboardData}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "rgba(59,130,246,0.3)", border: "1px solid rgba(59,130,246,0.4)" }}>
              Retry
            </button>
          </div>
        ) : subjects.length === 0 ? (
          <p className="text-gray-400 mb-6">No subjects assigned yet.</p>
        ) : (
          <div className="space-y-6 mb-6">
            {Object.entries(
              subjects.reduce((acc, s) => {
                const year = Math.ceil(s.semester / 2);
                const key = `Year ${year}`;
                if (!acc[key]) acc[key] = {};
                const semKey = `Semester ${s.semester}`;
                if (!acc[key][semKey]) acc[key][semKey] = [];
                acc[key][semKey].push(s);
                return acc;
              }, {})
            ).sort().map(([year, sems]) => (
              <div key={year} className="glass-card overflow-hidden">
                <div className="px-5 py-3 font-semibold text-sm tracking-wide text-white"
                  style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(29,78,216,0.15))", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {year} — B.Tech ECE-AI
                </div>
                <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  {Object.entries(sems).sort().map(([sem, subList]) => {
                    const semKey = `${year}-${sem}`;
                    const isOpen = !!openSems[semKey];
                    return (
                      <div key={sem}>
                        <button
                          onClick={() => toggleSem(semKey)}
                          className="w-full flex items-center justify-between px-5 py-3 transition text-left"
                          style={{ color: "rgba(255,255,255,0.7)" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <span className="text-sm font-semibold flex items-center gap-2">
                            {isOpen ? <ChevronDown size={15} className="text-blue-400" /> : <ChevronRight size={15} style={{ color: "rgba(255,255,255,0.35)" }} />}
                            {sem}
                            <span className="text-xs font-normal" style={{ color: "rgba(255,255,255,0.35)" }}>· {subList.length} subjects</span>
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {subList.map((s) => (
                              <div
                                key={s.id}
                                onClick={() => setSelectedSubject(s)}
                                className="rounded-xl p-4 cursor-pointer transition"
                                style={selectedSubject?.id === s.id ? {
                                  background: "rgba(59,130,246,0.2)",
                                  border: "1px solid rgba(59,130,246,0.4)",
                                } : {
                                  background: "rgba(255,255,255,0.04)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                }}
                              >
                                <div className="font-medium text-white text-sm">{s.name}</div>
                                <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{s.code}</div>
                                <div className="text-xs text-blue-400 mt-2">Manage attendance →</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <ChatBot />
      </main>

      {createPortal(
        <>
          <style>{`@keyframes aura-fadein{from{opacity:0}to{opacity:1}}`}</style>

          {/* Backdrop */}
          {selectedSubject && (
            <div onClick={() => setSelectedSubject(null)} style={{
              position: "fixed", inset: 0, zIndex: 9998,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(4px)",
              animation: "aura-fadein 0.2s ease",
            }} />
          )}

          {/* Drawer */}
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 9999,
            width: "clamp(320px, 42vw, 480px)",
            background: "linear-gradient(160deg, #0f1f3d 0%, #112240 100%)",
            borderLeft: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "-12px 0 50px rgba(0,0,0,0.6)",
            transform: selectedSubject ? "translateX(0)" : "translateX(100%)",
            transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
            display: "flex", flexDirection: "column",
            overflowY: "auto",
          }}>
            {selectedSubject && (
              <>
                {/* Header */}
                <div style={{
                  padding: "20px 24px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  position: "sticky", top: 0, zIndex: 1,
                  backdropFilter: "blur(12px)",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 11, color: "rgba(147,197,253,0.7)", marginBottom: 2, fontWeight: 500 }}>
                        {selectedSubject.code}
                      </p>
                      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.3, margin: 0 }}>
                        {selectedSubject.name}
                      </h2>
                    </div>
                    <button onClick={() => setSelectedSubject(null)} style={{
                      flexShrink: 0, padding: "6px 8px", borderRadius: 10, border: "none", cursor: "pointer",
                      background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#fff"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button onClick={() => navigate(`/attendance/${selectedSubject.id}`)} style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                      borderRadius: 8, border: "1px solid rgba(59,130,246,0.35)", cursor: "pointer",
                      background: "rgba(59,130,246,0.15)", color: "#93c5fd", fontSize: 12, fontWeight: 500,
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.28)"}
                      onMouseLeave={e => e.currentTarget.style.background = "rgba(59,130,246,0.15)"}
                    >
                      <ExternalLink size={11} /> View Records
                    </button>
                    <button onClick={() => setShowCancelModal(true)} style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                      borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer",
                      background: "rgba(239,68,68,0.12)", color: "#fca5a5", fontSize: 12, fontWeight: 500,
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.25)"}
                      onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.12)"}
                    >
                      <XCircle size={11} /> Cancel Class
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: "20px 24px", flex: 1 }}>
                  <AttendanceWindow subjectId={selectedSubject.id} />

                  {cancellations.length > 0 && (
                    <div style={{ marginTop: 16, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)" }}>
                      <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(239,68,68,0.15)", display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar size={13} style={{ color: "#f87171" }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#fca5a5" }}>Cancellation Notices</span>
                        <span style={{ fontSize: 11, marginLeft: "auto", color: "rgba(255,255,255,0.3)" }}>{cancellations.length}</span>
                      </div>
                      {cancellations.map((c) => {
                        const isPast = new Date(c.cancel_date) < new Date(new Date().toDateString());
                        return (
                          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: "#fff" }}>{c.cancel_date_display}</span>
                                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 20, background: isPast ? "rgba(255,255,255,0.06)" : "rgba(239,68,68,0.2)", color: isPast ? "rgba(255,255,255,0.3)" : "#fca5a5" }}>
                                  {isPast ? "Past" : "Upcoming"}
                                </span>
                              </div>
                              {c.reason && <p style={{ fontSize: 11, marginTop: 2, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.reason}</p>}
                            </div>
                            <button onClick={() => handleDeleteCancellation(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.2)", padding: 6, borderRadius: 6 }}
                              onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </>,
        document.body
      )}

      {/* Cancel Class Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-sm p-6 rounded-2xl"
            style={{
              background: "rgba(15,31,61,0.98)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}>
            <div className="flex items-center gap-2 mb-1">
              <XCircle size={18} className="text-red-400" />
              <h3 className="text-lg font-semibold text-white">Cancel Class</h3>
            </div>
            <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.45)" }}>
              Students in <strong className="text-white">{selectedSubject?.name}</strong> will receive an email notification.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Cancellation Date
                </label>
                <input
                  type="date"
                  value={cancelDate}
                  onChange={(e) => setCancelDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    colorScheme: "dark",
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Reason <span style={{ color: "rgba(255,255,255,0.3)" }}>(optional)</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Faculty on leave, exam schedule..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none resize-none"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCancelClass}
                disabled={cancelLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", boxShadow: "0 4px 15px rgba(239,68,68,0.35)" }}
              >
                {cancelLoading ? "Sending…" : "Send Notice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="glass-card p-5 flex items-center gap-4">
      <div className="p-3 rounded-xl" style={{ background: "rgba(59,130,246,0.15)" }}>{icon}</div>
      <div>
        <div className="text-2xl font-bold text-white">{value ?? "—"}</div>
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</div>
      </div>
    </div>
  );
}
