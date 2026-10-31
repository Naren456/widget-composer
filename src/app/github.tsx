import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/ui/primary-button";
import { Screen } from "@/components/ui/screen";
import {
  PullRequestWidget,
  RecentPullRequestsWidget,
  StreakWidget,
} from "@/components/widget-preview/github-previews";
import { useGitHubStats } from "@/features/github/use-github-stats";
import { pushWidgetDocument } from "@/features/widgets/sync-home-screen";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { relativeTime } from "@/utils/time";
import { WidgetDocumentView } from "@/widget-engine/player";
import { githubDocument } from "@/widget-engine/templates";

/** Hard-coded for now; becomes the connected account once integrations exist. */
const LOGIN = "Naren456";

export default function GitHub() {
  const { data, error, loading, refreshing, refresh } = useGitHubStats(LOGIN);
  const [width, setWidth] = useState(0);
  const cardWidth = width > 0 ? Math.min(width, 340) : 0;
  const widgetDoc = useMemo(() => (data ? githubDocument(data) : null), [data]);
  const [pinStatus, setPinStatus] = useState<string | null>(null);

  const pin = () => {
    if (!widgetDoc) return;
    setPinStatus(
      pushWidgetDocument(widgetDoc)
        ? "Sent to the WidgetComposer home-screen widget."
        : "Home-screen widgets are only available on Android.",
    );
  };

  return (
    <Screen insetTop={spacing.sm} insetBottom={spacing.lg}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <SymbolView
            name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
            tintColor={colors.text}
            size={22}
          />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          GitHub
        </Text>
        <Pressable
          onPress={refresh}
          disabled={refreshing || loading}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Refresh GitHub data"
          accessibilityState={{ disabled: refreshing || loading }}
        >
          {refreshing ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <SymbolView
              name={{ ios: "arrow.clockwise", android: "refresh", web: "refresh" }}
              tintColor={refreshing || loading ? colors.textSubtle : colors.text}
              size={20}
            />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width - spacing.xl * 2)}
      >
        {loading && !data && (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.centeredText}>Loading {LOGIN}&apos;s public GitHub data…</Text>
          </View>
        )}

        {error && !data && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Couldn&apos;t load GitHub</Text>
            <Text style={styles.errorBody}>{error.message}</Text>
            <View style={styles.errorAction}>
              <PrimaryButton label="Try again" onPress={refresh} variant="secondary" />
            </View>
          </View>
        )}

        {data && (
          <>
            {error && (
              <View style={styles.staleBanner}>
                <Text style={styles.staleText}>
                  {error.message} Showing data from {relativeTime(data.fetchedAt)}.
                </Text>
              </View>
            )}

            <Text style={styles.name}>{data.name ?? data.login}</Text>
            <Text style={styles.meta}>
              {data.publicRepos} public repos · {data.followers} followers · updated{" "}
              {relativeTime(data.fetchedAt)}
            </Text>

            {cardWidth > 0 && (
              <View style={styles.widgets}>
                <StreakWidget width={cardWidth} activity={data.activity} />
                <PullRequestWidget width={cardWidth} stats={data} />
                <RecentPullRequestsWidget width={cardWidth} stats={data} />
              </View>
            )}

            {widgetDoc && cardWidth > 0 && (
              <View style={styles.homeWidget}>
                <Text style={styles.homeWidgetTitle}>Home-screen widget</Text>
                <WidgetDocumentView key={data.fetchedAt} doc={widgetDoc} width={cardWidth} />
                <PrimaryButton
                  label="Show on home screen"
                  onPress={pin}
                  variant="secondary"
                  icon={{ ios: "square.grid.2x2", android: "widgets", web: "widgets" }}
                />
                {pinStatus && <Text style={styles.meta}>{pinStatus}</Text>}
              </View>
            )}

            <Text style={styles.footnote}>
              Pull request counts come from GitHub&apos;s search API. The streak is derived from your public
              events feed, which covers about {data.activity.windowDays} days and excludes private
              contributions — so it is not the contribution streak shown on your profile. That one needs an
              authenticated request, which belongs behind the WidgetComposer backend rather than in the app.
            </Text>
          </>
        )}
      </ScrollView>
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
  centered: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  centeredText: {
    ...typography.body,
    color: colors.textMuted,
  },
  errorBox: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorTitle: {
    ...typography.label,
    color: colors.text,
  },
  errorBody: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  errorAction: {
    marginTop: spacing.lg,
  },
  staleBanner: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(244, 198, 106, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(244, 198, 106, 0.35)",
  },
  staleText: {
    ...typography.meta,
    color: "#F4C66A",
  },
  name: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.md,
  },
  meta: {
    ...typography.meta,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  widgets: {
    marginTop: spacing.xl,
    gap: spacing.lg,
    alignItems: "center",
  },
  homeWidget: {
    marginTop: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
  },
  homeWidgetTitle: {
    ...typography.label,
    color: colors.text,
    alignSelf: "flex-start",
  },
  footnote: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: spacing.xl,
    lineHeight: 17,
  },
});
