import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { CheckSquare } from "lucide-react-native";
import { Screen } from "../../../components/Screen";
import { trpc } from "../../../lib/trpc";
import { colors, radius, shadows } from "../../../lib/tokens";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: colors.destructive,
  high: "#f97316",
  medium: colors.warning,
  low: colors.textSecondary,
};

const TasksScreen = (): JSX.Element => {
  const { data: tasks, isLoading } = trpc.tasks.list.useQuery({});

  if (isLoading) {
    return (
      <Screen title="Tasks">
        <ActivityIndicator size="large" color={colors.brand} style={styles.loader} />
      </Screen>
    );
  }

  const taskList = tasks ?? [];

  if (taskList.length === 0) {
    return (
      <Screen title="Tasks">
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <CheckSquare size={28} color={colors.textPlaceholder} />
          </View>
          <Text style={styles.emptyTitle}>No tasks yet</Text>
          <Text style={styles.emptySubtitle}>Create your first task from the web app.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Tasks">
      <Text style={styles.count}>{taskList.length} tasks</Text>
      <FlatList
        data={taskList}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <View style={styles.task}>
            <View style={styles.taskInfo}>
              <Text
                style={[styles.taskTitle, item.status === "done" && styles.done]}
              >
                {item.title}
              </Text>
              <Text style={styles.statusText}>{item.status.replace("-", " ")}</Text>
            </View>
            <View
              style={[
                styles.badge,
                { backgroundColor: PRIORITY_COLORS[item.priority] ?? colors.textSecondary },
              ]}
            >
              <Text style={styles.badgeText}>{item.priority}</Text>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        scrollEnabled={false}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  loader: { marginTop: 40 },
  count: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  task: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceCard,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 15, fontWeight: "500", color: colors.textPrimary },
  done: { textDecorationLine: "line-through", color: colors.textPlaceholder },
  statusText: { fontSize: 12, color: colors.textSecondary, marginTop: 2, textTransform: "capitalize" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  separator: { height: 8 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.textPrimary, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: "center", paddingHorizontal: 32 },
});

export default TasksScreen;
