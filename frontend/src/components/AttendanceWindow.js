import { useEffect, useState, useCallback } from "react";
import { startSession, stopSession, getActiveSession } from "../services/api";
import { Play, Square, Clock, Key } from "lucide-react";

export default function AttendanceWindow({ subjectId }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(10);
  const [remaining, setRemaining] = useState(0);

  const fetchSession = useCallback(async () => {
    try {
      const { data } = await getActiveSession(subjectId);
      if (data.active) { setSession(data); setRemaining(data.remaining_seconds); }
      else { setSession(null); setRemaining(0); }
    } catch {}
  }, [subjectId]);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 15000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  useEffect(() => {
    if (!session) return;
    if (remaining <= 0) { setSession(null); return; }
    const timer = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(timer);
  }, [session, remaining]);

  async function handleStart() {
    setLoading(true);
    try {
      const { data } = await startSession(subjectId, duration);
      setSession({ ...data, active: true });
      setRemaining(duration * 60);
    } catch { alert("Failed to start session. Please try again."); }
    finally { setLoading(false); }
  }

  async function handleStop() {
    setLoading(true);
    try { await stopSession(subjectId); setSession(null); setRemaining(0); }
    catch { alert("Failed to stop session. Please try again."); }
    finally { setLoading(false); }
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const cardStyle = {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "14px",
    padding: "24px",
    marginBottom: "24px",
  };

  return (
    <div style={cardStyle}>
      <h3 className="text-base font-semibold text-white mb-4">Attendance Window</h3>

      {session ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-300 font-medium text-sm">Attendance Active</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl text-center"
              style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <Key size={18} className="mx-auto text-blue-400 mb-1" />
              <div className="text-3xl font-bold text-blue-300 tracking-widest">{session.otp}</div>
              <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Student OTP</div>
            </div>
            <div className="p-4 rounded-xl text-center"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
              <Clock size={18} className="mx-auto text-yellow-400 mb-1" />
              <div className="text-3xl font-bold" style={{ color: remaining < 60 ? "#f87171" : "#fbbf24" }}>
                {formatTime(remaining)}
              </div>
              <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Time Remaining</div>
            </div>
          </div>

          <button onClick={handleStop} disabled={loading}
            className="w-full flex items-center justify-center gap-2 font-semibold py-2.5 rounded-xl text-sm text-white transition disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #ef4444, #b91c1c)", boxShadow: "0 4px 15px rgba(239,68,68,0.3)" }}>
            <Square size={14} /> Stop Attendance
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Attendance Inactive</span>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Duration (minutes)</label>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }}>
              {[5, 10, 15, 20, 30].map((m) => <option key={m} value={m} style={{ background: "#1a3461" }}>{m} minutes</option>)}
            </select>
          </div>

          <button onClick={handleStart} disabled={loading}
            className="w-full flex items-center justify-center gap-2 font-semibold py-2.5 rounded-xl text-sm text-white transition disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", boxShadow: "0 4px 15px rgba(59,130,246,0.3)" }}>
            <Play size={14} /> Start Attendance
          </button>
        </div>
      )}
    </div>
  );
}
