import { View, Text, StyleSheet, ScrollView } from "react-native";

type ScreenProps = { title: string; children: React.ReactNode };

export const Screen = ({ title, children }: ScreenProps): JSX.Element => (
  <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
    </View>
    <ScrollView style={styles.content}>{children}</ScrollView>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  content: { flex: 1, padding: 16 },
});
