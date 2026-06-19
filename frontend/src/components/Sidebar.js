import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, LogOut, ShieldCheck, Brain, BarChart2, GraduationCap, User, Settings, KeyRound, ChevronDown, X } from "lucide-react";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin", icon: ShieldCheck, label: "Admin Panel" },
  { to: "/analytics", icon: BarChart2, label: "Analytics" },
  { to: "/predictions", icon: Brain, label: "ML Predictions" },
  { to: "/reports", icon: FileText, label: "Reports" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);

  const name = localStorage.getItem("name") || "User";
  const role = localStorage.getItem("role") || "admin";
  const email = localStorage.getItem("email") || "";

  function handleLogout() {
    localStorage.clear();
    navigate("/login");
  }

  async function handleChangePassword() {
    if (!pwForm.current) { alert("Enter current password."); return; }
    if (pwForm.newPw.length < 6) { alert("New password must be at least 6 characters."); return; }
    if (pwForm.newPw !== pwForm.confirm) { alert("Passwords do not match."); return; }
    setPwLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      alert("Password changed successfully!");
      setShowChangePassword(false);
      setPwForm({ current: "", newPw: "", confirm: "" });
    } catch (err) {
      alert(err.message);
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <>
      <aside className="w-64 min-h-screen flex flex-col flex-shrink-0" style={{
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(255,255,255,0.08)",
      }}>
        {/* Logo */}
        <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
              <GraduationCap size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">AttendNow</h2>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>IGDTUW</p>
            </div>
          </div>
        </div>

        {/* Profile Section */}
        <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
            style={{ background: showProfileMenu ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
              style={{ background: "linear-gradient(135deg, #3b82f6, #7c3aed)" }}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-white text-sm font-medium truncate">{name}</p>
              <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                {role === "student" ? "Student" : role === "admin" ? "Admin" : "Faculty"}
              </p>
            </div>
            <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.4)", transform: showProfileMenu ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>

          {/* Dropdown Menu */}
          {showProfileMenu && (
            <div className="mt-2 rounded-xl overflow-hidden" style={{ background: "rgba(15,31,61,0.95)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {/* User Info */}
              <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-white text-xs font-semibold">{name}</p>
                {email && <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{email}</p>}
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(59,130,246,0.2)", color: "#93c5fd" }}>
                  {role === "admin" ? "Administrator" : role === "faculty" ? "Faculty" : "Student"}
                </span>
              </div>

              {/* Menu Items */}
              <button onClick={() => { setShowProfileMenu(false); setShowChangePassword(true); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-all text-left"
                style={{ color: "rgba(255,255,255,0.7)" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <KeyRound size={14} /> Change Password
              </button>

              <button onClick={() => { setShowProfileMenu(false); setShowLogoutConfirm(true); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-all text-left"
                style={{ color: "#f87171", borderTop: "1px solid rgba(255,255,255,0.06)" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.08)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end
              onClick={() => setShowProfileMenu(false)}
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
                textDecoration: "none", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { if (!e.currentTarget.getAttribute("aria-current")) e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
            >
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>

        {/* Sign Out Button at Bottom */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="flex items-center gap-3 px-7 py-4 text-sm transition-all"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}
          onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "rgba(15,31,61,0.98)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 25px 60px rgba(0,0,0,0.6)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Sign Out?</h3>
              <button onClick={() => setShowLogoutConfirm(false)} style={{ color: "rgba(255,255,255,0.4)" }}>
                <X size={18} />
              </button>
            </div>
            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
              Are you sure you want to sign out? You will need to log in again to access AttendNow.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
                Cancel
              </button>
              <button onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", boxShadow: "0 4px 15px rgba(239,68,68,0.3)" }}>
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "rgba(15,31,61,0.98)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 25px 60px rgba(0,0,0,0.6)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold text-lg">Change Password</h3>
              <button onClick={() => setShowChangePassword(false)} style={{ color: "rgba(255,255,255,0.4)" }}>
                <X size={18} />
              </button>
            </div>

            {["current", "newPw", "confirm"].map((field, i) => (
              <div key={field} className="mb-4">
                <label className="block text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {["Current Password", "New Password", "Confirm New Password"][i]}
                </label>
                <input type="password" value={pwForm[field]}
                  onChange={e => setPwForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={["Enter current password", "Min 6 characters", "Repeat new password"][i]}
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-600 outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
              </div>
            ))}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowChangePassword(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
                Cancel
              </button>
              <button onClick={handleChangePassword} disabled={pwLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
                {pwLoading ? "Saving..." : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
