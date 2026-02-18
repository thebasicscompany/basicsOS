import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Screen } from "../../../components/Screen";

type Meeting = {
  id: string;
  title: string;
  date: string;
  attendees?: string[];
  location?: string | null;
};

const DEMO_MEETINGS: Meeting[] = [
  {
    id: "1",
    title: "Q2 Planning Session",
    date: "2026-02-18T10:00:00Z",
    attendees: ["Mehmet", "Priya", "James"],
    location: "Conference Room A",
  },
  {
    id: "2",
    title: "Product Review",
    date: "2026-02-19T14:00:00Z",
    attendees: ["Sofia", "Carlos"],
    location: "Zoom",
  },
  {
    id: "3",
    title: "Investor Call",
    date: "2026-02-20T09:00:00Z",
    attendees: ["James", "Priya"],
    location: null,
  },
  {
    id: "4",
    title: "Design Sync",
    date: "2026-02-21T11:30:00Z",
    attendees: ["Mehmet"],
    location: "Design Studio",
  },
];

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type MeetingItemProps = { item: Meeting };

const MeetingItem = ({ item }: MeetingItemProps): JSX.Element => (
  <View style={styles.meeting}>
    <View style={styles.dateBlock}>
      <Text style={styles.dateDay}>
        {new Date(item.date).getDate()}
      </Text>
      <Text style={styles.dateMonth}>
        {new Date(item.date).toLocaleDateString("en-US", { month: "short" })}
      </Text>
    </View>
    <View style={styles.meetingInfo}>
      <Text style={styles.meetingTitle}>{item.title}</Text>
      <Text style={styles.meetingTime}>{formatDate(item.date)}</Text>
      {item.location != null && (
        <Text style={styles.location}>{item.location}</Text>
      )}
      {item.attendees != null && item.attendees.length > 0 && (
        <Text style={styles.attendees}>
          {item.attendees.join(", ")}
        </Text>
      )}
    </View>
  </View>
);

const MeetingsScreen = (): JSX.Element => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl =
      process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001";
    fetch(`${apiUrl}/trpc/meetings.list?input={}`)
      .then((r) => r.json())
      .then((d: { result?: { data?: Meeting[] } }) =>
        setMeetings(d.result?.data ?? DEMO_MEETINGS),
      )
      .catch(() => setMeetings(DEMO_MEETINGS))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Screen title="Meetings">
        <ActivityIndicator size="large" color="#6366f1" style={styles.loader} />
      </Screen>
    );
  }

  return (
    <Screen title="Meetings">
      <Text style={styles.count}>{meetings.length} upcoming meetings</Text>
      <FlatList
        data={meetings}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MeetingItem item={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        scrollEnabled={false}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  loader: { marginTop: 40 },
  count: { fontSize: 13, color: "#6b7280", marginBottom: 12 },
  meeting: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    gap: 14,
    alignItems: "flex-start",
  },
  dateBlock: {
    width: 48,
    alignItems: "center",
    backgroundColor: "#ede9fe",
    borderRadius: 8,
    paddingVertical: 8,
  },
  dateDay: { fontSize: 20, fontWeight: "700", color: "#6366f1" },
  dateMonth: { fontSize: 11, color: "#6366f1", fontWeight: "600" },
  meetingInfo: { flex: 1 },
  meetingTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  meetingTime: { fontSize: 12, color: "#6b7280", marginTop: 3 },
  location: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  attendees: { fontSize: 12, color: "#6b7280", marginTop: 4, fontStyle: "italic" },
  separator: { height: 8 },
});

export default MeetingsScreen;
