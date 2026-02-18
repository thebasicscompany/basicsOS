import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Screen } from "../../../components/Screen";

type Contact = { id: string; name: string; email: string | null; company?: string | null };

const DEMO_CONTACTS: Contact[] = [
  { id: "1", name: "Mehmet Yilmaz", email: "mehmet@globaltech.io", company: "GlobalTech" },
  { id: "2", name: "Priya Sharma", email: "priya@startupxyz.com", company: "StartupXYZ" },
  { id: "3", name: "James Walker", email: "james@example.com", company: "Example Inc" },
  { id: "4", name: "Sofia Andersen", email: "sofia@nordic.dk", company: "Nordic Solutions" },
  { id: "5", name: "Carlos Rivera", email: "carlos@latam.co", company: "LATAM Corp" },
];

type ContactItemProps = { item: Contact };

const ContactItem = ({ item }: ContactItemProps): JSX.Element => (
  <View style={styles.contact}>
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{item.name[0] ?? "?"}</Text>
    </View>
    <View style={styles.info}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.email}>{item.email ?? "—"}</Text>
      {item.company != null && (
        <Text style={styles.company}>{item.company}</Text>
      )}
    </View>
  </View>
);

const CRMScreen = (): JSX.Element => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl =
      process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001";
    fetch(`${apiUrl}/trpc/crm.contacts.list?input={}`)
      .then((r) => r.json())
      .then((d: { result?: { data?: Contact[] } }) =>
        setContacts(d.result?.data ?? DEMO_CONTACTS),
      )
      .catch(() => setContacts(DEMO_CONTACTS))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Screen title="CRM">
        <ActivityIndicator size="large" color="#6366f1" style={styles.loader} />
      </Screen>
    );
  }

  return (
    <Screen title="CRM">
      <Text style={styles.count}>{contacts.length} contacts</Text>
      <FlatList
        data={contacts}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <ContactItem item={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        scrollEnabled={false}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  loader: { marginTop: 40 },
  count: { fontSize: 13, color: "#6b7280", marginBottom: 12 },
  contact: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: "#111827" },
  email: { fontSize: 13, color: "#6b7280", marginTop: 1 },
  company: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
  separator: { height: 8 },
});

export default CRMScreen;
