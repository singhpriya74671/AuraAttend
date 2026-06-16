import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const login = (email, password, role) =>
  api.post("/api/auth/login", { email, password, role });

export const getActiveSessions = () =>
  api.get("/api/attendance/active-sessions");

export const verifyOtp = (subjectId, otp, lat, lng) =>
  api.post("/api/attendance/verify-otp", { subject_id: subjectId, otp, lat, lng });

export const getMyAttendanceSummary = () =>
  api.get("/api/attendance/my-summary");

export const registerFace = (imageB64) =>
  api.post("/api/attendance/register-face", { image: imageB64 });

export const faceCheckin = (subjectId, otp, imageB64, lat, lng) =>
  api.post("/api/attendance/face-checkin", { subject_id: subjectId, otp, image: imageB64, lat, lng });

export const getFaceStatus = () =>
  api.get("/api/attendance/face-status");

export const presenceCheck = (subjectId, imageB64) =>
  api.post("/api/attendance/presence-check", { subject_id: subjectId, image: imageB64 });

export const getMySubjectDetail = (subjectId) =>
  api.get(`/api/attendance/my-subject/${subjectId}`);

export const attentionCheck = (sessionId, imageB64) =>
  api.post("/api/attendance/attention-check", { session_id: sessionId, image: imageB64 });

export const getMe = () => api.get("/api/auth/me");

export const getSubjects = () => api.get("/api/faculty/subjects");

export const getSubjectAttendance = (subjectId) =>
  api.get(`/api/faculty/attendance/${subjectId}`);

export const getHeatmap = (subjectId) =>
  api.get(`/api/faculty/heatmap/${subjectId}`);

export const getAnomalies = (subjectId) =>
  api.get(`/api/faculty/anomalies/${subjectId}`);

export const overrideAttendance = (recordId, status, note) =>
  api.post("/api/faculty/override", { record_id: recordId, status, note });

export const downloadReport = (subjectId) =>
  api.get(`/api/faculty/report/${subjectId}`, { responseType: "blob" });

export const askChatbot = (subjectId, query) =>
  api.post("/api/chatbot", { subject_id: subjectId, query });

export const getAdminStats = () => api.get("/api/admin/dashboard/stats");

export const getNotifications = () => api.get("/api/admin/notifications");
export const getPredictions = (subjectId) => api.get(`/api/faculty/predictions/${subjectId}`);
export const getAllPredictions = () => api.get("/api/faculty/predictions-all");

export const getAdminStudents = () => api.get("/api/admin/students");
export const addAdminStudent = (data) => api.post("/api/admin/students", data);
export const deleteAdminStudent = (id) => api.delete(`/api/admin/students/${id}`);

export const getAdminSubjects = () => api.get("/api/admin/subjects");
export const addAdminSubject = (data) => api.post("/api/admin/subjects", data);
export const deleteAdminSubject = (id) => api.delete(`/api/admin/subjects/${id}`);

export const getAdminFaculty = () => api.get("/api/admin/faculty");
export const addAdminFaculty = (data) => api.post("/api/admin/faculty", data);
export const deleteAdminFaculty = (id) => api.delete(`/api/admin/faculty/${id}`);

export const startSession = (subjectId, durationMinutes) =>
  api.post("/api/faculty/session/start", { subject_id: subjectId, duration_minutes: durationMinutes });

export const stopSession = (subjectId) =>
  api.post("/api/faculty/session/stop", { subject_id: subjectId });

export const getActiveSession = (subjectId) =>
  api.get(`/api/faculty/session/active/${subjectId}`);

// Class Cancellation
export const cancelClass = (subjectId, cancelDate, reason) =>
  api.post("/api/faculty/cancel-class", { subject_id: subjectId, cancel_date: cancelDate, reason });

export const getFacultyCancellations = (subjectId) =>
  api.get(`/api/faculty/cancellations${subjectId ? `?subject_id=${subjectId}` : ""}`);

export const deleteCancellation = (id) =>
  api.delete(`/api/faculty/cancellations/${id}`);

export const getMyNotices = () =>
  api.get("/api/attendance/my-notices");

export default api;
