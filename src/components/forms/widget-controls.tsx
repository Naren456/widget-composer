import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colorOptions, sizeOptions, styleOptions } from "@/theme/widget-themes";
import { colors, radius, spacing, typography } from "@/theme/tokens";

/**
 * The three pickers from the verified Customize reference
 * (assets/design-references/onboarding/components/ui-references/).
 * Shared by onboarding, Create and Customize.
 */

export function ControlLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

type SelectorProps<T extends string> = {
  value: T;
  onChange: (id: T) => void;
};

export function WidgetStyleSelector({ value, onChange }: SelectorProps<string>) {
  return (
    <View style={styles.styleRow} accessibilityRole="radiogroup" accessibilityLabel="Widget style">
      {styleOptions.map((opt) => (
        <Pressable
          key={opt.id}
          onPress={() => onChange(opt.id)}
          accessibilityRole="radio"
          accessibilityLabel={opt.label}
          accessibilityState={{ selected: opt.id === value }}
          style={[styles.styleTile, opt.id === value && styles.selected]}
        >
          <Image source={opt.image} style={StyleSheet.absoluteFill} contentFit="cover" />
          <Text style={styles.styleLabel}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function WidgetColorSelector({
  value,
  onChange,
  disabled = false,
}: SelectorProps<string> & { disabled?: boolean }) {
  return (
    <View
      style={[styles.colorRow, disabled && styles.disabled]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Colour theme"
    >
      {colorOptions.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => onChange(c.id)}
          disabled={disabled}
          accessibilityRole="radio"
          accessibilityLabel={c.label}
          accessibilityState={{ selected: c.id === value, disabled }}
          style={[styles.colorRing, c.id === value && styles.colorRingSelected]}
        >
          <View style={[styles.colorDot, { backgroundColor: c.dot }]} />
        </Pressable>
      ))}
    </View>
  );
}

export function WidgetSizeSelector({ value, onChange }: SelectorProps<string>) {
  return (
    <View style={styles.sizeRow} accessibilityRole="radiogroup" accessibilityLabel="Widget size">
      {sizeOptions.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => onChange(s.id)}
          accessibilityRole="radio"
          accessibilityLabel={s.label}
          accessibilityState={{ selected: s.id === value }}
          style={[styles.sizePill, s.id === value && styles.selected]}
        >
          <Text style={styles.sizeText}>{s.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm + 2,
  },
  styleRow: {
    flexDirection: "row",
    gap: spacing.sm + 2,
  },
  styleTile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: "hidden",
    justifyContent: "flex-end",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  styleLabel: {
    color: colors.text,
    fontSize: 10,
    paddingBottom: 5,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowRadius: 4,
  },
  selected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandWash,
  },
  colorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  colorRing: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  colorRingSelected: {
    borderColor: colors.text,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
  },
  disabled: {
    opacity: 0.35,
  },
  sizeRow: {
    flexDirection: "row",
    gap: spacing.sm + 2,
  },
  sizePill: {
    flex: 1,
    minHeight: 38,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  sizeText: {
    color: colors.text,
    fontSize: 13,
  },
});
