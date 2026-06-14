import { useEffect, useState } from "react";
import { getSubjects, getPredictions, getAllPredictions } from "../services/api";
import Sidebar from "../components/Sidebar";
import { Brain, TrendingDown, TrendingUp, Minus, AlertTriangle, ChevronDown, ChevronUp, Users } from "lucide-react";

const card = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "14px",
  overflow: "hidden",
};

export default function Predictions() {
  const [subjects, setSubjects] = useState([]);
  const [tab, setTab] = useState("overview");
  const [overviewData, setOverviewData] = useState([]);
  const [subjectData, setSubjectData] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSubjects(), getAllPredictions()])
      .then(([s, p]) => { setSubjects(s.data); setOverviewData(p.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleSubject(subject) {
    if (expanded === subject.id) { setExpanded(null); return; }
    setExpanded(subject.id);
    if (subjectData[subject.id]) return;
    try {
      const { data } = await getPredictions(subject.id);
      setSubjectData((d) => ({ ...d, [subject.id]: data }));
    } catch {}
  }

  function riskBadgeStyle(level) {
    const map = {
      high:   { background: "rgba(239,68,68,0.15)",   color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" },
      medium: { background: "rgba(251,191,36,0.15)",  color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" },
      low:    { background: "rgba(59,130,246,0.15)",  color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" },
      safe:   { background: "rgba(34,197,94,0.15)",   color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" },
    };
    const labels = { high: "High Risk", medium: "Medium Risk", low: "Low Risk", safe: "Safe" };
    return { style: map[level] || map.safe, label: labels[level] || level };
  }

  function RiskBar({ score }) {
    const pct = Math.round(score * 100);
    const color = pct >= 65 ? "#ef4444" : pct >= 45 ? "#f59e0b" : pct >= 20 ? "#60a5fa" : "#22c55e";
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-full h-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-xs w-8 text-right" style={{ color: "rgba(255,255,255,0.4)" }}>{pct}%</span>
      </div>
    );
  }

  function TrendIcon({ trend }) {
    if (trend > 5) return <TrendingUp size={13} style={{ color: "#4ade80" }} />;
    if (trend < -5) return <TrendingDown size={13} style={{ color: "#f87171" }} />;
    return <Minus size={13} style={{ color: "rgba(255,255,255,0.3)" }} />;
  }

  const highRisk = overviewData.filter((d) => d.risk_level === "high");
  const medRisk = overviewData.filter((d) => d.risk_level === "medium");

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8" style={{ color: "#fff" }}>
        <div className="flex items-center gap-3 mb-6">
          <Brain size={26} className="text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">ML Attendance Prediction</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>AI-powered risk analysis to identify students at risk of low attendance</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[{ key: "overview", label: "Overview" }, { key: "subjects", label: "Subject-wise" }].map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition"
              style={tab === key ? {
                background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                color: "#fff", boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
              } : {
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.5)",
              }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Analyzing attendance data…
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {tab === "overview" && (
              <>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { count: highRisk.length, label: "High Risk Students", color: "#f87171", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" },
                    { count: medRisk.length, label: "Medium Risk", color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)" },
                    { count: overviewData.length, label: "Total At Risk", color: "#60a5fa", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)" },
                  ].map((stat, i) => (
                    <div key={i} className="p-4 text-center rounded-xl" style={{ background: stat.bg, border: `1px solid ${stat.border}` }}>
                      <div className="text-3xl font-bold" style={{ color: stat.color }}>{stat.count}</div>
                      <div className="text-sm mt-1" style={{ color: stat.color, opacity: 0.7 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {overviewData.length === 0 ? (
                  <div className="p-12 text-center rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <Brain size={48} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.1)" }} />
                    <p className="font-medium text-white">No at-risk students identified</p>
                    <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>As more attendance data is collected, the AI will begin generating predictions</p>
                  </div>
                ) : (
                  <div style={card}>
                    <div className="px-5 py-3 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <AlertTriangle size={14} className="text-yellow-400" />
                      <span className="text-sm font-semibold text-white">At-Risk Students</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                          <tr>
                            {["Student", "Subject", "Attendance", "Recent 5", "Trend", "Risk Level", "Risk Score"].map((h) => (
                              <th key={h} className="text-left px-4 py-3 font-medium text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {overviewData.map((r, i) => {
                            const badge = riskBadgeStyle(r.risk_level);
                            return (
                              <tr key={i} style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-white">{r.student_name}</div>
                                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{r.roll_number}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div style={{ color: "rgba(255,255,255,0.7)" }}>{r.subject_name}</div>
                                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{r.subject_code}</div>
                                </td>
                                <td className="px-4 py-3 font-semibold" style={{ color: r.attendance_pct >= 75 ? "#4ade80" : r.attendance_pct >= 60 ? "#fbbf24" : "#f87171" }}>
                                  {r.attendance_pct}%
                                </td>
                                <td className="px-4 py-3" style={{ color: "rgba(255,255,255,0.5)" }}>{r.recent_pct}%</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1">
                                    <TrendIcon trend={r.trend} />
                                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{r.trend > 0 ? "+" : ""}{r.trend}%</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={badge.style}>{badge.label}</span>
                                </td>
                                <td className="px-4 py-3 w-32"><RiskBar score={r.risk_score} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Subject-wise Tab */}
            {tab === "subjects" && (
              <div className="space-y-3">
                {subjects.map((s) => {
                  const isOpen = expanded === s.id;
                  const rows = subjectData[s.id] || [];
                  const highCount = rows.filter(r => r.risk_level === "high").length;
                  return (
                    <div key={s.id} style={card}>
                      <div onClick={() => toggleSubject(s)}
                        className="flex items-center justify-between px-5 py-4 cursor-pointer transition"
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div className="flex items-center gap-3">
                          <Users size={16} className="text-blue-400" />
                          <div>
                            <div className="font-medium text-white">{s.name}</div>
                            <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{s.code} · Sem {s.semester}</div>
                          </div>
                          {isOpen && highCount > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                              {highCount} high risk
                            </span>
                          )}
                        </div>
                        {isOpen ? <ChevronUp size={14} style={{ color: "rgba(255,255,255,0.3)" }} /> : <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.3)" }} />}
                      </div>

                      {isOpen && (
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                          {rows.length === 0 ? (
                            <div className="py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                              No at-risk students found — all students are on track!
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                                  <tr>
                                    {["Student", "Attendance", "Last 5 Classes", "Consecutive Absent", "Trend", "Risk"].map((h) => (
                                      <th key={h} className="text-left px-4 py-3 font-medium text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((r, i) => {
                                    const badge = riskBadgeStyle(r.risk_level);
                                    return (
                                      <tr key={i} style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                        <td className="px-4 py-3">
                                          <div className="font-medium text-white">{r.student_name}</div>
                                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{r.roll_number}</div>
                                        </td>
                                        <td className="px-4 py-3 font-semibold" style={{ color: r.attendance_pct >= 75 ? "#4ade80" : r.attendance_pct >= 60 ? "#fbbf24" : "#f87171" }}>
                                          {r.attendance_pct}%
                                        </td>
                                        <td className="px-4 py-3" style={{ color: "rgba(255,255,255,0.5)" }}>{r.recent_pct}%</td>
                                        <td className="px-4 py-3">
                                          {r.consecutive_absences > 0
                                            ? <span style={{ color: "#f87171", fontWeight: "500" }}>{r.consecutive_absences} absent</span>
                                            : <span style={{ color: "#4ade80" }}>0</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex items-center gap-1">
                                            <TrendIcon trend={r.trend} />
                                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{r.trend > 0 ? "+" : ""}{r.trend}%</span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="space-y-1">
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={badge.style}>{badge.label}</span>
                                            <RiskBar score={r.risk_score} />
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
