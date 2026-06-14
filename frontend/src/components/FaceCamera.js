import { useRef, useEffect, useState } from "react";
import { Camera, RefreshCw } from "lucide-react";

export default function FaceCamera({ onCapture, onCancel, actionLabel = "Capture" }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [captured, setCaptured] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setReady(true);
      }
    } catch {
      setError("Camera access denied. Please allow camera permission in your browser settings.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCaptured(dataUrl);
    stopCamera();
  }

  function retake() {
    setCaptured(null);
    startCamera();
  }

  function confirm() {
    if (captured) onCapture(captured);
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <Camera size={32} className="mx-auto text-red-400 mb-2" />
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={onCancel} className="mt-3 text-sm text-gray-500 underline">Cancel</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        {!captured ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
        ) : (
          <img src={captured} alt="captured" className="w-full h-full object-cover scale-x-[-1]" />
        )}
        <canvas ref={canvasRef} className="hidden" />

        {!captured && ready && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-56 border-4 border-white/60 rounded-full" />
          </div>
        )}

        {!ready && !captured && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
            Initializing camera…
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {!captured ? (
          <>
            <button onClick={onCancel}
              className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={capture} disabled={!ready}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50">
              <Camera size={16} /> Take Photo
            </button>
          </>
        ) : (
          <>
            <button onClick={retake}
              className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
              <RefreshCw size={14} /> Retake
            </button>
            <button onClick={confirm}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium transition">
              {actionLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
