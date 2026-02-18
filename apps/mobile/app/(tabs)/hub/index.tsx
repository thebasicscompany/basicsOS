import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Screen } from "../../../components/Screen";

type HubLink = {
  id: string;
  title: string;
  url: string;
  category?: string | null;
  description?: string | null;
};

const DEMO_LINKS: HubLink[] = [
  {
    id: "1",
    title: "Company Handbook",
    url: "https://notion.so/handbook",
    category: "Docs",
    description: "Team policies and procedures",
  },
  {
    id: "2",
    title: "Product Roadmap",
    url: "https://linear.app/roadmap",
    category: "Planning",
    description: "Q2 feature planning",
  },
  {
    id: "3",
    title: "Design System",
    url: "https://figma.com/design",
    category: "Design",
    description: "UI components and guidelines",
  },
  {
    id: "4",
    title: "API Reference",
    url: "https://docs.basicos.io",
    category: "Docs",
    description: "API endpoints documentation",
  },
  {
    id: "5",
    title: "Analytics Dashboard",
    url: "https://analytics.basicos.io",
    category: "Analytics",
    description: "Product metrics and KPIs",
  },
  {
    id: "6",
    title: "GitHub",
    url: "https://github.com/basicos",
    category: "Engineering",
    description: "Source code and PRs",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Docs: "#6366f1",
  Planning: "#f97316",
  Design: "#ec4899",
  Analytics: "#10b981",
  Engineering: "#3b82f6",
};

const openLink = (url: string): void => {
  void Linking.openURL(url);
};

type HubCardProps = { item: HubLink };

const HubCard = ({ item }: HubCardProps): JSX.Element => (
  <TouchableOpacity style={styles.card} onPress={() => openLink(item.url)}>
    <View style={styles.cardHeader}>
      <View
        style={[
          styles.categoryBadge,
          {
            backgroundColor:
              CATEGORY_COLORS[item.category ?? ""] ?? "#6b7280",
          },
        ]}
      >
        <Text style={styles.categoryText}>{item.category ?? "Link"}</Text>
      </View>
    </View>
    <Text style={styles.cardTitle}>{item.title}</Text>
    {item.description != null && (
      <Text style={styles.cardDesc}>{item.description}</Text>
    )}
    <Text style={styles.cardUrl} numberOfLines={1}>
      {item.url}
    </Text>
  </TouchableOpacity>
);

const HubScreen = (): JSX.Element => {
  const [links, setLinks] = useState<HubLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl =
      process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001";
    fetch(`${apiUrl}/trpc/hub.links.list?input={}`)
      .then((r) => r.json())
      .then((d: { result?: { data?: HubLink[] } }) =>
        setLinks(d.result?.data ?? DEMO_LINKS),
      )
      .catch(() => setLinks(DEMO_LINKS))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Screen title="Hub">
        <ActivityIndicator size="large" color="#6366f1" style={styles.loader} />
      </Screen>
    );
  }

  return (
    <Screen title="Hub">
      <Text style={styles.subtitle}>Company knowledge and tools</Text>
      <FlatList
        data={links}
        keyExtractor={(l) => l.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => <HubCard item={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        scrollEnabled={false}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  loader: { marginTop: 40 },
  subtitle: { fontSize: 13, color: "#6b7280", marginBottom: 16 },
  row: { gap: 10, justifyContent: "space-between" },
  separator: { height: 10 },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardHeader: { marginBottom: 8 },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#111827", marginBottom: 4 },
  cardDesc: { fontSize: 12, color: "#6b7280", marginBottom: 6, lineHeight: 16 },
  cardUrl: { fontSize: 11, color: "#9ca3af" },
});

export default HubScreen;
