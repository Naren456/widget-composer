import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { colors } from "@/theme/tokens";
import { type ActivityStreak, type GitHubStats } from "@/types/github";

// Same convention as previews.tsx: designed at BASE width, scaled by the `width` prop.
const BASE = 150;

type Props = {
  width: number;
  style?: ViewStyle;
};

/** Open / merged / closed pull request counts. Every number comes from the API. */
export function PullRequestWidget({ width, style, stats }: Props & { stats: GitHubStats }) {
  const u = width / BASE;
  const counts = [
    { label: "OPEN", value: stats.pullRequests.open, color: colors.brand },
    { label: "MERGED", value: stats.pullRequests.merged, color: "#A78BFA" },
    { label: "CLOSED", value: stats.pullRequests.closed, color: colors.textMuted },
  ];

  return (
    <View
      style={[
        styles.card,
        { width, borderRadius: 18 * u, padding: 14 * u, gap: 10 * u },
        style,
      ]}
    >
      <View style={[styles.row, { gap: 6 * u }]}>
        <SymbolView
          name={{ ios: "arrow.triangle.pull", android: "merge", web: "merge" }}
          tintColor={colors.brand}
          size={13 * u}
        />
        <Text style={[styles.title, { fontSize: 10 * u }]} numberOfLines={1}>
          Pull requests
        </Text>
        <Text style={[styles.handle, { fontSize: 8.5 * u }]} numberOfLines={1}>
          @{stats.login}
        </Text>
      </View>

      <View style={styles.countRow}>
        {counts.map((c) => (
          <View key={c.label} style={styles.count}>
            <Text style={[styles.countValue, { fontSize: 24 * u, color: c.color }]}>{c.value}</Text>
            <Text style={[styles.countLabel, { fontSize: 6.5 * u }]}>{c.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Most recently updated pull requests. */
export function RecentPullRequestsWidget({ width, style, stats }: Props & { stats: GitHubStats }) {
  const u = width / BASE;
  const items = stats.recent.slice(0, 3);
  const dot = { open: colors.brand, merged: "#A78BFA", closed: colors.textSubtle } as const;

  return (
    <View
      style={[styles.card, { width, borderRadius: 18 * u, padding: 14 * u, gap: 8 * u }, style]}
    >
      <Text style={[styles.title, { fontSize: 10 * u }]}>Recent activity</Text>
      {items.length === 0 ? (
        <Text style={[styles.empty, { fontSize: 9 * u }]}>No public pull requests yet.</Text>
      ) : (
        items.map((pr) => (
          <View key={pr.id} style={[styles.row, { gap: 7 * u }]}>
            <View
              style={[styles.stateDot, { width: 6 * u, height: 6 * u, borderRadius: 3 * u, backgroundColor: dot[pr.state] }]}
            />
            <View style={styles.prText}>
              <Text style={[styles.prTitle, { fontSize: 9 * u }]} numberOfLines={1}>
                {pr.title}
              </Text>
              <Text style={[styles.prRepo, { fontSize: 7 * u }]} numberOfLines={1}>
                {pr.repo}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

/**
 * Public activity streak.
 *
 * Labelled "public activity" on purpose — see `ActivityStreak` in types/github.ts.
 * It is not GitHub's contribution streak and will read lower for anyone whose work
 * is mostly in private repositories.
 */
export function StreakWidget({ width, style, activity }: Props & { activity: ActivityStreak }) {
  const u = width / BASE;
  const alive = activity.currentStreak > 0;

  return (
    <View
      style={[styles.card, { width, borderRadius: 18 * u, padding: 14 * u, gap: 9 * u }, style]}
    >
      <View style={[styles.row, { gap: 6 * u }]}>
        <SymbolView
          name={{ ios: "flame.fill", android: "local_fire_department", web: "local_fire_department" }}
          tintColor={alive ? colors.brand : colors.textSubtle}
          size={13 * u}
        />
        <Text style={[styles.title, { fontSize: 10 * u }]}>Public activity</Text>
      </View>

      <View style={[styles.row, { gap: 10 * u }]}>
        <Text style={[styles.streakValue, { fontSize: 30 * u, color: alive ? colors.brand : colors.textMuted }]}>
          {activity.currentStreak}
        </Text>
        <Text style={[styles.streakUnit, { fontSize: 9 * u }]}>
          day{activity.currentStreak === 1 ? "" : "s"}{"\n"}streak
        </Text>
      </View>

      <View style={[styles.statRow, { gap: 12 * u }]}>
        <Stat u={u} label="LONGEST" value={activity.longestStreak} />
        <Stat u={u} label="ACTIVE DAYS" value={activity.activeDays} />
      </View>

      {!alive && activity.lastActive && (
        <Text style={[styles.empty, { fontSize: 7.5 * u }]} numberOfLines={1}>
          Last public activity {activity.lastActive}
        </Text>
      )}
    </View>
  );
}

function Stat({ u, label, value }: { u: number; label: string; value: number }) {
  return (
    <View>
      <Text style={[styles.statValue, { fontSize: 12 * u }]}>{value}</Text>
      <Text style={[styles.countLabel, { fontSize: 6.5 * u }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    backgroundImage: "linear-gradient(160deg, rgba(28, 52, 32, 0.96), rgba(6, 14, 9, 0.96))",
    borderWidth: 1,
    borderColor: "rgba(150, 255, 120, 0.32)",
    boxShadow: `0 0 16px ${colors.glow}`,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    color: colors.text,
    fontWeight: "600",
  },
  handle: {
    flex: 1,
    textAlign: "right",
    color: colors.textMuted,
  },
  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  count: {
    alignItems: "center",
  },
  countValue: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  countLabel: {
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
  stateDot: {
    marginTop: 1,
  },
  prText: {
    flex: 1,
  },
  prTitle: {
    color: colors.text,
  },
  prRepo: {
    color: colors.textSubtle,
  },
  empty: {
    color: colors.textSubtle,
  },
  streakValue: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  streakUnit: {
    color: colors.textMuted,
    fontWeight: "500",
  },
  statRow: {
    flexDirection: "row",
  },
  statValue: {
    color: colors.text,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
