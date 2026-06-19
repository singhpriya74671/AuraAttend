import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useEffect, lazy, Suspense } from "react";

const API = process.env.REACT_APP_API_URL || "";
function useKeepAlive() {
  useEffect(() => {
    const ping = () => fetch(`${API}/api/health`).catch(() => {});
    ping();
    const id = setInterval(ping, 8 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
}

const Login          = lazy(() => import("./pages/Login"));
const Register       = lazy(() => import("./pages/Register"));
const FacultyRegister = lazy(() => import("./pages/FacultyRegister"));
const Dashboard      = lazy(() => import("./pages/Dashboard"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const AttendanceView = lazy(() => import("./pages/AttendanceView"));
const Reports        = lazy(() => import("./pages/Reports"));
const AdminPanel     = lazy(() => import("./pages/AdminPanel"));
const Predictions    = lazy(() => import("./pages/Predictions"));
const Analytics      = lazy(() => import("./pages/Analytics"));

function Spinner() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1f3d" }}>
      <div style={{ width: 36, height: 36, border: "3px solid rgba(59,130,246,0.3)", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function PrivateRoute({ children }) {
  return localStorage.getItem("token") ? children : <Navigate to="/login" replace />;
}

function RoleRoute() {
  const role = localStorage.getItem("role");
  if (!localStorage.getItem("token")) return <Navigate to="/login" replace />;
  return role === "student" ? <Navigate to="/student" replace /> : <Dashboard />;
}

export default function App() {
  useKeepAlive();
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/faculty" element={<FacultyRegister />} />
          <Route path="/" element={<RoleRoute />} />
          <Route path="/student" element={<PrivateRoute><StudentDashboard /></PrivateRoute>} />
          <Route path="/attendance/:subjectId" element={<PrivateRoute><AttendanceView /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute><AdminPanel /></PrivateRoute>} />
          <Route path="/predictions" element={<PrivateRoute><Predictions /></PrivateRoute>} />
          <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
