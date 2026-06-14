import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getActiveSessions, verifyOtp, getMyAttendanceSummary,
  registerFace, faceCheckin, getFaceStatus, presenceCheck,
  getMySubjectDetail, getMyNotices,
} from "../services/api";
import FaceCamera from "../components/FaceCamera";
import {
  BookOpen, Clock, CheckCircle, LogOut, BarChart2, AlertTriangle,
  Camera, ShieldCheck, GraduationCap, ArrowLeft, ChevronRight,
  TrendingUp, TrendingDown, Minus, Bell, XCircle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import toast from "react-hot-toast";

// ── Shared style tokens ──────────────────────────────────────────────────────
const glass = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "16px",
};
const modalGlass = {
  background: "rgba(15,31,61,0.97)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "20px",
  boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
};

function pctColor(p)    { return p >= 75 ? "#4ade80" : p >= 60 ? "#fb923c" : "#f87171"; }
function barColor(p)    { return p >= 75 ? "#22c55e" : p >= 60 ? "#f59e0b" : "#ef4444"; }
function semToYear(sem) { return Math.ceil(sem / 2); }
function actualSem(yr, ys) { return (yr - 1) * 2 + ys; }

// ── Main Component ────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const [tab, setTab] = useState("sessions");
  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState([]);
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [otpInputs, setOtpInputs] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [marked, setMarked] = useState({});
  const [showCamera, setShowCamera] = useState(null);
  const [pendingOtp, setPendingOtp] = useState({});
  const [gpsCoords, setGpsCoords] = useState({ lat: null, lng: null });
  const [presencePrompt, setPresencePrompt] = useState(null);

  // History navigation state
  const [histView, setHistView]     = useState("year");   // year | semester | subjects | detail
  const [selYear, setSelYear]       = useState(null);
  const [selYearSem, setSelYearSem] = useState(null);
  const [selSubject, setSelSubject] = useState(null);
  const [subDetail, setSubDetail]   = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Notices state
  const [notices, setNotices]       = useState([]);
  const [noticesLoaded, setNoticesLoaded] = useState(false);

  const navigate = useNavigate();
  const name = localStorage.getItem("name") || "Student";

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    try { const { data } = await getActiveSessions(); setSessions(data); } catch {}
  }, []);

  const fetchSummary = useCallback(async () => {
    try { const { data } = await getMyAttendanceSummary(); setSummary(data); } catch {}
  }, []);

  const fetchFaceStatus = useCallback(async () => {
    try { const { data } = await getFaceStatus(); setFaceRegistered(data.registered); } catch {}
  }, []);

  useEffect(() => {
    fetchSessions(); fetchSummary(); fetchFaceStatus();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setGpsCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => setGpsCoords({ lat: null, lng: null })
      );
    }
    const si = setInterval(fetchSessions, 10000);
    const pi = setInterval(() => {
      const ids = Object.keys(marked).filter(id => marked[id]);
      if (ids.length && faceRegistered) setPresencePrompt(Number(ids[0]));
    }, 12 * 60 * 1000);
    return () => { clearInterval(si); clearInterval(pi); };
  }, [fetchSessions, fetchSummary, fetchFaceStatus, marked, faceRegistered]);

  // Auto-detect default year from summary
  useEffect(() => {
    if (summary.length && histView === "year") {
      const counts = {};
      summary.forEach(s => {
        const y = semToYear(s.semester);
        counts[y] = (counts[y] || 0) + (s.total_classes > 0 ? 1 : 0);
      });
      let best = 1, bestC = -1;
      Object.entries(counts).forEach(([y, c]) => {
        if (c > bestC) { bestC = c; best = parseInt(y); }
      });
      setSelYear(best);
    }
  }, [summary]); // eslint-disable-line

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleOtpSubmit(session) {
    const otp = (otpInputs[session.subject_id] || "").trim();
    if (!otp) { toast.error("Please enter the OTP."); return; }
    if (faceRegistered) {
      setPendingOtp(p => ({ ...p, [session.subject_id]: otp }));
      setShowCamera(session.subject_id);
    } else {
      setSubmitting(s => ({ ...s, [session.subject_id]: true }));
      try {
        const { data } = await verifyOtp(session.subject_id, otp, gpsCoords.lat, gpsCoords.lng);
        toast.success(data.message);
        setMarked(m => ({ ...m, [session.subject_id]: true }));
        fetchSummary();
      } catch (err) {
        toast.error(err.response?.data?.error || "Invalid OTP or session has expired.");
      } finally {
        setSubmitting(s => ({ ...s, [session.subject_id]: false }));
      }
    }
  }

  async function handleFaceCheckin(imageB64) {
    const sid = showCamera;
    const otp = pendingOtp[sid] || otpInputs[sid] || "";
    setShowCamera(null);
    setSubmitting(s => ({ ...s, [sid]: true }));
    try {
      const { data } = await faceCheckin(sid, otp, imageB64, gpsCoords.lat, gpsCoords.lng);
      toast.success(`${data.message} (Face confidence: ${Math.round((data.confidence || 0) * 100)}%)`);
      setMarked(m => ({ ...m, [sid]: true }));
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.error || "Face verification failed.");
    } finally {
      setSubmitting(s => ({ ...s, [sid]: false }));
    }
  }

  async function handlePresenceCheck(imageB64) {
    const subjectId = presencePrompt;
    setPresencePrompt(null);
    try {
      const { data } = await presenceCheck(subjectId, imageB64);
      if (data.verified) toast.success("Presence verified!");
      else toast.error("Presence check failed. You may be marked as absent.");
    } catch { toast.error("Presence check could not be completed."); }
  }

  async function handleRegisterFace(imageB64) {
    setShowCamera(null);
    try {
      await registerFace(imageB64);
      toast.success("Face ID registered successfully!");
      setFaceRegistered(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Face not detected. Ensure good lighting.");
    }
  }

  async function openSubjectDetail(subject) {
    setSelSubject(subject);
    setHistView("detail");
    setLoadingDetail(true);
    try {
      const { data } = await getMySubjectDetail(subject.subject_id);
      setSubDetail(data);
    } catch { toast.error("Could not load subject details."); }
    finally { setLoadingDetail(false); }
  }

  function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sc = (s % 60).toString().padStart(2, "0");
    return `${m}:${sc}`;
  }

  // Fetch notices when tab opens
  useEffect(() => {
    if (tab === "notices" && !noticesLoaded) {
      getMyNotices().then(r => { setNotices(r.data); setNoticesLoaded(true); }).catch(() => {});
    }
  }, [tab, noticesLoaded]);

  const upcomingNoticesCount = notices.filter(n => new Date(n.cancel_date) >= new Date(new Date().toDateString())).length;

  const tabs = [
    { key: "sessions", label: "Live Sessions", icon: Clock, badge: sessions.length },
    { key: "history",  label: "My Attendance", icon: BarChart2 },
    { key: "notices",  label: "Notices",        icon: Bell, badge: upcomingNoticesCount },
    { key: "face",     label: "Face ID",        icon: Camera },
  ];

  // Subjects for selected year+sem
  const currentSemNum = selYear && selYearSem ? actualSem(selYear, selYearSem) : null;
  const semSubjects   = currentSemNum ? summary.filter(s => s.semester === currentSemNum) : [];

  // Summary stats for selected semester
  const semStats = semSubjects.length ? {
    total: semSubjects.length,
    avg:   Math.round(semSubjects.reduce((a, s) => a + s.percentage, 0) / semSubjects.length),
    attended: semSubjects.reduce((a, s) => a + s.present, 0),
    missed:   semSubjects.reduce((a, s) => a + s.absent,  0),
  } : null;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0f1f3d 0%, #1a3461 40%, #0d2137 100%)" }}>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
              <GraduationCap size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">AuraAttend</h1>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Welcome, {name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {faceRegistered ? (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }}>
                <ShieldCheck size={11} /> Face ID Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}>
                <Camera size={11} /> No Face ID
              </span>
            )}
            <button onClick={() => { localStorage.clear(); navigate("/login"); }}
              className="flex items-center gap-1.5 text-sm transition"
              style={{ color: "rgba(255,255,255,0.35)" }}
              onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}>
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {tabs.map(({ key, label, icon: Icon, badge }) => (
            <button key={key} onClick={() => { setTab(key); if (key === "history") setHistView("year"); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition"
              style={tab === key ? { background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "#fff", boxShadow: "0 4px 12px rgba(59,130,246,0.35)" }
                : { color: "rgba(255,255,255,0.45)" }}>
              <Icon size={14} /> {label}
              {badge > 0 && <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{badge}</span>}
            </button>
          ))}
        </div>

        {/* ── Camera / Presence Modals ──────────────────────────────────── */}
        {showCamera && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
            <div className="w-full max-w-md p-6" style={modalGlass}>
              <h2 className="text-lg font-semibold text-white mb-1">
                {showCamera === "register" ? "Register Face ID" : "Face Verification"}
              </h2>
              <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
                {showCamera === "register" ? "Position your face within the circle." : "Look directly at the camera."}
              </p>
              <FaceCamera
                onCapture={showCamera === "register" ? handleRegisterFace : handleFaceCheckin}
                onCancel={() => setShowCamera(null)}
                actionLabel={showCamera === "register" ? "Register Face ID" : "Confirm Attendance"}
              />
            </div>
          </div>
        )}
        {presencePrompt && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
            <div className="w-full max-w-md p-6" style={modalGlass}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.3)" }}>
                  <ShieldCheck size={20} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Presence Verification</h2>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Periodic check to confirm you are present</p>
                </div>
              </div>
              <FaceCamera onCapture={handlePresenceCheck} onCancel={() => setPresencePrompt(null)} actionLabel="Confirm Presence" />
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            LIVE SESSIONS TAB
        ════════════════════════════════════════════════════════════════ */}
        {tab === "sessions" && (
          <>
            <h2 className="text-base font-semibold text-white mb-4">Active Attendance Sessions</h2>
            {!faceRegistered && (
              <div className="flex items-center gap-3 p-4 rounded-xl mb-4"
                style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)" }}>
                <AlertTriangle size={16} className="text-yellow-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-300">Face ID Not Registered</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Attendance is OTP only.{" "}
                    <button onClick={() => setTab("face")} className="text-blue-400 underline font-semibold">Register Face ID</button>
                  </p>
                </div>
              </div>
            )}
            {sessions.length === 0 ? (
              <div className="text-center py-14" style={glass}>
                <BookOpen size={40} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
                <p className="font-medium text-white">No active sessions at the moment.</p>
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Sessions appear when your teacher starts attendance.</p>
                <p className="text-xs mt-4" style={{ color: "rgba(255,255,255,0.2)" }}>Auto-refreshes every 10 seconds</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map(session => (
                  <div key={session.session_id} className="p-6" style={glass}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-white text-base">{session.subject_name}</h3>
                        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{session.subject_code}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-full"
                        style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}>
                        <Clock size={13} />
                        <span className="font-semibold">{formatTime(session.remaining_seconds)}</span>
                      </div>
                    </div>
                    {marked[session.subject_id] ? (
                      <div className="flex items-center gap-2 p-4 rounded-xl"
                        style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
                        <CheckCircle size={18} className="text-green-400" />
                        <span className="font-medium text-green-300">Attendance marked successfully!</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label className="block text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
                          Enter OTP from your teacher {faceRegistered && <span className="text-blue-400">(Face scan follows)</span>}
                        </label>
                        <div className="flex gap-3">
                          <input type="text" maxLength={6}
                            value={otpInputs[session.subject_id] || ""}
                            onChange={e => setOtpInputs(o => ({ ...o, [session.subject_id]: e.target.value.replace(/\D/g, "") }))}
                            placeholder="6-digit OTP"
                            className="flex-1 text-center text-xl tracking-widest font-bold rounded-xl px-4 py-2.5 outline-none"
                            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }} />
                          <button onClick={() => handleOtpSubmit(session)} disabled={submitting[session.subject_id]}
                            className="px-5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center gap-2"
                            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
                            {faceRegistered && <Camera size={14} />}
                            {submitting[session.subject_id] ? "Verifying…" : "Mark"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            MY ATTENDANCE TAB — hierarchical navigation
        ════════════════════════════════════════════════════════════════ */}
        {tab === "history" && (
          <>
            {/* ── View: Year selection ─────────────────────────────────── */}
            {histView === "year" && (
              <YearView
                summary={summary}
                selYear={selYear}
                onSelect={y => { setSelYear(y); setSelYearSem(null); setHistView("semester"); }}
              />
            )}

            {/* ── View: Semester selection ──────────────────────────────── */}
            {histView === "semester" && (
              <SemesterView
                year={selYear}
                summary={summary}
                onBack={() => setHistView("year")}
                onSelect={ys => { setSelYearSem(ys); setHistView("subjects"); }}
              />
            )}

            {/* ── View: Subjects list ───────────────────────────────────── */}
            {histView === "subjects" && (
              <SubjectsView
                year={selYear}
                yearSem={selYearSem}
                subjects={semSubjects}
                stats={semStats}
                onBack={() => { setSelYearSem(null); setHistView("semester"); }}
                onSubject={openSubjectDetail}
              />
            )}

            {/* ── View: Subject detail ──────────────────────────────────── */}
            {histView === "detail" && (
              <DetailView
                subject={selSubject}
                detail={subDetail}
                loading={loadingDetail}
                year={selYear}
                yearSem={selYearSem}
                onBack={() => { setSubDetail(null); setHistView("subjects"); }}
              />
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            FACE ID TAB
        ════════════════════════════════════════════════════════════════ */}
        {tab === "face" && (
          <>
            <h2 className="text-base font-semibold text-white mb-4">Face ID</h2>
            <div className="p-6" style={glass}>
              {faceRegistered ? (
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                    style={{ background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.3)" }}>
                    <ShieldCheck size={36} className="text-green-400" />
                  </div>
                  <h3 className="font-semibold text-white">Face ID Registered</h3>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Your Face ID is active. Attendance requires both OTP and face verification.
                  </p>
                  <button onClick={() => setShowCamera("register")}
                    className="px-6 py-2 rounded-xl text-sm font-medium transition"
                    style={{ border: "1px solid rgba(59,130,246,0.4)", color: "#60a5fa" }}>
                    Update Face ID
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                    style={{ background: "rgba(255,255,255,0.06)", border: "2px solid rgba(255,255,255,0.1)" }}>
                    <Camera size={36} style={{ color: "rgba(255,255,255,0.3)" }} />
                  </div>
                  <h3 className="font-semibold text-white">Face ID Not Registered</h3>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>Register your Face ID for biometric attendance.</p>
                  <div className="p-3 rounded-xl text-left"
                    style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
                    <p className="text-xs text-blue-400 font-medium mb-1">Instructions:</p>
                    <ul className="text-xs list-disc list-inside space-y-0.5" style={{ color: "rgba(147,197,253,0.8)" }}>
                      <li>Ensure good lighting on your face</li>
                      <li>Position your face clearly within the oval guide</li>
                      <li>Remove glasses if possible</li>
                    </ul>
                  </div>
                  <button onClick={() => setShowCamera("register")}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", boxShadow: "0 8px 25px rgba(59,130,246,0.35)" }}>
                    <Camera size={16} /> Register Face ID
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        {/* ════════════════════════════════════════════════════════════════
            NOTICES TAB
        ════════════════════════════════════════════════════════════════ */}
        {tab === "notices" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Class Cancellation Notices</h2>
              <button onClick={() => { setNoticesLoaded(false); getMyNotices().then(r => { setNotices(r.data); setNoticesLoaded(true); }).catch(() => {}); }}
                className="text-xs px-3 py-1.5 rounded-lg transition"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                Refresh
              </button>
            </div>

            {!noticesLoaded ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading notices…</p>
              </div>
            ) : notices.length === 0 ? (
              <div className="text-center py-16 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Bell size={36} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
                <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>No cancellation notices</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>Your faculty hasn't cancelled any classes recently.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notices.map((n) => {
                  const isPast = new Date(n.cancel_date) < new Date(new Date().toDateString());
                  const isToday = n.cancel_date === new Date().toISOString().split("T")[0];
                  return (
                    <div key={n.id} className="rounded-2xl p-4 transition"
                      style={isToday ? {
                        background: "rgba(239,68,68,0.12)",
                        border: "1px solid rgba(239,68,68,0.35)",
                      } : isPast ? {
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        opacity: 0.7,
                      } : {
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.2)",
                      }}>
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                          style={isToday || !isPast
                            ? { background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.3)" }
                            : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <XCircle size={16} style={{ color: isPast && !isToday ? "rgba(255,255,255,0.3)" : "#fca5a5" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white">{n.subject_name}</span>
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{n.subject_code}</span>
                            {isToday && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                                style={{ background: "rgba(239,68,68,0.25)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.4)" }}>
                                TODAY
                              </span>
                            )}
                            {!isPast && !isToday && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full"
                                style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
                                Upcoming
                              </span>
                            )}
                            {isPast && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full"
                                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
                                Past
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-sm font-medium" style={{ color: isPast && !isToday ? "rgba(255,255,255,0.4)" : "#fca5a5" }}>
                              {n.cancel_date_display}
                            </span>
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>by {n.faculty_name}</span>
                          </div>
                          {n.reason && (
                            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                              {n.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════════════

function BackBtn({ label, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 text-sm mb-5 transition"
      style={{ color: "rgba(255,255,255,0.4)" }}
      onMouseEnter={e => e.currentTarget.style.color = "#fff"}
      onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>
      <ArrowLeft size={14} /> {label}
    </button>
  );
}

function Breadcrumb({ parts }) {
  return (
    <div className="flex items-center gap-1.5 text-xs mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={11} />}
          <span style={i === parts.length - 1 ? { color: "rgba(255,255,255,0.7)" } : {}}>{p}</span>
        </span>
      ))}
    </div>
  );
}

// ── Year Selection View ──────────────────────────────────────────────────────
function YearView({ summary, selYear, onSelect }) {
  const yearData = [1, 2, 3, 4].map(y => {
    const subs = summary.filter(s => semToYear(s.semester) === y);
    const total = subs.length;
    const withData = subs.filter(s => s.total_classes > 0).length;
    const avg = total ? Math.round(subs.reduce((a, s) => a + s.percentage, 0) / total) : 0;
    return { year: y, total, withData, avg };
  });

  const labels = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

  return (
    <>
      <h2 className="text-base font-semibold text-white mb-1">My Attendance</h2>
      <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>Select an academic year to view attendance</p>
      <div className="grid grid-cols-2 gap-4">
        {yearData.map(({ year, total, withData, avg }) => {
          const isDefault = year === selYear;
          return (
            <button key={year} onClick={() => onSelect(year)}
              className="p-5 rounded-2xl text-left transition group relative"
              style={isDefault ? {
                background: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(29,78,216,0.15))",
                border: "1px solid rgba(59,130,246,0.45)",
              } : {
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              onMouseEnter={e => { if (!isDefault) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
              onMouseLeave={e => { if (!isDefault) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}>
              {isDefault && (
                <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(59,130,246,0.3)", color: "#93c5fd" }}>current</span>
              )}
              <div className="text-2xl font-bold text-white mb-0.5">Year {year}</div>
              <div className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>{labels[year - 1]}</div>
              {withData > 0 ? (
                <>
                  <div className="text-xl font-bold" style={{ color: pctColor(avg) }}>{avg}%</div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>avg · {total} subjects</div>
                </>
              ) : (
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>No data yet</div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Semester Selection View ───────────────────────────────────────────────────
function SemesterView({ year, summary, onBack, onSelect }) {
  const semData = [1, 2].map(ys => {
    const sem = actualSem(year, ys);
    const subs = summary.filter(s => s.semester === sem);
    const total = subs.length;
    const avg = total ? Math.round(subs.reduce((a, s) => a + s.percentage, 0) / total) : 0;
    const attended = subs.reduce((a, s) => a + s.present, 0);
    const missed   = subs.reduce((a, s) => a + s.absent, 0);
    return { ys, sem, total, avg, attended, missed };
  });

  return (
    <>
      <BackBtn label="All Years" onClick={onBack} />
      <Breadcrumb parts={["My Attendance", `Year ${year}`]} />
      <h2 className="text-base font-semibold text-white mb-1">Year {year}</h2>
      <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>Select a semester</p>

      <div className="grid grid-cols-2 gap-4">
        {semData.map(({ ys, sem, total, avg, attended, missed }) => (
          <button key={ys} onClick={() => onSelect(ys)}
            className="p-5 rounded-2xl text-left transition"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.11)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}>
            <div className="text-lg font-bold text-white mb-0.5">Semester {sem}</div>
            <div className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
              {ys === 1 ? "Jul – Dec" : "Jan – Jun"}
            </div>
            {total > 0 ? (
              <>
                <div className="text-2xl font-bold mb-0.5" style={{ color: pctColor(avg) }}>{avg}%</div>
                <div className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>avg · {total} subjects</div>
                <div className="w-full rounded-full h-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${Math.min(avg, 100)}%`, background: barColor(avg) }} />
                </div>
                <div className="flex justify-between text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                  <span style={{ color: "#4ade80" }}>↑ {attended}</span>
                  <span style={{ color: "#f87171" }}>↓ {missed}</span>
                </div>
              </>
            ) : (
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>No data yet</div>
            )}
          </button>
        ))}
      </div>
    </>
  );
}

// ── Subjects List View ────────────────────────────────────────────────────────
function SubjectsView({ year, yearSem, subjects, stats, onBack, onSubject }) {
  const sem = actualSem(year, yearSem);

  return (
    <>
      <BackBtn label="Back to Semesters" onClick={onBack} />
      <Breadcrumb parts={["My Attendance", `Year ${year}`, `Semester ${sem}`]} />

      {/* Semester Summary */}
      {stats && stats.total > 0 && (
        <div className="rounded-2xl p-5 mb-5" style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(29,78,216,0.08))",
          border: "1px solid rgba(59,130,246,0.25)",
        }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs font-medium" style={{ color: "rgba(147,197,253,0.8)" }}>Semester {sem} Overview</div>
              <div className="text-3xl font-bold mt-0.5" style={{ color: pctColor(stats.avg) }}>{stats.avg}%</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>overall attendance</div>
            </div>
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: `conic-gradient(${barColor(stats.avg)} ${stats.avg * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: "rgba(15,31,61,0.8)" }}>
                <span className="text-xs font-bold text-white">{stats.avg}%</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-2">
            {[
              { label: "Subjects", value: stats.total, color: "#60a5fa" },
              { label: "Attended", value: stats.attended, color: "#4ade80" },
              { label: "Missed",   value: stats.missed,   color: "#f87171" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="text-lg font-bold" style={{ color }}>{value}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</div>
              </div>
            ))}
          </div>
          {stats.avg < 75 && (
            <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: "#fbbf24" }}>
              <AlertTriangle size={12} /> Overall attendance below required 75%
            </div>
          )}
        </div>
      )}

      <h3 className="text-sm font-semibold mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>
        {subjects.length} Subject{subjects.length !== 1 ? "s" : ""} · Semester {sem}
      </h3>

      {subjects.length === 0 ? (
        <div className="text-center py-12" style={{ ...glass }}>
          <BookOpen size={36} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
          <p style={{ color: "rgba(255,255,255,0.35)" }}>No subjects found for this semester.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subjects.sort((a, b) => a.percentage - b.percentage).map(s => (
            <button key={s.subject_id} onClick={() => onSubject(s)}
              className="w-full rounded-2xl p-4 text-left transition group"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.11)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 mr-4">
                  <div className="font-semibold text-white text-sm truncate">{s.subject_name}</div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{s.subject_code}</div>
                  <div className="flex gap-3 text-xs mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <span>Total: <strong className="text-white">{s.total_classes}</strong></span>
                    <span style={{ color: "#4ade80" }}>✓ {s.present}</span>
                    <span style={{ color: "#f87171" }}>✗ {s.absent}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-xl font-bold" style={{ color: pctColor(s.percentage) }}>{s.percentage}%</div>
                    {s.percentage < 75 && s.total_classes > 0 && (
                      <div className="text-xs" style={{ color: "#f87171" }}>Below 75%</div>
                    )}
                  </div>
                  <ChevronRight size={16} style={{ color: "rgba(255,255,255,0.25)" }} />
                </div>
              </div>
              <div className="mt-3 w-full rounded-full h-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(s.percentage, 100)}%`, background: barColor(s.percentage) }} />
              </div>
              {s.recent.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {s.recent.slice(0, 5).map((r, i) => (
                    <span key={i} className="text-xs px-1.5 py-0.5 rounded"
                      style={r.status === "present" || r.status === "partial"
                        ? { background: "rgba(34,197,94,0.15)", color: "#4ade80" }
                        : { background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
                      {r.date}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ── Subject Detail View ───────────────────────────────────────────────────────
function DetailView({ subject, detail, loading, year, yearSem, onBack }) {
  const sem = actualSem(year, yearSem);

  if (loading) {
    return (
      <>
        <BackBtn label="Back to Subjects" onClick={onBack} />
        <div className="text-center py-16">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading attendance data…</p>
        </div>
      </>
    );
  }

  const d = detail;
  if (!d) return null;

  const trend = d.monthly.length >= 2
    ? d.monthly[d.monthly.length - 1].percentage - d.monthly[d.monthly.length - 2].percentage
    : 0;

  return (
    <>
      <BackBtn label="Back to Subjects" onClick={onBack} />
      <Breadcrumb parts={["My Attendance", `Year ${year}`, `Semester ${sem}`, subject?.subject_name || ""]} />

      {/* ── Hero card ─────────────────────────────── */}
      <div className="rounded-2xl p-6 mb-4" style={{
        background: "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(29,78,216,0.1))",
        border: "1px solid rgba(59,130,246,0.3)",
      }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">{d.subject_name}</h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{d.subject_code} · Semester {d.semester}</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold" style={{ color: pctColor(d.percentage) }}>{d.percentage}%</div>
            <div className="flex items-center gap-1 justify-end text-xs mt-0.5"
              style={{ color: trend > 0 ? "#4ade80" : trend < 0 ? "#f87171" : "rgba(255,255,255,0.35)" }}>
              {trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
              {trend > 0 ? `+${trend.toFixed(1)}%` : trend < 0 ? `${trend.toFixed(1)}%` : "Stable"}
              <span style={{ color: "rgba(255,255,255,0.3)" }}> vs last month</span>
            </div>
          </div>
        </div>

        <div className="mt-4 w-full rounded-full h-2.5" style={{ background: "rgba(255,255,255,0.1)" }}>
          <div className="h-2.5 rounded-full transition-all"
            style={{ width: `${Math.min(d.percentage, 100)}%`, background: barColor(d.percentage) }} />
        </div>

        {d.percentage < 75 && d.total > 0 && (
          <div className="flex items-center gap-1.5 text-xs mt-2" style={{ color: "#fbbf24" }}>
            <AlertTriangle size={11} />
            {Math.ceil((0.75 * d.total - d.present) / 0.25)} more classes needed to reach 75%
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: "Total Classes", value: d.total, color: "#60a5fa" },
            { label: "Present",       value: d.present, color: "#4ade80" },
            { label: "Absent",        value: d.absent,  color: "#f87171" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="text-2xl font-bold" style={{ color }}>{value}</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Monthly Chart ──────────────────────────── */}
      {d.monthly.length > 0 && (
        <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h3 className="text-sm font-semibold text-white mb-4">Monthly Attendance</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={d.monthly} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip
                formatter={v => [`${v}%`, "Attendance"]}
                contentStyle={{ background: "rgba(15,31,61,0.97)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, fontSize: 12, color: "#fff" }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
              />
              <Bar dataKey="percentage" radius={[5, 5, 0, 0]}>
                {d.monthly.map((m, i) => <Cell key={i} fill={barColor(m.percentage)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {d.monthly.slice(-3).map((m, i) => (
              <div key={i} className="text-center p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>{m.month}</div>
                <div className="text-base font-bold mt-0.5" style={{ color: pctColor(m.percentage) }}>{m.percentage}%</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{m.present}/{m.total}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Attendance History Timeline ────────────── */}
      {d.records.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h3 className="text-sm font-semibold text-white mb-4">Attendance History</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {d.records.map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl transition"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: r.status === "present" ? "#22c55e" : r.status === "partial" ? "#f59e0b" : "#ef4444" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">{r.date}</span>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{r.time}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={r.status === "present" ? { background: "rgba(34,197,94,0.15)", color: "#4ade80" }
                        : r.status === "partial" ? { background: "rgba(245,158,11,0.15)", color: "#fbbf24" }
                        : { background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
                      {r.status}
                    </span>
                    {r.geo_verified && (
                      <span className="text-xs" style={{ color: "rgba(96,165,250,0.7)" }}>📍 geo</span>
                    )}
                    {r.face_confidence > 0 && (
                      <span className="text-xs" style={{ color: "rgba(167,139,250,0.7)" }}>🔍 {r.face_confidence}%</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.records.length === 0 && (
        <div className="text-center py-10 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <BarChart2 size={32} className="mx-auto mb-2" style={{ color: "rgba(255,255,255,0.15)" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No attendance records yet for this subject.</p>
        </div>
      )}
    </>
  );
}
