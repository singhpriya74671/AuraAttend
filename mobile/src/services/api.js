import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://10.0.2.2:5000"; // Android emulator → localhost

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const login = (email, password) =>
  api.post("/api/auth/login", { email, password });

export const checkin = (payload) =>
  api.post("/api/attendance/checkin", payload);

export const getHistory = () => api.get("/api/attendance/history");

export const getPercentage = (studentId, subjectId) =>
  api.get(`/api/attendance/percentage/${studentId}/${subjectId}`);

export default api;
