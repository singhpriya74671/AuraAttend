import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getSubjectAttendance, getHeatmap, getAnomalies, overrideAttendance, downloadReport } from "../services/api";
import Sidebar from "../components/Sidebar";
import AttendanceTable from "../components/AttendanceTable";
import Heatmap from "../components/Heatmap";
import toast from "react-hot-toast";
import { Download, AlertTriangle } from "lucide-react";

const card = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "14px",
};

export default function AttendanceView() {
  const { subjectId } = useParams();
  const [records, setRecords] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSubjectAttendance(subjectId),
      getHeatmap(subjectId),
      getAnomalies(subjectId),
    ]).then(([att, heat, anom]) => {
      setRecords(att.data); setHeatmapData(heat.data); setAnomalies(anom.data);
    }).finally(() => setLoading(false));
  }, [subjectId]);

  async function handleOverride(recordId, status) {
    try {
      await overrideAttendance(recordId, status, "Manual override by faculty");
      toast.success("Attendance updated");
      const { data } = await getSubjectAttendance(subjectId);
      setRecords(data);
    } catch { toast.error("Update failed"); }
  }

  async function handleDownload() {
    try {
      const { data } = await downloadReport(subjectId);
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = `attendance_${subjectId}.pdf`; a.click();
    } catch { toast.error("Report generation failed"); }
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8" style={{ color: "#fff" }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Attendance Details</h1>
          <button onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", boxShadow: "0 4px 15px rgba(59,130,246,0.3)" }}>
            <Download size={15} /> Download PDF
          </button>
        </div>

        {anomalies.length > 0 && (
          <div className="p-4 mb-6 rounded-xl" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
            <div className="flex items-center gap-2 font-semibold mb-2 text-yellow-300">
              <AlertTriangle size={16} /> {anomalies.length} Anomalies Detected
            </div>
            <ul className="text-sm space-y-1" style={{ color: "rgba(253,230,138,0.8)" }}>
              {anomalies.slice(0, 5).map((a) => (
                <li key={a.id}>• [{a.severity.toUpperCase()}] {a.description}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="p-5 mb-6" style={card}>
          <h2 className="font-semibold text-white mb-3">Daily Attendance Heatmap</h2>
          <Heatmap data={heatmapData} />
        </div>

        <div className="p-5" style={card}>
          <h2 className="font-semibold text-white mb-3">Student Attendance</h2>
          {loading ? (
            <div className="py-8 text-center">
              <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <AttendanceTable records={records} onOverride={handleOverride} />
          )}
        </div>
      </main>
    </div>
  );
}
