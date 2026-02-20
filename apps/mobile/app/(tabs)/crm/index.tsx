import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Users } from "lucide-react-native";
import { Screen } from "../../../components/Screen";
import { trpc } from "../../../lib/trpc";
import { colors, radius, shadows, nameToColor } from "../../../lib/tokens";

const CRMScreen = (): JSX.Element => {
  const { data: contacts, isLoading } = trpc.crm.contacts.list.useQuery({});

  if (isLoading) {
    return (
      <Screen title="CRM">
        <ActivityIndicator size="large" color={colors.brand} style={styles.loader} />
      </Screen>
    );
  }

  const contactList = contacts ?? [];

  if (contactList.length === 0) {
    return (
      <Screen title="CRM">
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Users size={28} color={colors.textPlaceholder} />
          </View>
          <Text style={styles.emptyTitle}>No contacts yet</Text>
          <Text style={styles.emptySubtitle}>Add your first contact from the web app.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="CRM">
      <Text style={styles.count}>{contactList.length} contacts</Text>
      <FlatList
        data={contactList}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => {
          const avatarColor = nameToColor(item.name);
          return (
            <View style={styles.contact}>
              <View style={[styles.avatar, { backgroundColor: avatarColor.bg }]}>
                <Text style={[styles.avatarText, { color: avatarColor.text }]}>
                  {item.name[0] ?? "?"}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.email}>{item.email ?? "\u2014"}</Text>
                {item.phone != null && (
                  <Text style={styles.phone}>{item.phone}</Text>
                )}
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        scrollEnabled={false}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  loader: { marginTop: 40 },
  count: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  contact: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceCard,
    padding: 14,
    borderRadius: radius.md,
    gap: 12,
    ...shadows.card,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "700" },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  email: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  phone: { fontSize: 12, color: colors.textPlaceholder, marginTop: 1 },
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

export default CRMScreen;
