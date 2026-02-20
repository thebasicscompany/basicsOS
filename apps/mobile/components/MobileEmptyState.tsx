import { View, Text, StyleSheet } from "react-native";
import type { ComponentType } from "react";
import type { SvgProps } from "react-native-svg";
import { colors, radius } from "../lib/tokens";

type LucideIcon = ComponentType<SvgProps & { size?: number; color?: string }>;

interface MobileEmptyStateProps {
  Icon: LucideIcon;
  heading: string;
  description?: string;
}

export const MobileEmptyState = ({
  Icon,
  heading,
  description,
}: MobileEmptyStateProps): JSX.Element => (
  <View style={styles.container}>
    <View style={styles.iconContainer}>
      <Icon size={28} color={colors.textPlaceholder} />
    </View>
    <Text style={styles.heading}>{heading}</Text>
    {description ? <Text style={styles.description}>{description}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingTop: 60,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  heading: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
