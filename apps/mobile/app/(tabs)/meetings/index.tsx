import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { Video, ChevronRight } from "lucide-react-native";
import { Screen } from "../../../components/Screen";
import { trpc } from "../../../lib/trpc";
import { colors, radius, shadows } from "../../../lib/tokens";

const MeetingsScreen = (): JSX.Element => {
  const router = useRouter();
  const { data: meetings, isLoading } = trpc.meetings.list.useQuery({ limit: 20 });

  if (isLoading) {
    return (
      <Screen title="Meetings">
        <ActivityIndicator size="large" color={colors.brand} style={styles.loader} />
      </Screen>
    );
  }

  const meetingList = meetings ?? [];

  if (meetingList.length === 0) {
    return (
      <Screen title="Meetings">
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Video size={28} color={colors.textPlaceholder} />
          </View>
          <Text style={styles.emptyTitle}>No meetings yet</Text>
          <Text style={styles.emptySubtitle}>Create your first meeting from the web app.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Meetings">
      <Text style={styles.count}>{meetingList.length} meetings</Text>
      <FlatList
        data={meetingList}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.meeting, pressed && styles.meetingPressed]}
            onPress={() => router.push(`/meetings/${item.id}` as never)}
          >
            <View style={styles.dateBlock}>
              <Text style={styles.dateDay}>
                {item.startedAt !== null && item.startedAt !== undefined
                  ? new Date(item.startedAt).getDate()
                  : "\u2014"}
              </Text>
              <Text style={styles.dateMonth}>
                {item.startedAt !== null && item.startedAt !== undefined
                  ? new Date(item.startedAt).toLocaleDateString("en-US", { month: "short" })
                  : ""}
              </Text>
            </View>
            <View style={styles.meetingInfo}>
              <Text style={styles.meetingTitle}>{item.title}</Text>
              {item.startedAt !== null && item.startedAt !== undefined && (
                <Text style={styles.meetingTime}>
                  {new Date(item.startedAt).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              )}
            </View>
            <ChevronRight size={18} color={colors.textPlaceholder} />
          </Pressable>
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
  meeting: {
    flexDirection: "row",
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 14,
    gap: 14,
    alignItems: "center",
    ...shadows.card,
  },
  meetingPressed: { opacity: 0.7 },
  dateBlock: {
    width: 48,
    alignItems: "center",
    backgroundColor: colors.brandSubtle,
    borderRadius: radius.sm,
    paddingVertical: 8,
  },
  dateDay: { fontSize: 20, fontWeight: "700", color: colors.brand },
  dateMonth: { fontSize: 11, color: colors.brand, fontWeight: "600" },
  meetingInfo: { flex: 1 },
  meetingTitle: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  meetingTime: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
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

export default MeetingsScreen;
