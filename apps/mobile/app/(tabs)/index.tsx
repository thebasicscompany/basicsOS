import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Screen } from "../../components/Screen";

const modules = [
  { name: "Knowledge", icon: "📚", route: "/hub" },
  { name: "CRM", icon: "🤝", route: "/crm" },
  { name: "Tasks", icon: "✅", route: "/tasks" },
  { name: "Meetings", icon: "🎯", route: "/meetings" },
  { name: "Assistant", icon: "🤖", route: "/assistant" },
  { name: "Hub", icon: "🔗", route: "/hub" },
];

const stats = [
  { label: "Open Tasks", value: "12" },
  { label: "Open Deals", value: "5" },
  { label: "Meetings", value: "3" },
  { label: "Docs", value: "48" },
];

const DashboardScreen = (): JSX.Element => (
  <Screen title="Basics OS">
    <Text style={styles.subtitle}>Acme Corp — Company OS</Text>
    <View style={styles.statsRow}>
      {stats.map((s) => (
        <View key={s.label} style={styles.statCard}>
          <Text style={styles.statValue}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
    <Text style={styles.sectionTitle}>Modules</Text>
    <View style={styles.grid}>
      {modules.map((m) => (
        <TouchableOpacity
          key={m.name}
          style={styles.card}
          onPress={() => router.push(m.route as never)}
        >
          <Text style={styles.icon}>{m.icon}</Text>
          <Text style={styles.cardTitle}>{m.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </Screen>
);

const styles = StyleSheet.create({
  subtitle: { color: "#6b7280", marginBottom: 20, fontSize: 14 },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  statValue: { fontSize: 28, fontWeight: "700", color: "#6366f1" },
  statLabel: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  icon: { fontSize: 32, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
});

export default DashboardScreen;
