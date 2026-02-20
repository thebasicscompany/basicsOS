import { View, Text, StyleSheet } from "react-native";
import type { ViewStyle, TextStyle } from "react-native";
import { colors, radius } from "../lib/tokens";

interface MobileBadgeProps {
  label: string;
  /** Background color. Defaults to `colors.textSecondary`. */
  color?: string;
  /** Text color. Defaults to `colors.white`. */
  textColor?: string;
}

export const MobileBadge = ({
  label,
  color = colors.textSecondary,
  textColor = colors.white,
}: MobileBadgeProps): JSX.Element => (
  <View style={[styles.badge, { backgroundColor: color } as ViewStyle]}>
    <Text style={[styles.text, { color: textColor } as TextStyle]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
  },
});
