import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ThemeToggle } from "@/components/forms/theme-toggle";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Screen } from "@/components/ui/screen";
import { WidgetCard } from "@/components/widget-cards/widget-card";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { useWidgetStore } from "@/features/widgets/widget-store";
import { refreshWidget } from "@/services/data";
import { hostFromUrl, nameFromUrl, type SavedWidget, type WidgetTheme } from "@/types/widget";
import { relativeTime } from "@/utils/time";

/** The launcher steps from the verified Add-to-home-screen reference. */
const placementSteps = [
  "Long press on home screen",
  "Tap on Widgets",
  "Find WidgetComposer",
  "Add your widget",
];

export default function Preview() {
  // Return to the existing chat rather than replacing it, which would wipe the thread.
  const close = () => (router.canGoBack() ? router.back() : router.replace("/home"));
  const params = useLocalSearchParams<{
    id?: string;
    url?: string;
    description?: string;
    theme?: string;
  }>();
  const { widgets, save, remove, staged } = useWidgetStore();
  const saved = useMemo(() => widgets.find((w) => w.id === params.id), [widgets, params.id]);
  // An unsaved draft staged by the chat (e.g. an agent widget with its own document).
  const draftSource = saved ?? (staged && staged.id === params.id ? staged : undefined);
  const existing = saved;

  const url = draftSource?.url ?? params.url ?? "";
  const description = draftSource?.description ?? params.description ?? "";
  const [theme, setTheme] = useState<WidgetTheme>(
    draftSource?.theme ?? (params.theme === "dark" ? "dark" : "light"),
  );
  // Lazy so a new draft keeps one id and timestamp across re-renders.
  const [draftId] = useState(() => draftSource?.id ?? `w_${Date.now().toString(36)}`);
  const [draftCreatedAt] = useState(() => draftSource?.createdAt ?? Date.now());
  const [previewWidth, setPreviewWidth] = useState(0);
  const [showPlacement, setShowPlacement] = useState(false);
  // Values fetched on this screen; they replace the document's until the widget is saved.
  const [refreshed, setRefreshed] = useState<Pick<SavedWidget, "document" | "refreshedAt"> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);

  const draft: SavedWidget = {
    id: draftId,
    name: draftSource?.name ?? nameFromUrl(url),
    url,
    description,
    theme,
    createdAt: draftCreatedAt,
    document: refreshed?.document ?? draftSource?.document,
    summary: draftSource?.summary,
    dataSource: draftSource?.dataSource,
    refreshedAt: refreshed?.refreshedAt ?? draftSource?.refreshedAt,
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshNote(null);
    const result = await refreshWidget(draft);
    setRefreshing(false);
    if (!result.ok) {
      setRefreshNote(result.message);
      return;
    }
    setRefreshed({ document: result.widget.document, refreshedAt: result.widget.refreshedAt });
    // A saved widget updates in place, which also pushes it to the home screen.
    if (existing) save(result.widget);
    setRefreshNote(result.missing.length > 0 ? `Not in the response, kept as before: ${result.missing.join(", ")}` : null);
  };

  const onSave = () => {
    save(draft);
    close();
  };

  const onRemove = () => {
    if (existing) remove(existing.id);
    close();
  };

  return (
    <Screen insetTop={spacing.sm} insetBottom={spacing.lg}>
      <View style={styles.header}>
        <Pressable
          onPress={() => close()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to your widgets"
        >
          <SymbolView
            name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
            tintColor={colors.text}
            size={22}
          />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          {existing ? draft.name : "Widget ready"}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setPreviewWidth(e.nativeEvent.layout.width - spacing.xl * 2)}
      >
        <View style={styles.preview}>
          {previewWidth > 0 && (
            <WidgetCard widget={draft} width={Math.min(previewWidth * 0.62, 240)} onPress={() => {}} />
          )}
        </View>

        <View style={styles.summary}>
          <Text style={styles.name} accessibilityRole="header">
            {draft.name}
          </Text>
          <Text style={styles.host}>{url ? hostFromUrl(url) : draft.summary}</Text>
          <Text style={styles.meta}>
            {existing ? `Created ${relativeTime(existing.createdAt)}` : "Not saved yet"}
          </Text>
        </View>

        {draft.dataSource && (
          <>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Live data
            </Text>
            <View style={styles.dataRow}>
              <View style={styles.dataText}>
                <Text style={styles.dataSource} numberOfLines={1}>
                  {draft.dataSource.connector === "rest"
                    ? hostFromUrl(draft.dataSource.url)
                    : `Composio · ${draft.dataSource.tool}`}
                </Text>
                <Text style={styles.meta}>
                  {draft.refreshedAt ? `Updated ${relativeTime(draft.refreshedAt)}` : "Not fetched yet"}
                </Text>
              </View>
              <Pressable
                onPress={onRefresh}
                disabled={refreshing}
                accessibilityRole="button"
                accessibilityLabel="Refresh data"
                accessibilityState={{ disabled: refreshing, busy: refreshing }}
                style={({ pressed }) => [styles.refresh, (pressed || refreshing) && styles.pressed]}
              >
                <SymbolView
                  name={{ ios: "arrow.clockwise", android: "refresh", web: "refresh" }}
                  tintColor={colors.brand}
                  size={16}
                />
                <Text style={styles.refreshText}>{refreshing ? "Refreshing…" : "Refresh"}</Text>
              </Pressable>
            </View>
            {refreshNote && <Text style={styles.refreshNote}>{refreshNote}</Text>}
          </>
        )}

        <Text style={styles.sectionTitle} accessibilityRole="header">
          Widget style
        </Text>
        <ThemeToggle value={theme} onChange={setTheme} />

        <Text style={styles.sectionTitle} accessibilityRole="header">
          Add to home screen
        </Text>
        <Pressable
          onPress={() => setShowPlacement((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showPlacement }}
          style={({ pressed }) => [styles.disclosure, pressed && styles.pressed]}
        >
          <Text style={styles.disclosureText}>How to place it</Text>
          <SymbolView
            name={
              showPlacement
                ? { ios: "chevron.up", android: "expand_less", web: "expand_less" }
                : { ios: "chevron.down", android: "expand_more", web: "expand_more" }
            }
            tintColor={colors.textMuted}
            size={18}
          />
        </Pressable>
        {showPlacement && (
          <View style={styles.placement}>
            <Text style={styles.placementNote}>
              The WidgetComposer home-screen widget shows your most recently saved widget. Widgets with live
              data update when you refresh them here; background refresh is not available yet.
            </Text>
            {placementSteps.map((step, i) => (
              <View key={step} style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={existing ? "Save changes" : "Save widget"}
          onPress={onSave}
          icon={{ ios: "checkmark", android: "check", web: "check" }}
        />
        {existing && <PrimaryButton label="Remove widget" variant="secondary" onPress={onRemove} />}
        <Text style={styles.footerNote}>Saved widgets live in memory for this session only.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    flex: 1,
    ...typography.heading,
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  preview: {
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  summary: {
    alignItems: "center",
  },
  name: {
    ...typography.heading,
    color: colors.text,
  },
  host: {
    ...typography.body,
    color: colors.brand,
    marginTop: spacing.xs,
  },
  meta: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: spacing.sm,
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dataText: {
    flex: 1,
  },
  dataSource: {
    ...typography.body,
    color: colors.text,
  },
  refresh: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(166, 239, 92, 0.4)",
    backgroundColor: colors.brandWash,
  },
  refreshText: {
    ...typography.meta,
    fontSize: 13,
    color: colors.brand,
  },
  refreshNote: {
    ...typography.meta,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading,
    fontSize: 17,
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  disclosure: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disclosureText: {
    ...typography.body,
    color: colors.text,
  },
  placement: {
    marginTop: spacing.md,
    padding: spacing.lg,
    gap: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placementNote: {
    ...typography.meta,
    color: colors.textMuted,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  stepNumberText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: "700",
  },
  stepText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  footerNote: {
    ...typography.meta,
    color: colors.textSubtle,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.85,
  },
});
