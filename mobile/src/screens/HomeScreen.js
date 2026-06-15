import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getHistory } from "../services/api";

export default function HomeScreen({ navigation }) {
  const [history, setHistory] = useState([]);
  const [name, setName] = useState("");

  useEffect(() => {
    AsyncStorage.getItem("name").then((n) => setName(n || "Student"));
    getHistory().then((r) => setHistory(r.data)).catch(() => {});
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {name}</Text>
        <Text style={styles.sub}>AuraAttend</Text>
      </View>

      <TouchableOpacity
        style={styles.checkinBtn}
        onPress={() => navigation.navigate("CheckIn")}
      >
        <Text style={styles.checkinText}>Mark Attendance</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Recent Check-ins</Text>
      {history.slice(0, 10).map((r) => (
        <View key={r.id} style={styles.record}>
          <View style={{ flex: 1 }}>
            <Text style={styles.recordSubject}>Subject #{r.subject_id}</Text>
            <Text style={styles.recordTime}>
              {new Date(r.timestamp).toLocaleString()}
            </Text>
          </View>
          <View style={[styles.badge, r.status === "present" ? styles.present : styles.partial]}>
            <Text style={styles.badgeText}>{r.status}</Text>
          </View>
        </View>
      ))}
      {history.length === 0 && (
        <Text style={styles.empty}>No attendance records yet.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { backgroundColor: "#4f46e5", padding: 24, paddingTop: 48 },
  greeting: { fontSize: 22, fontWeight: "700", color: "#fff" },
  sub: { fontSize: 13, color: "#c7d2fe", marginTop: 2 },
  checkinBtn: {
    margin: 20, backgroundColor: "#4f46e5", borderRadius: 14,
    paddingVertical: 16, alignItems: "center", elevation: 3,
  },
  checkinText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#475569", marginLeft: 20, marginBottom: 8 },
  record: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    marginHorizontal: 20, marginBottom: 8, padding: 14, borderRadius: 12,
    elevation: 1,
  },
  recordSubject: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  recordTime: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  present: { backgroundColor: "#dcfce7" },
  partial: { backgroundColor: "#fef9c3" },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#166534" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 30 },
});
