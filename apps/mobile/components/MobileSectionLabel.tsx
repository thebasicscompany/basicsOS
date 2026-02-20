import { Text, StyleSheet } from "react-native";
import { colors } from "../lib/tokens";

interface MobileSectionLabelProps {
  children: string;
}

export const MobileSectionLabel = ({
  children,
}: MobileSectionLabelProps): JSX.Element => (
  <Text style={styles.label}>{children}</Text>
);

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: colors.textPlaceholder,
    marginBottom: 8,
  },
});
