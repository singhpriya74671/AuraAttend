import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Mail, Lock, Hash, BookOpen, Phone, ArrowRight, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react";
import FaceCapture5 from "../components/FaceCapture5";
import toast from "react-hot-toast";
import api from "../services/api";

const DEPARTMENTS = ["ECE-AI", "CSE", "ECE", "EEE", "ME", "CE", "IT"];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

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

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function Register() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "",
    roll_number: "", department: "ECE-AI", semester: "7",
    phone: "", parent_email: "",
  });
  const navigate = useNavigate();

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function validateStep1() {
    if (!form.name.trim()) {
      toast.error("Full name is required."); return false;
    }
    if (!form.email.trim()) {
      toast.error("Email is required."); return false;
    }
    if (!isValidEmail(form.email.trim())) {
      toast.error("Enter a valid email address."); return false;
    }
    if (!form.roll_number.trim()) {
      toast.error("Roll number is required."); return false;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters."); return false;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match."); return false;
    }
    return true;
  }

  async function submitRegistration(images) {
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/register/student", {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        roll_number: form.roll_number.trim(),
        department: form.department,
        semester: parseInt(form.semester),
        phone: form.phone.trim(),
        parent_email: form.parent_email.trim(),
        face_images: images,
      });

      // Auto-login: store token and redirect immediately
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);
      localStorage.setItem("email", data.email);

      setFaceRegistered(data.face_registered);
      setStep(3);
    } catch (err) {
      const msg = err.response?.data?.error;
      const status = err.response?.status;
      if (status === 409) {
        toast.error(msg || "This email or roll number is already registered.");
        setStep(1);
      } else if (status === 400) {
        toast.error(msg || "Please fill in all required fields.");
        setStep(1);
      } else {
        toast.error(msg || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleFaceComplete(images) { submitRegistration(images); }
  function handleSkipFace()           { submitRegistration([]); }

  const bg = { background: "linear-gradient(135deg, #0f1f3d 0%, #1a3461 40%, #0d2137 100%)" };
  const card = {
    background: "rgba(255,255,255,0.07)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "20px",
    boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
  };

  // ── Step 3: Success + auto-redirect ──────────────────────────────────────
  if (step === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={bg}>
        <div className="w-full max-w-md p-10 text-center space-y-5" style={card}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "rgba(16,185,129,0.2)", border: "2px solid rgba(16,185,129,0.4)" }}>
            <CheckCircle size={40} className="text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Registration Complete!</h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            {faceRegistered
              ? "Your account and Face ID have been registered. You are now signed in!"
              : "Your account has been created. You can set up Face ID later from your dashboard."}
          </p>
          {!faceRegistered && (
            <div className="px-4 py-3 rounded-xl text-xs" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "rgba(253,230,138,0.8)" }}>
              Face ID skipped — you can register it from the Student Dashboard under "Face ID" tab.
            </div>
          )}
          <button onClick={() => navigate("/student")}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", boxShadow: "0 8px 25px rgba(59,130,246,0.35)" }}>
            Go to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={bg}>
      <div className="absolute top-[-80px] right-[-80px] w-96 h-96 rounded-full opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, #4f8ef7, transparent)" }} />
      <div className="absolute bottom-[-100px] left-[-60px] w-80 h-80 rounded-full opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, #a78bfa, transparent)" }} />

      <div className="w-full max-w-lg z-10 overflow-hidden" style={card}>
        {/* Header */}
        <div className="px-8 py-6" style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(29,78,216,0.1))",
          borderBottom: "1px solid rgba(255,255,255,0.08)"
        }}>
          <h1 className="text-xl font-bold text-white">AuraAttend</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Student Registration</p>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {["Personal Info", "Face ID Setup"].map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition"
                  style={step > i + 1 ? { background: "#10b981", color: "#fff" }
                    : step === i + 1 ? { background: "#fff", color: "#1d4ed8" }
                    : { background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
                  {step > i + 1 ? "✓" : i + 1}
                </div>
                <span className="text-xs font-medium"
                  style={{ color: step === i + 1 ? "#fff" : "rgba(255,255,255,0.35)" }}>
                  {label}
                </span>
                {i < 1 && <div className="w-10 h-px mx-1" style={{ background: "rgba(255,255,255,0.15)" }} />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-8">
          {/* ── Step 1: Personal Info ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="col-span-2">
                  <label style={labelStyle}>Full Name *</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input type="text" value={form.name} onChange={e => update("name", e.target.value)}
                      placeholder="Priya Sharma" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = "rgba(99,130,246,0.6)"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"} />
                  </div>
                </div>

                {/* Email */}
                <div className="col-span-2">
                  <label style={labelStyle}>Email Address *</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input type="email" value={form.email} onChange={e => update("email", e.target.value)}
                      placeholder="priya@igdtuw.ac.in" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = "rgba(99,130,246,0.6)"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"} />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label style={labelStyle}>Password *</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input type={showPw ? "text" : "password"} value={form.password} onChange={e => update("password", e.target.value)}
                      placeholder="Min 6 characters" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = "rgba(99,130,246,0.6)"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"} />
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label style={labelStyle}>Confirm Password *</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input type={showPw ? "text" : "password"} value={form.confirmPassword} onChange={e => update("confirmPassword", e.target.value)}
                      placeholder="Repeat password" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = "rgba(99,130,246,0.6)"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"} />
                  </div>
                </div>

                {/* Show password toggle */}
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer w-fit">
                    <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-blue-500" />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Show passwords</span>
                  </label>
                </div>

                {/* Roll Number */}
                <div>
                  <label style={labelStyle}>Roll Number *</label>
                  <div className="relative">
                    <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input type="text" value={form.roll_number} onChange={e => update("roll_number", e.target.value)}
                      placeholder="00714803122" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = "rgba(99,130,246,0.6)"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"} />
                  </div>
                </div>

                {/* Semester */}
                <div>
                  <label style={labelStyle}>Semester *</label>
                  <div className="relative">
                    <BookOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <select value={form.semester} onChange={e => update("semester", e.target.value)}
                      style={{ ...inputStyle, paddingLeft: "36px" }}>
                      {SEMESTERS.map(s => <option key={s} value={s} style={{ background: "#1a3461" }}>Semester {s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Department */}
                <div className="col-span-2">
                  <label style={labelStyle}>Department *</label>
                  <select value={form.department} onChange={e => update("department", e.target.value)}
                    style={{ ...inputStyle, paddingLeft: "12px" }}>
                    {DEPARTMENTS.map(d => <option key={d} value={d} style={{ background: "#1a3461" }}>{d}</option>)}
                  </select>
                </div>

                {/* Phone */}
                <div>
                  <label style={labelStyle}>Phone (optional)</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input type="tel" value={form.phone} onChange={e => update("phone", e.target.value)}
                      placeholder="+91 9999999999" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = "rgba(99,130,246,0.6)"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"} />
                  </div>
                </div>

                {/* Parent Email */}
                <div>
                  <label style={labelStyle}>Parent Email (optional)</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input type="email" value={form.parent_email} onChange={e => update("parent_email", e.target.value)}
                      placeholder="parent@gmail.com" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = "rgba(99,130,246,0.6)"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"} />
                  </div>
                </div>
              </div>

              <button onClick={() => validateStep1() && setStep(2)}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition"
                style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", boxShadow: "0 8px 25px rgba(59,130,246,0.35)" }}>
                Next: Face ID Setup <ArrowRight size={16} />
              </button>

              <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                Already have an account?{" "}
                <Link to="/login" className="text-blue-400 hover:text-blue-300 font-semibold">Sign in</Link>
              </p>
            </div>
          )}

          {/* ── Step 2: Face ID ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm mb-3 transition"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>
                  <ArrowLeft size={14} /> Back
                </button>
                <h3 className="text-base font-semibold text-white">Register Your Face ID</h3>
                <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Capture 8 photos from different angles for accurate recognition.
                </p>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Creating your account…</p>
                </div>
              ) : (
                <>
                  <FaceCapture5 onComplete={handleFaceComplete} onCancel={() => setStep(1)} />

                  {/* Skip option */}
                  <div className="text-center pt-1">
                    <button onClick={handleSkipFace}
                      className="text-xs transition"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                      onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.6)"}
                      onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}>
                      Skip Face ID for now — set it up later from dashboard
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
