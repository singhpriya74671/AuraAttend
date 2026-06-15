import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { RNCamera } from "react-native-camera";
import Geolocation from "react-native-geolocation-service";
import { checkin } from "../services/api";
import Toast from "react-native-toast-message";

export default function CheckInScreen({ navigation }) {
  const cameraRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  async function handleCheckIn() {
    setLoading(true);
    try {
      // Capture frame
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        fixOrientation: true,
      });

      // Get GPS
      const position = await new Promise((resolve, reject) =>
        Geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 })
      );

      const { data } = await checkin({
        image: `data:image/jpeg;base64,${photo.base64}`,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        wifi_ap: null,
      });

      setStatus({ success: true, message: data.message, subject: data.subject, status: data.status });
      Toast.show({ type: "success", text1: "Attendance Marked", text2: `${data.subject} — ${data.status}` });
    } catch (err) {
      const msg = err.response?.data?.error || "Check-in failed. Please try again.";
      setStatus({ success: false, message: msg });
      Toast.show({ type: "error", text1: "Check-in Failed", text2: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <RNCamera
        ref={cameraRef}
        style={styles.camera}
        type={RNCamera.Constants.Type.front}
        captureAudio={false}
        androidCameraPermissionOptions={{ title: "Camera", message: "AuraAttend needs camera access", buttonPositive: "Allow" }}
      >
        <View style={styles.overlay}>
          <View style={styles.faceGuide} />
        </View>
      </RNCamera>

      {status && (
        <View style={[styles.statusBox, status.success ? styles.successBox : styles.errorBox]}>
          <Text style={styles.statusText}>{status.message}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.btn} onPress={handleCheckIn} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Verify & Mark Attendance</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  faceGuide: {
    width: 220, height: 280, borderRadius: 110,
    borderWidth: 2, borderColor: "rgba(99,102,241,0.8)", borderStyle: "dashed",
  },
  statusBox: { margin: 16, padding: 12, borderRadius: 10 },
  successBox: { backgroundColor: "#dcfce7" },
  errorBox: { backgroundColor: "#fee2e2" },
  statusText: { textAlign: "center", fontSize: 14, fontWeight: "500", color: "#1e293b" },
  btn: {
    margin: 16, backgroundColor: "#4f46e5", borderRadius: 14,
    paddingVertical: 16, alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
