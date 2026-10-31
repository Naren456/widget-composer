import Constants from "expo-constants";
import { router } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { useWidgetStore } from "@/features/widgets/widget-store";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { hostFromUrl } from "@/types/widget";

type Row = {
  title: string;
  body: string;
  icon: SymbolViewProps["name"];
  /** Rows without an action have nothing behind them yet and show "Soon". */
  onPress?: () => void;
};

/**
 * Profile without an account system: there is no sign-in or backend yet, so identity
 * and plan are not invented, and the stats count only this session's widgets.
 */
export default function Profile() {
  const { widgets } = useWidgetStore();
  const sources = new Set(widgets.filter((w) => w.url).map((w) => hostFromUrl(w.url))).size;
  const dark = widgets.filter((w) => w.theme === "dark").length;
  const version = Constants.expoConfig?.version ?? "1.0.0";

  const stats: { value: number; label: string; icon: SymbolViewProps["name"] }[] = [
    { value: widgets.length, label: "Widgets", icon: { ios: "square.grid.2x2", android: "widgets", web: "widgets" } },
    { value: sources, label: "Sources", icon: { ios: "link", android: "link", web: "link" } },
    { value: dark, label: "Dark style", icon: { ios: "moon.fill", android: "dark_mode", web: "dark_mode" } },
  ];

  const rows: Row[] = [
    {
      title: "Account settings",
      body: "Name, email, password",
      icon: { ios: "person.fill", android: "person", web: "person" },
    },
    {
      title: "Manage widgets",
      body: "View and organize your widgets",
      icon: { ios: "square.grid.2x2", android: "widgets", web: "widgets" },
      onPress: () => router.back(),
    },
    {
      title: "Connected services",
      body: "Manage linked accounts",
      icon: { ios: "link", android: "link", web: "link" },
    },
    {
      title: "Upgrade plan",
      body: "Get more features",
      icon: { ios: "star", android: "star", web: "star" },
    },
    {
      title: "Help & support",
      body: "FAQs and contact us",
      icon: { ios: "questionmark.circle", android: "help", web: "help" },
    },
  ];

  return (
    <Screen insetTop={spacing.sm} insetBottom={spacing.sm}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.back}
        >
          <SymbolView
            name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
            tintColor={colors.text}
            size={22}
          />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Profile
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <SymbolView
              name={{ ios: "person.fill", android: "person", web: "person" }}
              tintColor={colors.brand}
              size={40}
            />
          </View>
          <View style={styles.identityText}>
            <Text style={styles.name}>Guest</Text>
            <Text style={styles.email}>Not signed in</Text>
            <View style={styles.chip}>
              <Text style={styles.chipText}>Accounts coming soon</Text>
            </View>
          </View>
        </View>

        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat} accessible accessibilityLabel={`${s.value} ${s.label}`}>
              <SymbolView name={s.icon} tintColor={colors.brand} size={22} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.list}>
          {rows.map((row, i) => (
            <Pressable
              key={row.title}
              onPress={row.onPress}
              disabled={!row.onPress}
              accessibilityRole="button"
              accessibilityState={{ disabled: !row.onPress }}
              accessibilityHint={row.onPress ? undefined : "Not available yet"}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.pressed]}
            >
              <View style={styles.rowIcon}>
                <SymbolView name={row.icon} tintColor={colors.brand} size={22} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.rowBody}>{row.body}</Text>
              </View>
              {row.onPress ? (
                <SymbolView
                  name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
                  tintColor={colors.textMuted}
                  size={18}
                />
              ) : (
                <Text style={styles.soon}>Soon</Text>
              )}
            </Pressable>
          ))}
          <View style={[styles.row, styles.rowDivider]}>
            <View style={styles.rowIcon}>
              <SymbolView
                name={{ ios: "info.circle", android: "info", web: "info" }}
                tintColor={colors.brand}
                size={22}
              />
            </View>
            <Text style={[styles.rowTitle, styles.rowText]}>About</Text>
            <Text style={styles.version}>v{version}</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  back: {
    position: "absolute",
    left: spacing.xl,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.brandDeep,
    boxShadow: `0 0 18px ${colors.glow}`,
  },
  identityText: {
    flex: 1,
    alignItems: "flex-start",
  },
  name: {
    ...typography.heading,
    color: colors.text,
  },
  email: {
    ...typography.body,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  chip: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brandWash,
  },
  chipText: {
    ...typography.meta,
    color: colors.brand,
  },
  stats: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginTop: 4,
  },
  statLabel: {
    ...typography.meta,
    fontSize: 13,
    color: colors.textMuted,
  },
  list: {
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowIcon: {
    width: 36,
    alignItems: "center",
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
  },
  rowBody: {
    ...typography.meta,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  soon: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  version: {
    ...typography.body,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.85,
  },
});
