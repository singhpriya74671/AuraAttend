import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Mail, Lock, BookOpen, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";

const DEPARTMENTS = ["ECE-AI", "CSE", "ECE", "EEE", "ME", "CE", "IT", "Mathematics", "Physics", "English"];

const inputStyle = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "10px",
  color: "#fff",
  fontSize: "14px",
  padding: "10px 12px 10px 36px",
  width: "100%",
  outline: "none",
};

const labelStyle = {
  display: "block",
  fontSize: "11px",
  fontWeight: "500",
  color: "rgba(255,255,255,0.55)",
  marginBottom: "6px",
  letterSpacing: "0.03em",
};

export default function FacultyRegister() {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "", department: "ECE-AI",
  });
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    if (!form.name.trim())        { toast.error("Name is required."); return false; }
    if (!form.email.trim())       { toast.error("Email is required."); return false; }
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters."); return false; }
    if (form.password !== form.confirmPassword) { toast.error("Passwords do not match."); return false; }
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post("/api/auth/register/faculty", {
        name: form.name,
        email: form.email.toLowerCase(),
        password: form.password,
        department: form.department,
      });
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const bg = { background: "linear-gradient(135deg, #0f1f3d 0%, #1a3461 40%, #0d2137 100%)" };
  const card = {
    background: "rgba(255,255,255,0.07)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "20px",
    boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={bg}>
        <div className="w-full max-w-md p-10 text-center space-y-5" style={card}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "rgba(16,185,129,0.2)", border: "2px solid rgba(16,185,129,0.4)" }}>
            <CheckCircle size={40} className="text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Registration Successful!</h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            Your faculty account has been created. You can now sign in with your credentials.
          </p>
          <button onClick={() => navigate("/login")}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", boxShadow: "0 8px 25px rgba(59,130,246,0.35)" }}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={bg}>
      {/* Decorative blobs */}
      <div className="absolute top-[-80px] right-[-80px] w-96 h-96 rounded-full opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, #4f8ef7, transparent)" }} />
      <div className="absolute bottom-[-100px] left-[-60px] w-80 h-80 rounded-full opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, #a78bfa, transparent)" }} />

      <div className="w-full max-w-md z-10" style={card}>
        {/* Header */}
        <div className="px-8 py-6" style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(29,78,216,0.1))",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "20px 20px 0 0",
        }}>
          <h1 className="text-xl font-bold text-white">AttendNow</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Faculty Registration</p>
          <p className="text-xs mt-2 px-2 py-1 rounded-lg inline-block"
            style={{ background: "rgba(59,130,246,0.15)", color: "rgba(147,197,253,0.9)", border: "1px solid rgba(59,130,246,0.25)" }}>
            IGDTUW — Faculty / Lecturer Account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {/* Full Name */}
          <div>
            <label style={labelStyle}>Full Name *</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
              <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)}
                placeholder="Enter your full name" style={inputStyle}
                onFocus={e => e.target.style.borderColor = "rgba(99,130,246,0.6)"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"} />
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={labelStyle}>Email Address *</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
                placeholder="faculty@igdtuw.ac.in" style={inputStyle}
                onFocus={e => e.target.style.borderColor = "rgba(99,130,246,0.6)"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"} />
            </div>
          </div>

          {/* Department */}
          <div>
            <label style={labelStyle}>Department *</label>
            <div className="relative">
              <BookOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
              <select value={form.department} onChange={(e) => update("department", e.target.value)}
                style={{ ...inputStyle, paddingLeft: "36px" }}>
                {DEPARTMENTS.map((d) => <option key={d} value={d} style={{ background: "#1a3461" }}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Password */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Password *</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                <input type={showPassword ? "text" : "password"} value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="Min 6 chars" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "rgba(99,130,246,0.6)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Confirm Password *</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                <input type={showPassword ? "text" : "password"} value={form.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  placeholder="Repeat" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "rgba(99,130,246,0.6)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"} />
              </div>
            </div>
          </div>

          {/* Show password toggle */}
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-blue-500" />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Show passwords</span>
          </label>

          {/* Note */}
          <div className="p-3 rounded-xl text-xs" style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)", color: "rgba(253,230,138,0.8)" }}>
            Your account will be created with <strong>Faculty</strong> role. Admin access can be granted by the system administrator.
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", boxShadow: "0 8px 25px rgba(59,130,246,0.35)" }}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating account...
              </span>
            ) : "Create Faculty Account"}
          </button>

          <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            Already have an account?{" "}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-semibold">Sign in</Link>
          </p>
          <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            Registering as a student?{" "}
            <Link to="/register" className="text-blue-400 hover:text-blue-300">Student Registration</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
