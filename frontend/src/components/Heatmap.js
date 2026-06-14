import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function Heatmap({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No data available yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.count));

  function barColor(count) {
    const intensity = count / max;
    if (intensity > 0.75) return "#3b82f6";
    if (intensity > 0.5) return "#60a5fa";
    if (intensity > 0.25) return "#93c5fd";
    return "#bfdbfe";
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.35)" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.35)" }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          formatter={(v) => [`${v} check-ins`, "Attendance"]}
          contentStyle={{
            borderRadius: 10, fontSize: 12,
            background: "rgba(15,31,61,0.95)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff",
          }}
          labelStyle={{ color: "rgba(255,255,255,0.6)" }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={barColor(entry.count)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
