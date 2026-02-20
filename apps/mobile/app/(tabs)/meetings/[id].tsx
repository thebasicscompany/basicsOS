import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-av";
import { ChevronRight } from "lucide-react-native";
import { Screen } from "../../../components/Screen";
import { trpc } from "../../../lib/trpc";
import { colors, radius, shadows } from "../../../lib/tokens";

const MeetingDetailScreen = (): JSX.Element => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: meeting, isLoading } = trpc.meetings.get.useQuery({ id: id ?? "" });
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoRecording, setVideoRecording] = useState(false);

  const handleRecordVideo = async (): Promise<void> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera access is needed to record video notes.");
      return;
    }

    setVideoRecording(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: 120,
        quality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        setVideoUri(result.assets[0].uri);
      }
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to record video");
    } finally {
      setVideoRecording(false);
    }
  };

  const handlePickVideo = async (): Promise<void> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Photo library access is needed to attach video notes.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
    }
  };

  if (isLoading) {
    return (
      <Screen title="Meeting">
        <ActivityIndicator size="large" color={colors.brand} style={styles.loader} />
      </Screen>
    );
  }

  if (!meeting) {
    return (
      <Screen title="Meeting">
        <Text style={styles.notFound}>Meeting not found.</Text>
      </Screen>
    );
  }

  const summaryJson =
    (meeting.summaries[0]?.summaryJson as {
      decisions?: string[];
      actionItems?: string[];
      followUps?: string[];
      note?: string;
    } | null) ?? null;

  return (
    <Screen title={meeting.title}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <ChevronRight
          size={14}
          color={colors.brand}
          style={{ transform: [{ rotate: "180deg" }] }}
        />
        <Text style={styles.backText}>Meetings</Text>
      </TouchableOpacity>

      {meeting.startedAt && (
        <Text style={styles.date}>
          {new Date(meeting.startedAt).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </Text>
      )}

      {meeting.participants.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participants</Text>
          <Text style={styles.participants}>
            {meeting.participants.map((p) => p.externalEmail ?? p.userId).join(", ")}
          </Text>
        </View>
      )}

      {/* Video Note */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Video Note</Text>
        {videoUri ? (
          <View style={styles.videoWrapper}>
            <Video
              source={{ uri: videoUri }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
            />
            <TouchableOpacity style={styles.removeVideoBtn} onPress={() => setVideoUri(null)}>
              <Text style={styles.removeVideoText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.videoActions}>
            <TouchableOpacity
              style={[styles.videoBtn, styles.videoBtnPrimary]}
              onPress={() => void handleRecordVideo()}
              disabled={videoRecording}
            >
              <Text style={styles.videoBtnPrimaryText}>
                {videoRecording ? "Opening Camera..." : "Record"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.videoBtn, styles.videoBtnSecondary]}
              onPress={() => void handlePickVideo()}
            >
              <Text style={styles.videoBtnSecondaryText}>Choose</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Summary */}
      {summaryJson && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          {summaryJson.note && <Text style={styles.noteText}>{summaryJson.note}</Text>}
          {(summaryJson.decisions?.length ?? 0) > 0 && (
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Decisions</Text>
              {summaryJson.decisions?.map((d, i) => (
                <Text key={i} style={styles.summaryItem}>
                  {"\u2022"} {d}
                </Text>
              ))}
            </View>
          )}
          {(summaryJson.actionItems?.length ?? 0) > 0 && (
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Action Items</Text>
              {summaryJson.actionItems?.map((a, i) => (
                <Text key={i} style={styles.summaryItem}>
                  {"\u2022"} {a}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Transcript */}
      {meeting.transcripts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transcript ({meeting.transcripts.length} lines)</Text>
          <FlatList
            data={meeting.transcripts}
            keyExtractor={(t) => t.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.transcriptSep} />}
            renderItem={({ item }) => (
              <View style={styles.transcriptRow}>
                <Text style={styles.speaker}>{item.speaker}</Text>
                <Text style={styles.transcriptText}>{item.text}</Text>
              </View>
            )}
          />
        </View>
      )}

      {meeting.transcripts.length === 0 && !summaryJson && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No transcript yet. Record or paste a transcript from the web app.
          </Text>
        </View>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  loader: { marginTop: 40 },
  notFound: { fontSize: 14, color: colors.textSecondary, marginTop: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 12 },
  backText: { fontSize: 14, color: colors.brand, fontWeight: "600" },
  date: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  section: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textPlaceholder,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  participants: { fontSize: 13, color: colors.textSecondary },
  noteText: { fontSize: 13, color: colors.textSecondary, fontStyle: "italic" },
  summaryBlock: { marginTop: 8 },
  summaryLabel: { fontSize: 12, fontWeight: "600", color: colors.textPrimary, marginBottom: 4 },
  summaryItem: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  transcriptRow: { gap: 2 },
  speaker: { fontSize: 11, fontWeight: "700", color: colors.brand, textTransform: "uppercase" },
  transcriptText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  transcriptSep: { height: 8 },
  emptyState: { alignItems: "center", paddingTop: 32 },
  emptyText: { fontSize: 13, color: colors.textPlaceholder, textAlign: "center" },
  videoActions: { flexDirection: "row", gap: 8 },
  videoBtn: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: "center",
  },
  videoBtnPrimary: { backgroundColor: colors.brand },
  videoBtnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  videoBtnSecondary: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  videoBtnSecondaryText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  videoWrapper: { gap: 8 },
  video: { width: "100%", height: 200, borderRadius: radius.sm, backgroundColor: "#000" },
  removeVideoBtn: { alignItems: "center" },
  removeVideoText: { fontSize: 13, color: colors.destructive, fontWeight: "600" },
});

export default MeetingDetailScreen;
