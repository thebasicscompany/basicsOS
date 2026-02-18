import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Screen } from "../../../components/Screen";

type Task = { id: string; title: string; status: string; priority: string };

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#6b7280",
};

const DEMO_TASKS: Task[] = [
  { id: "1", title: "Follow up with GlobalTech", status: "todo", priority: "urgent" },
  { id: "2", title: "Write Q2 product specs", status: "in-progress", priority: "high" },
  { id: "3", title: "Set up CI/CD pipeline", status: "done", priority: "high" },
  { id: "4", title: "Review design mockups", status: "todo", priority: "medium" },
  { id: "5", title: "Update API documentation", status: "in-progress", priority: "medium" },
  { id: "6", title: "Fix login bug on mobile", status: "done", priority: "urgent" },
  { id: "7", title: "Onboard new team member", status: "todo", priority: "low" },
];

type TaskItemProps = { item: Task };

const TaskItem = ({ item }: TaskItemProps): JSX.Element => (
  <View style={styles.task}>
    <View style={styles.taskInfo}>
      <Text style={[styles.taskTitle, item.status === "done" && styles.done]}>
        {item.title}
      </Text>
      <Text style={styles.statusText}>{item.status.replace("-", " ")}</Text>
    </View>
    <View
      style={[
        styles.badge,
        { backgroundColor: PRIORITY_COLORS[item.priority] ?? "#6b7280" },
      ]}
    >
      <Text style={styles.badgeText}>{item.priority}</Text>
    </View>
  </View>
);

const TasksScreen = (): JSX.Element => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl =
      process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001";
    fetch(`${apiUrl}/trpc/tasks.list?input={}`)
      .then((r) => r.json())
      .then((d: { result?: { data?: Task[] } }) =>
        setTasks(d.result?.data ?? DEMO_TASKS),
      )
      .catch(() => setTasks(DEMO_TASKS))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Screen title="Tasks">
        <ActivityIndicator size="large" color="#6366f1" style={styles.loader} />
      </Screen>
    );
  }

  return (
    <Screen title="Tasks">
      <Text style={styles.count}>{tasks.length} tasks</Text>
      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TaskItem item={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        scrollEnabled={false}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  loader: { marginTop: 40 },
  count: { fontSize: 13, color: "#6b7280", marginBottom: 12 },
  task: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
  },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 15, fontWeight: "500", color: "#111827" },
  done: { textDecorationLine: "line-through", color: "#9ca3af" },
  statusText: { fontSize: 12, color: "#6b7280", marginTop: 2, textTransform: "capitalize" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  separator: { height: 8 },
});

export default TasksScreen;
