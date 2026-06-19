import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../services/api";
import toast from "react-hot-toast";
import { Mail, Lock, Eye, EyeOff, Shield, GraduationCap } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) { toast.error("Please enter your email."); return; }
    if (!password) { toast.error("Please enter your password."); return; }
    setLoading(true);
    try {
      const { data } = await login(email, password, role);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);
      localStorage.setItem("email", data.email || email);
      if (rememberMe) localStorage.setItem("rememberedEmail", email);
      toast.success(`Welcome, ${data.name}!`);
      navigate(data.role === "student" ? "/student" : "/");
    } catch (err) {
      const msg = err.response?.data?.error;
      if (err.response?.status === 404) {
        toast.error(msg || "No account found. Please register first.");
      } else if (err.response?.status === 401) {
        toast.error(msg || "Incorrect password. Please try again.");
      } else if (err.response?.status === 400) {
        toast.error(msg || "Please fill in all fields.");
      } else {
        toast.error(msg || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function openForgot() {
    setForgotStep(1); setForgotEmail(""); setForgotOtp(""); setNewPassword("");
    setShowForgot(true);
  }

  async function sendOtp() {
    if (!forgotEmail.trim()) { toast.error("Enter your email."); return; }
    setForgotLoading(true);
    try {
      const { data } = await import("../services/api").then(({ default: api }) =>
        api.post("/api/auth/forgot-password", { email: forgotEmail })
      );
      if (data.dev_otp) {
        // Email not configured — show OTP directly so user can still reset
        setForgotOtp(data.dev_otp);
        toast.success(`OTP: ${data.dev_otp} (email unavailable — auto-filled)`, { duration: 8000 });
      } else {
        toast.success("OTP sent to your email!");
      }
      setForgotStep(2);
    } catch (err) {
      toast.error(err.response?.data?.error || "Email not found.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function resetPassword() {
    if (!forgotOtp.trim()) { toast.error("Enter the OTP."); return; }
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setForgotLoading(true);
    try {
      await import("../services/api").then(({ default: api }) =>
        api.post("/api/auth/reset-password", { email: forgotEmail, otp: forgotOtp, new_password: newPassword })
      );
      toast.success("Password reset successfully!");
      setShowForgot(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Invalid or expired OTP.");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0f1f3d 0%, #1a3461 40%, #0d2137 100%)" }}>

      {/* Background decorative circles */}
      <div className="absolute top-[-80px] right-[-80px] w-96 h-96 rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, #4f8ef7, transparent)" }} />
      <div className="absolute bottom-[-100px] left-[-60px] w-80 h-80 rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, #a78bfa, transparent)" }} />
      <div className="absolute top-1/2 left-[-120px] w-64 h-64 rounded-full opacity-5"
        style={{ background: "radial-gradient(circle, #60a5fa, transparent)" }} />

      {/* Glassmorphism Card */}
      <div className="w-full max-w-md mx-4 z-10"
        style={{
          background: "rgba(255,255,255,0.07)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "24px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
        }}>

        {/* Header */}
        <div className="px-8 pt-10 pb-6 text-center border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {/* Institution Logo */}
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.12)", border: "2px solid rgba(255,255,255,0.2)" }}>
              <GraduationCap size={38} className="text-blue-300" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">AttendNow</h1>
          <p className="text-blue-300 text-xs mt-1 tracking-widest uppercase">
            Indira Gandhi Delhi Technical University for Women
          </p>
          <p className="text-gray-400 text-xs mt-0.5">Smart AI-Powered Attendance System</p>
        </div>

        {/* Form */}
        <div className="px-8 py-8">
          {/* Role Toggle */}
          <div className="flex rounded-xl p-1 mb-7"
            style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {[{ key: "admin", label: "Faculty / Admin", icon: Shield },
              { key: "student", label: "Student", icon: GraduationCap }].map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => setRole(key)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                style={role === key ? {
                  background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                  color: "#fff",
                  boxShadow: "0 4px 15px rgba(59,130,246,0.4)",
                } : { color: "rgba(255,255,255,0.5)" }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium mb-1.5 tracking-wide" style={{ color: "rgba(255,255,255,0.6)" }}>
                {role === "student" ? "Email Address" : "Faculty ID / Email"}
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.35)" }} />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder={role === "student" ? "student@igdtuw.ac.in" : "faculty@igdtuw.ac.in"}
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                  onFocus={e => e.target.style.borderColor = "rgba(99,130,246,0.6)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium mb-1.5 tracking-wide" style={{ color: "rgba(255,255,255,0.6)" }}>
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.35)" }} />
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-11 py-3 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                  onFocus={e => e.target.style.borderColor = "rgba(99,130,246,0.6)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition"
                  style={{ color: "rgba(255,255,255,0.35)" }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me + Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-500" />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Remember me</span>
              </label>
              <button type="button" onClick={openForgot}
                className="text-xs text-blue-400 hover:text-blue-300 transition">
                Forgot password?
              </button>
            </div>

            {/* Login Button */}
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 mt-2 disabled:opacity-60"
              style={{
                background: loading ? "rgba(59,130,246,0.5)" : "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                boxShadow: loading ? "none" : "0 8px 25px rgba(59,130,246,0.4)",
              }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : `Sign In as ${role === "student" ? "Student" : "Faculty / Admin"}`}
            </button>

            {/* Register Link */}
            {role === "student" ? (
              <p className="text-center text-xs mt-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                New student?{" "}
                <Link to="/register" className="text-blue-400 hover:text-blue-300 font-semibold transition">
                  Create your account →
                </Link>
              </p>
            ) : (
              <p className="text-center text-xs mt-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                New faculty member?{" "}
                <Link to="/register/faculty" className="text-blue-400 hover:text-blue-300 font-semibold transition">
                  Create your account →
                </Link>
              </p>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 text-center">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            🔒 Secured with AES-256 encryption &nbsp;·&nbsp; IGDTUW © 2026
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-sm p-6 rounded-2xl"
            style={{
              background: "rgba(15,31,61,0.95)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}>
            <h3 className="text-lg font-semibold text-white mb-1">
              {forgotStep === 1 ? "Reset Password" : "Enter OTP"}
            </h3>
            <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.45)" }}>
              {forgotStep === 1
                ? "Enter your registered email to receive a 6-digit OTP."
                : `OTP sent to ${forgotEmail}. Valid for 10 minutes.`}
            </p>

            {forgotStep === 1 ? (
              <>
                <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none mb-4"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }} />
                <button onClick={sendOtp} disabled={forgotLoading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
                  {forgotLoading ? "Sending..." : "Send OTP"}
                </button>
              </>
            ) : (
              <>
                <input type="text" value={forgotOtp} maxLength={6}
                  onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit OTP"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none mb-3 text-center tracking-widest font-bold"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }} />
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 characters)"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none mb-4"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }} />
                <button onClick={resetPassword} disabled={forgotLoading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 mb-2"
                  style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
                  {forgotLoading ? "Resetting..." : "Reset Password"}
                </button>
                <button onClick={() => setForgotStep(1)}
                  className="w-full text-xs text-center py-2 transition" style={{ color: "rgba(255,255,255,0.35)" }}>
                  <- Use a different email
                </button>
              </>
            )}

            <button onClick={() => setShowForgot(false)}
              className="w-full text-xs text-center mt-2 py-1 transition" style={{ color: "rgba(255,255,255,0.25)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
