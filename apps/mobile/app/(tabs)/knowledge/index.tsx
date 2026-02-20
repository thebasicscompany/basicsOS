import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { BookOpen, FileText } from "lucide-react-native";
import { Screen } from "../../../components/Screen";
import { trpc } from "../../../lib/trpc";
import { colors, radius, shadows } from "../../../lib/tokens";

const APP_URL = process.env["EXPO_PUBLIC_APP_URL"] ?? "http://localhost:3000";

const KnowledgeScreen = (): JSX.Element => {
  const { data: docs, isLoading } = trpc.knowledge.list.useQuery({ parentId: null });

  if (isLoading) {
    return (
      <Screen title="Knowledge">
        <ActivityIndicator size="large" color={colors.brand} style={styles.loader} />
      </Screen>
    );
  }

  const docList = docs ?? [];

  if (docList.length === 0) {
    return (
      <Screen title="Knowledge">
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <BookOpen size={28} color={colors.textPlaceholder} />
          </View>
          <Text style={styles.emptyTitle}>No documents yet</Text>
          <Text style={styles.emptySubtitle}>Create your first document from the web app.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Knowledge">
      <FlatList
        data={docList}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.doc}
            activeOpacity={0.7}
            onPress={() => {
              const url = `${APP_URL}/knowledge/${item.id}`;
              void import("react-native").then(({ Linking }) => Linking.openURL(url));
            }}
          >
            <View style={styles.docIcon}>
              <FileText size={18} color={colors.emerald} />
            </View>
            <View style={styles.docInfo}>
              <Text style={styles.docTitle}>{item.title}</Text>
              {item.updatedAt !== null && item.updatedAt !== undefined && (
                <Text style={styles.docDate}>
                  Updated {new Date(item.updatedAt).toLocaleDateString()}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        scrollEnabled={false}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  loader: { marginTop: 40 },
  doc: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: 14,
    ...shadows.card,
    gap: 12,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.emeraldSubtle,
    justifyContent: "center",
    alignItems: "center",
  },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  docDate: { fontSize: 12, color: colors.textPlaceholder, marginTop: 3 },
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
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});

export default KnowledgeScreen;
