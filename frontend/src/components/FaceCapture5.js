import { useRef, useState, useEffect } from "react";
import { Camera, CheckCircle, RotateCcw } from "lucide-react";

const ANGLES = [
  { key: "front",       label: "Look straight at the camera",          hint: "Face the camera directly — neutral expression" },
  { key: "left",        label: "Turn your head to the left",           hint: "Rotate left ~30°" },
  { key: "right",       label: "Turn your head to the right",          hint: "Rotate right ~30°" },
  { key: "up",          label: "Tilt your head slightly upward",       hint: "Look up ~20°" },
  { key: "down",        label: "Tilt your head slightly downward",     hint: "Look down ~20°" },
  { key: "left-45",     label: "Turn your head further to the left",   hint: "Rotate left ~45°" },
  { key: "right-45",    label: "Turn your head further to the right",  hint: "Rotate right ~45°" },
  { key: "front-smile", label: "Look straight and smile naturally",    hint: "Face the camera — slight smile" },
];

export default function FaceCapture5({ onComplete, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [step, setStep] = useState(0);           // 0-4 = current angle
  const [captured, setCaptured] = useState([]);  // array of base64 strings
  const [preview, setPreview] = useState(null);  // current snapshot preview
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch {
      alert("Camera access denied. Please allow camera permissions.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function takePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const b64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
    setPreview(b64);
  }

  function confirmPhoto() {
    const next = [...captured, preview];
    setCaptured(next);
    setPreview(null);
    if (next.length === ANGLES.length) {
      stopCamera();
      onComplete(next);
    } else {
      setStep((s) => s + 1);
    }
  }

  function retake() {
    setPreview(null);
  }

  const angle = ANGLES[step];
  const done = captured.length;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {ANGLES.map((a, i) => (
          <div key={a.key} className="flex-1 flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition ${
              i < done ? "bg-green-500 border-green-500 text-white"
              : i === step && !preview ? "bg-indigo-600 border-indigo-600 text-white"
              : "bg-white border-gray-300 text-gray-400"
            }`}>
              {i < done ? <CheckCircle size={16} /> : i + 1}
            </div>
            <span className="text-xs text-gray-400 text-center leading-tight hidden sm:block">{a.key}</span>
          </div>
        ))}
      </div>

      {/* Instruction */}
      {!preview && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 text-center">
          <p className="text-sm font-semibold text-indigo-700">{angle.label}</p>
          <p className="text-xs text-indigo-500 mt-0.5">{angle.hint}</p>
        </div>
      )}

      {/* Camera / Preview */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
        {/* Oval face guide */}
        {!preview && (
          <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none" viewBox="0 0 640 480">
            <ellipse cx="320" cy="240" rx="140" ry="180"
              fill="none" stroke="rgba(99,102,241,0.7)" strokeWidth="3" strokeDasharray="8 4" />
          </svg>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${preview ? "hidden" : ""}`}
          style={{ transform: "scaleX(-1)" }}
        />
        {preview && (
          <img
            src={`data:image/jpeg;base64,${preview}`}
            alt="Preview"
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Actions */}
      {!preview ? (
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={takePhoto}
            disabled={!cameraReady}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition"
          >
            <Camera size={16} /> Capture ({done + 1}/{ANGLES.length})
          </button>
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={retake}
            className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2"
          >
            <RotateCcw size={14} /> Retake
          </button>
          <button
            onClick={confirmPhoto}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition"
          >
            <CheckCircle size={16} />
            {done + 1 === ANGLES.length ? "Complete" : "Next Angle"}
          </button>
        </div>
      )}
    </div>
  );
}
