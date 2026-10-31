import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/ui/primary-button";
import { colors, radius, spacing, typography } from "@/theme/tokens";

type Props = {
  icon: SymbolViewProps["name"];
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ icon, title, body, action }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconTile}>
        <SymbolView name={icon} tintColor={colors.brand} size={28} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
      {action && (
        <View style={styles.action}>
          <PrimaryButton label={action.label} onPress={action.onPress} variant="secondary" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: "center",
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  action: {
    marginTop: spacing.xl,
    alignSelf: "stretch",
  },
});
