import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/theme/tokens";
import { type WidgetTheme } from "@/types/widget";

const options: { id: WidgetTheme; label: string; icon: SymbolViewProps["name"] }[] = [
  { id: "light", label: "Light", icon: { ios: "sun.max.fill", android: "light_mode", web: "light_mode" } },
  { id: "dark", label: "Dark", icon: { ios: "moon.fill", android: "dark_mode", web: "dark_mode" } },
];

type Props = {
  value: WidgetTheme;
  onChange: (theme: WidgetTheme) => void;
};

/** Light / Dark segmented choice from the Create Widget reference. */
export function ThemeToggle({ value, onChange }: Props) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed]}
          >
            <SymbolView name={o.icon} tintColor={selected ? colors.brand : colors.text} size={20} />
            <Text style={[styles.label, selected && styles.labelSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  option: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandWash,
    boxShadow: `0 0 16px ${colors.glow}`,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "500",
  },
  labelSelected: {
    color: colors.brand,
  },
  pressed: {
    opacity: 0.85,
  },
});
