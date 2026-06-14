import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { getSubjects } from "../services/api";
import api from "../services/api";
import { BarChart2, TrendingUp, Brain, Building2 } from "lucide-react";

const card = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "16px",
};

export default function Analytics() {
  const [subjects, setSubjects] = useState([]);
  const [deptStats, setDeptStats] = useState([]);
  const [tab, setTab] = useState("department");
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    getSubjects().then(r => setSubjects(r.data)).catch(() => {});
    api.get("/api/faculty/analytics/department").then(r => setDeptStats(r.data)).catch(() => {});
  }, []);

  async function loadSubjectData(subjectId) {
    setSelectedSubject(subjectId); setInsights(null);
    try {
      const [m, h] = await Promise.all([
        api.get(`/api/faculty/analytics/monthly/${subjectId}`),
        api.get(`/api/faculty/analytics/heatmap-data/${subjectId}`),
      ]);
      setMonthly(m.data); setHeatmap(h.data);
    } catch {}
  }

  async function loadInsights(subjectId) {
    setLoadingInsights(true);
    try { const { data } = await api.get(`/api/faculty/insights/${subjectId}`); setInsights(data); }
    catch {} finally { setLoadingInsights(false); }
  }

  const maxPct = Math.max(...deptStats.map(d => d.percentage), 1);
  const maxMonthly = Math.max(...monthly.map(m => m.percentage), 1);

  function pctColor(pct) {
    if (pct >= 75) return "#4ade80";
    if (pct >= 60) return "#fb923c";
    return "#f87171";
  }

  function barColor(pct) {
    if (pct >= 75) return "#22c55e";
    if (pct >= 60) return "#f59e0b";
    return "#ef4444";
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto" style={{ color: "#fff" }}>
        <div className="flex items-center gap-3 mb-6">
          <BarChart2 size={24} className="text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: "department", label: "Department Overview", icon: Building2 },
            { key: "subject", label: "Subject Analytics", icon: TrendingUp },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition"
              style={tab === key ? {
                background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                color: "#fff", boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
              } : {
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.5)",
              }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Department Overview */}
        {tab === "department" && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white">Department-wise Attendance</h2>
            {deptStats.length === 0 ? (
              <EmptyState message="No department data available yet." />
            ) : (
              <div className="p-6 space-y-5" style={card}>
                {deptStats.map((d, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-1.5">
                      <div>
                        <span className="font-medium text-white">{d.department}</span>
                        <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.35)" }}>{d.subjects} subject(s)</span>
                      </div>
                      <span className="font-bold text-sm" style={{ color: pctColor(d.percentage) }}>{d.percentage}%</span>
                    </div>
                    <div className="w-full rounded-full h-3" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${(d.percentage / maxPct) * 100}%`, background: barColor(d.percentage) }} />
                    </div>
                    <div className="flex gap-4 text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                      <span>Records: {d.total_records}</span>
                      <span>Present: {d.present}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subject Analytics */}
        {tab === "subject" && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>Select Subject</label>
              <select
                onChange={e => loadSubjectData(Number(e.target.value))}
                className="w-full max-w-sm rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }}>
                <option value="" style={{ background: "#1a3461" }}>— Select a subject —</option>
                {subjects.map(s => <option key={s.id} value={s.id} style={{ background: "#1a3461" }}>{s.name} ({s.code})</option>)}
              </select>
            </div>

            {selectedSubject && (
              <>
                {/* Monthly Trend */}
                <div className="p-6" style={card}>
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp size={15} className="text-blue-400" /> Monthly Attendance Trend
                  </h3>
                  {monthly.length === 0 ? (
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No monthly data available.</p>
                  ) : (
                    <div className="space-y-3">
                      {monthly.map((m, i) => (
                        <div key={i}>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{m.month}</span>
                            <div className="text-right">
                              <span className="text-sm font-bold" style={{ color: pctColor(m.percentage) }}>{m.percentage}%</span>
                              <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.3)" }}>({m.present}/{m.total})</span>
                            </div>
                          </div>
                          <div className="w-full rounded-full h-2.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                            <div className="h-2.5 rounded-full" style={{ width: `${(m.percentage / Math.max(maxMonthly, 1)) * 100}%`, background: barColor(m.percentage) }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Heatmap */}
                {heatmap.length > 0 && (
                  <div className="p-6" style={card}>
                    <h3 className="font-semibold text-white mb-4">Attendance Heatmap (by Date)</h3>
                    <div className="flex flex-wrap gap-2">
                      {heatmap.map((h, i) => {
                        const pct = h.total > 0 ? (h.present / h.total) * 100 : 0;
                        const bg = pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
                        return (
                          <div key={i} title={`${h.date}: ${h.present}/${h.total} present`}
                            className="w-8 h-8 rounded flex items-center justify-center cursor-pointer"
                            style={{ background: bg, opacity: 0.85 }}>
                            <span className="text-white text-xs font-bold">{new Date(h.date).getDate()}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-4 mt-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "#22c55e" }} /> ≥75%</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "#f59e0b" }} /> 50–74%</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "#ef4444" }} /> &lt;50%</span>
                    </div>
                  </div>
                )}

                {/* AI Insights */}
                <div className="p-6" style={{ ...card, border: "1px solid rgba(59,130,246,0.25)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <Brain size={15} className="text-blue-400" /> AI Insights
                    </h3>
                    <button onClick={() => loadInsights(selectedSubject)} disabled={loadingInsights}
                      className="text-sm px-4 py-1.5 rounded-lg text-white transition disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
                      {loadingInsights ? "Analyzing…" : "Generate Insights"}
                    </button>
                  </div>
                  {insights ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-xl" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
                        <p className="text-sm leading-relaxed" style={{ color: "rgba(147,197,253,0.9)" }}>{insights.summary}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center text-sm">
                        {[
                          { label: "Current Attendance", value: `${insights.current_percentage}%`, good: insights.current_percentage >= 75 },
                          { label: "vs Last Month", value: `${insights.trend_change >= 0 ? "+" : ""}${insights.trend_change}%`, good: insights.trend_change >= 0 },
                          { label: "Below 75%", value: insights.low_attendance_students, good: null },
                        ].map((stat, i) => (
                          <div key={i} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <div className="text-xl font-bold" style={{ color: stat.good === null ? "#fb923c" : stat.good ? "#4ade80" : "#f87171" }}>{stat.value}</div>
                            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{stat.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Click "Generate Insights" to get an AI-powered analysis of this subject's attendance.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-xl p-12 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <BarChart2 size={36} className="mx-auto mb-2" style={{ color: "rgba(255,255,255,0.15)" }} />
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>{message}</p>
    </div>
  );
}
