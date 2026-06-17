export default function AttendanceTable({ records, onOverride }) {
  function pctStyle(pct) {
    if (pct >= 75) return { background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" };
    if (pct >= 60) return { background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" };
    return { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" };
  }

  function LocationCell({ geo_verified, gps_lat, last_marked_at }) {
    const dt = last_marked_at ? new Date(last_marked_at) : null;
    const dateStr = dt ? dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null;
    const timeStr = dt ? dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : null;

    return (
      <div className="space-y-1">
        {geo_verified ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}>
            ✓ Inside Campus
          </span>
        ) : gps_lat != null ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
            ✗ Outside Campus
          </span>
        ) : (
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "11px" }}>—</span>
        )}
        {dateStr && (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}>
            {dateStr} · {timeStr}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {["Roll No.", "Name", "Classes", "Present", "Percentage", "Last Location", "Actions"].map((h) => (
              <th key={h} className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide"
                style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={r.student_id} style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <td className="px-4 py-3 font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>{r.roll_number}</td>
              <td className="px-4 py-3 font-medium text-white">{r.name}</td>
              <td className="px-4 py-3" style={{ color: "rgba(255,255,255,0.45)" }}>{r.total}</td>
              <td className="px-4 py-3" style={{ color: "rgba(255,255,255,0.45)" }}>{r.present}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={pctStyle(r.percentage)}>
                  {r.percentage}%
                </span>
              </td>
              <td className="px-4 py-3">
                <LocationCell geo_verified={r.geo_verified} gps_lat={r.gps_lat} last_marked_at={r.last_marked_at} />
              </td>
              <td className="px-4 py-3">
                <button onClick={() => onOverride(r.student_id, "present")}
                  className="text-xs mr-3 transition"
                  style={{ color: "#60a5fa" }}
                  onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                  Mark Present
                </button>
                <button onClick={() => onOverride(r.student_id, "absent")}
                  className="text-xs transition"
                  style={{ color: "#f87171" }}
                  onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                  Mark Absent
                </button>
              </td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
                No attendance records yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
