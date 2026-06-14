import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, LogOut, ShieldCheck, Brain, BarChart2, GraduationCap } from "lucide-react";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin", icon: ShieldCheck, label: "Admin Panel" },
  { to: "/analytics", icon: BarChart2, label: "Analytics" },
  { to: "/predictions", icon: Brain, label: "ML Predictions" },
  { to: "/reports", icon: FileText, label: "Reports" },
];

export default function Sidebar() {
  const navigate = useNavigate();

  return (
    <aside className="w-64 min-h-screen flex flex-col flex-shrink-0" style={{
      background: "rgba(255,255,255,0.05)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderRight: "1px solid rgba(255,255,255,0.08)",
    }}>
      {/* Logo */}
      <div className="px-6 py-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
            <GraduationCap size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">AuraAttend</h2>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>IGDTUW</p>
          </div>
        </div>
        <p className="text-xs mt-3 px-1 truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
          {localStorage.getItem("name")}
        </p>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-4 py-4 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end
            style={({ isActive }) => isActive ? {
              display: "flex", alignItems: "center", gap: "12px",
              padding: "10px 16px", borderRadius: "12px",
              fontSize: "14px", fontWeight: "500",
              background: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(29,78,216,0.15))",
              border: "1px solid rgba(59,130,246,0.3)",
              color: "#fff", textDecoration: "none",
            } : {
              display: "flex", alignItems: "center", gap: "12px",
              padding: "10px 16px", borderRadius: "12px",
              fontSize: "14px", fontWeight: "500",
              color: "rgba(255,255,255,0.45)",
              border: "1px solid transparent",
              textDecoration: "none",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (!e.currentTarget.classList.contains('active')) e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { if (!e.currentTarget.classList.contains('active')) e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Sign Out */}
      <button
        onClick={() => { localStorage.clear(); navigate("/login"); }}
        className="flex items-center gap-3 px-7 py-4 text-sm transition-all"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}
        onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
        onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}
      >
        <LogOut size={16} />
        Sign Out
      </button>
    </aside>
  );
}
