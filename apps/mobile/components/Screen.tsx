import { View, Text, StyleSheet, ScrollView } from "react-native";
import { colors, radius } from "../lib/tokens";

type ScreenProps = {
  title: string;
  children: React.ReactNode;
  /** Set false to disable ScrollView (e.g. for screens with their own FlatList/KeyboardAvoidingView) */
  scrollable?: boolean;
};

export const Screen = ({ title, children, scrollable = true }: ScreenProps): JSX.Element => (
  <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
    </View>
    {scrollable ? (
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {children}
      </ScrollView>
    ) : (
      <View style={styles.flexContent}>{children}</View>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceApp },
  header: {
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 24, fontWeight: "700", color: colors.textPrimary },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 32 },
  flexContent: { flex: 1, padding: 16 },
});
