import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Link2 } from "lucide-react-native";
import { Screen } from "../../../components/Screen";
import { trpc } from "../../../lib/trpc";
import { colors, radius, shadows } from "../../../lib/tokens";

const CATEGORY_COLORS: Record<string, string> = {
  Docs: colors.brand,
  Planning: colors.orange,
  Design: colors.pink,
  Analytics: colors.emerald,
  Engineering: colors.blue,
};

const HubScreen = (): JSX.Element => {
  const { data: links, isLoading } = trpc.hub.listLinks.useQuery();

  if (isLoading) {
    return (
      <Screen title="Hub">
        <ActivityIndicator size="large" color={colors.brand} style={styles.loader} />
      </Screen>
    );
  }

  const linkList = links ?? [];

  if (linkList.length === 0) {
    return (
      <Screen title="Hub">
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Link2 size={28} color={colors.textPlaceholder} />
          </View>
          <Text style={styles.emptyTitle}>No links yet</Text>
          <Text style={styles.emptySubtitle}>Add company links and tools from the web app.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Hub">
      <Text style={styles.subtitle}>Company knowledge and tools</Text>
      <FlatList
        data={linkList}
        keyExtractor={(l) => l.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => void Linking.openURL(item.url)}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.categoryBadge,
                  {
                    backgroundColor:
                      CATEGORY_COLORS[item.category] ?? colors.textSecondary,
                  },
                ]}
              >
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardUrl} numberOfLines={1}>
              {item.url}
            </Text>
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
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  row: { gap: 10, justifyContent: "space-between" },
  separator: { height: 10 },
  card: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: 14,
    ...shadows.card,
  },
  cardHeader: { marginBottom: 8 },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  categoryText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginBottom: 4 },
  cardUrl: { fontSize: 11, color: colors.textPlaceholder },
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

export default HubScreen;
