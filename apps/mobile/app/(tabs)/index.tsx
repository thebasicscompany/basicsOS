import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { BookOpen, Users, CheckSquare, Video, Sparkles, Link2 } from "lucide-react-native";
import { Screen } from "../../components/Screen";
import { trpc } from "../../lib/trpc";
import { colors, radius, shadows } from "../../lib/tokens";
import type { ComponentType } from "react";

type IconProps = { size?: number; color?: string };

const MODULES: {
  name: string;
  Icon: ComponentType<IconProps>;
  route: string;
  bg: string;
  fg: string;
}[] = [
  {
    name: "Knowledge",
    Icon: BookOpen,
    route: "/knowledge",
    bg: colors.emeraldSubtle,
    fg: colors.emerald,
  },
  { name: "CRM", Icon: Users, route: "/crm", bg: colors.blueSubtle, fg: colors.blue },
  { name: "Tasks", Icon: CheckSquare, route: "/tasks", bg: colors.violetSubtle, fg: colors.violet },
  { name: "Meetings", Icon: Video, route: "/meetings", bg: colors.amberSubtle, fg: colors.amber },
  {
    name: "Assistant",
    Icon: Sparkles,
    route: "/assistant",
    bg: colors.brandSubtle,
    fg: colors.brand,
  },
  { name: "Hub", Icon: Link2, route: "/hub", bg: colors.roseSubtle, fg: colors.rose },
];

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const DashboardScreen = (): JSX.Element => {
  const { data: tasks } = trpc.tasks.list.useQuery({});
  const { data: meetings } = trpc.meetings.list.useQuery({ limit: 5 });

  const taskCount = (tasks ?? []).length;
  const meetingCount = (meetings ?? []).length;

  return (
    <Screen title="Basics OS">
      <Text style={styles.greeting}>{getGreeting()}</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.violetSubtle }]}>
            <CheckSquare size={18} color={colors.violet} />
          </View>
          <Text style={styles.statValue}>{taskCount}</Text>
          <Text style={styles.statLabel}>Tasks</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.amberSubtle }]}>
            <Video size={18} color={colors.amber} />
          </View>
          <Text style={styles.statValue}>{meetingCount}</Text>
          <Text style={styles.statLabel}>Meetings</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Modules</Text>
      <View style={styles.grid}>
        {MODULES.map((m) => (
          <TouchableOpacity
            key={m.name}
            style={styles.card}
            onPress={() => router.push(m.route as never)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: m.bg }]}>
              <m.Icon size={22} color={m.fg} />
            </View>
            <Text style={styles.cardTitle}>{m.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  greeting: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.textSecondary,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    ...shadows.sm,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: { fontSize: 28, fontWeight: "700", color: colors.brand },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47%",
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
});

export default DashboardScreen;
