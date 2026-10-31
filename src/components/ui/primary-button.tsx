import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { Pressable, StyleSheet, Text } from "react-native";

import { brandGradient, colors, radius, spacing } from "@/theme/tokens";

type Props = {
  label: string;
  onPress: () => void;
  /** Lime gradient for the main action on a screen; dark outline for everything else. */
  variant?: "primary" | "secondary";
  /** Shown after the label. */
  icon?: SymbolViewProps["name"];
  /** Shown before the label. */
  leadingIcon?: SymbolViewProps["name"];
  disabled?: boolean;
  accessibilityHint?: string;
};

export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  icon,
  leadingIcon,
  disabled = false,
  accessibilityHint,
}: Props) {
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {leadingIcon && (
        <SymbolView name={leadingIcon} tintColor={primary ? colors.background : colors.text} size={18} />
      )}
      <Text style={[styles.label, primary && styles.labelPrimary]}>{label}</Text>
      {icon && <SymbolView name={icon} tintColor={primary ? colors.background : colors.text} size={18} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    // minHeight rather than height so the label still fits at large font scales.
    minHeight: 56,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primary: {
    backgroundImage: brandGradient,
    boxShadow: `0 0 24px ${colors.glow}`,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
  },
  labelPrimary: {
    color: colors.background,
    fontWeight: "700",
  },
});
