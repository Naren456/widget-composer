import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { Platform, StyleSheet, Text, useColorScheme, View } from "react-native";

import { type WidgetDataMap, type WidgetNode, type WidgetPalette, type WidgetSpec } from "@/services/widget-api";

type Props = {
  spec: WidgetSpec;
  data: WidgetDataMap | null;
  sample?: boolean;
};

type Palette = WidgetPalette;
type WidgetFont = NonNullable<WidgetSpec["presentation"]["fontFamily"]>;

function fontStyle(font: WidgetFont | undefined) {
  if (font === "serif") return { fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, serif" }) };
  if (font === "monospace") return { fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) };
  return undefined;
}

function paletteFor(theme: WidgetSpec["presentation"]["theme"], system: "light" | "dark" | null, custom?: WidgetPalette, themeVariant?: WidgetSpec["presentation"]["themeVariant"]): Palette {
  const dark = theme === "dark" || (theme === "system" && system !== "light");
  const isMui = themeVariant?.startsWith("mui");
  const muiDark = themeVariant === "mui-dark";

  const base = isMui
    ? muiDark
      ? {
          background: "#121212",
          surface: "#1E1E1E",
          text: "#FFFFFF",
          muted: "#B0B0B0",
          accent: "#BB86FC",
          border: "#424242",
        }
      : {
          background: "#F5F5F5",
          surface: "#FFFFFF",
          text: "#212121",
          muted: "#757575",
          accent: "#6750A4",
          border: "#B0B0B0",
        }
    : dark
      ? { background: "#141218", surface: "#211F26", text: "#E6E1E5", muted: "#CAC4D0", accent: "#D0BCFF", border: "#938F99" }
      : { background: "#FEF7FF", surface: "#F7F2FA", text: "#1D1B20", muted: "#49454F", accent: "#6750A4", border: "#79747E" };

  return {
    ...base,
    ...custom,
  };
}

function onAccent(accent: string): string {
  const channels = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(accent.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.179 ? "#1D1B20" : "#FFFFFF";
}

function resolve(binding: string, data: WidgetDataMap | null): string | null {
  const match = /^([a-z][a-z0-9_]{0,23})\.(?:count|items\[(\d{1,2})\]\.(title|url|repo|number|author|updatedAt|imageUrl|summary|publishedAt|sourceName))$/.exec(binding);
  if (!match) return null;
  const source = data?.[match[1]];
  if (!source) return null;
  if (match[2] === undefined) return String(source.count);
  const item = source.items[Number(match[2])];
  const value = item?.[match[3] as keyof typeof item];
  return value === undefined ? null : String(value);
}

function template(value: string, data: WidgetDataMap | null): string {
  return value.replace(/\{\{\s*([^{}]*?)\s*\}\}/g, (_placeholder, binding: string) => resolve(binding.trim(), data) ?? "–");
}

function ClockPreview({ node, palette, family }: { node: Extract<WidgetNode, { type: "clock" }>; palette: Palette; family?: WidgetFont }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), node.showSeconds ? 1000 : 30_000);
    return () => clearInterval(timer);
  }, [node.showSeconds]);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: node.showSeconds ? "2-digit" : undefined,
    hour12: node.format === "12_hour",
  }).format(now);
  const date = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(now);
  return (
    <View>
      <Text style={[styles.clockTime, fontStyle(family), { color: palette.accent }]}>{time}</Text>
      {node.showDate && <Text style={[styles.caption, fontStyle(family), { color: palette.muted }]}>{date}</Text>}
    </View>
  );
}

function NodePreview({ node, data, palette, family }: { node: WidgetNode; data: WidgetDataMap | null; palette: Palette; family?: WidgetFont }) {
  switch (node.type) {
    case "column":
    case "row":
      return (
        <View style={[
          { flexDirection: node.type, alignItems: node.type === "row" ? "center" : undefined, gap: node.gap ?? 6 },
          node.surface && { backgroundColor: palette.surface, borderRadius: node.radiusDp ?? 16, padding: node.paddingDp ?? 12 },
        ]}>
          {node.children.map((child, index) => (
            <NodePreview key={`${child.type}-${index}`} node={child} data={data} palette={palette} family={family} />
          ))}
        </View>
      );
    case "text":
      return (
        <Text
          style={[
            styles.text,
            fontStyle(family),
            { color: node.colorToken ? palette[node.colorToken] : node.style === "caption" ? palette.muted : palette.text },
            node.fontSizeDp !== undefined && { fontSize: node.fontSizeDp, lineHeight: Math.round(node.fontSizeDp * 1.35) },
            node.weight && { fontWeight: node.weight === "bold" ? "700" : node.weight === "medium" ? "600" : "400" },
            node.style === "title" && styles.title,
            node.style === "caption" && styles.caption,
          ]}
        >
          {template(node.text, data)}
        </Text>
      );
    case "image": {
      const match = /^([a-z][a-z0-9_]{0,23})\.items\[(\d{1,2})\]\.imageUrl$/.exec(node.source);
      const item = match ? data?.[match[1]]?.items[Number(match[2])] : data?.[node.source]?.items[0];
      if (!item?.imageData) {
        return <Text style={[styles.caption, { color: palette.muted }]}>{node.alt ?? "Image unavailable"}</Text>;
      }
      const mimeType = item.imageMimeType ?? "image/png";
      return (
        <Image
          source={{ uri: `data:${mimeType};base64,${item.imageData}` }}
          style={{ width: node.widthDp ?? 48, height: node.heightDp ?? 48, borderRadius: node.radiusDp ?? 12 }}
          contentFit={node.fit ?? "cover"}
          accessibilityLabel={node.alt ?? item.title ?? "Widget image"}
        />
      );
    }
    case "clock":
      return <ClockPreview node={node} palette={palette} family={family} />;
    case "metric":
      return (
        <View style={styles.metric}>
          <Text style={[styles.metricValue, fontStyle(family), { color: palette.accent }]}>{resolve(node.valueBinding, data) ?? "–"}</Text>
          <Text style={[styles.caption, fontStyle(family), { color: palette.muted }]}>{node.label}</Text>
        </View>
      );
    case "progress": {
      const value = Number(resolve(node.valueBinding, data) ?? 0);
      const ratio = Math.max(0, Math.min(1, value / node.maxValue));
      return (
        <View style={[styles.progress, { width: node.widthDp ?? 128 }]}>
          {node.label && <Text style={[styles.caption, fontStyle(family), { color: palette.muted }]} numberOfLines={1}>{node.label}</Text>}
          <View style={[styles.progressTrack, { height: node.heightDp ?? 7, backgroundColor: palette.border, borderRadius: (node.heightDp ?? 7) / 2 }]}>
            <View style={{ width: `${ratio * 100}%`, height: "100%", backgroundColor: palette.accent, borderRadius: (node.heightDp ?? 7) / 2 }} />
          </View>
        </View>
      );
    }
    case "device_info": {
      const label = node.label ?? node.metric.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
      const display = node.display ?? (node.metric === "battery_level" || node.metric === "storage_used_percent" ? "progress" : "text");
      if (display === "metric") {
        return <View style={styles.metric}><Text style={[styles.metricValue, fontStyle(family), { color: palette.accent }]}>Live on Android</Text><Text style={[styles.caption, fontStyle(family), { color: palette.muted }]}>{label}</Text></View>;
      }
      if (display === "progress") {
        return <View style={[styles.progress, { width: 128 }]}><Text style={[styles.caption, fontStyle(family), { color: palette.muted }]}>{label} · Live on Android</Text><View style={[styles.progressTrack, { height: 7, backgroundColor: palette.border, borderRadius: 4 }]} /></View>;
      }
      return <Text style={[styles.text, fontStyle(family), { color: palette.text }]}>{label} · Live on Android</Text>;
    }
    case "list": {
      const items = data?.[node.source]?.items.slice(0, node.maxItems) ?? [];
      return items.length ? (
        <View style={styles.list}>
          {items.map((item, index) => (
            <View key={`${item.url ?? item.title ?? "item"}-${index}`} style={[styles.listItem, { borderTopColor: palette.border }]}>
              <Text style={[styles.text, styles.itemTitle, fontStyle(family), { color: palette.text }]} numberOfLines={1}>
                {item.title ?? "Untitled"}
              </Text>
              <Text style={[styles.caption, fontStyle(family), { color: palette.muted }]} numberOfLines={1}>
                {item.repo ? `${item.repo}${item.number ? `#${item.number}` : ""}` : item.author ?? ""}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.caption, fontStyle(family), { color: palette.muted }]}>{data ? "Nothing here yet" : "Data will appear here"}</Text>
      );
    }
    case "streak_chart": {
      const summary = data?.[node.source]?.contributions;
      const days = summary?.days.slice(-28) ?? [];
      const levels = [palette.border, "#0E4429", "#006D32", "#26A641", "#39D353"];
      return (
        <View style={styles.streakChart}>
          <View style={styles.streakStats}>
            <Text style={[styles.streakValue, fontStyle(family), { color: palette.accent }]}>{summary ? `${summary.currentStreak} day${summary.currentStreak === 1 ? "" : "s"}` : "–"}</Text>
            <Text style={[styles.caption, fontStyle(family), { color: palette.muted }]}>current streak · best {summary?.longestStreak ?? "–"}</Text>
          </View>
          <View style={styles.streakGrid} accessibilityLabel="Last 28 days of GitHub contributions">
            {Array.from({ length: 4 }, (_, row) => (
              <View key={row} style={styles.streakRow}>
                {Array.from({ length: 7 }, (_, column) => {
                  const day = days[row * 7 + column];
                  return <View key={column} style={[styles.streakCell, { backgroundColor: levels[Math.max(0, Math.min(4, day?.level ?? 0))] }]} />;
                })}
              </View>
            ))}
          </View>
          <Text style={[styles.caption, fontStyle(family), { color: palette.muted }]}>{summary ? `Past year · ${summary.total} contributions` : "Contribution data will appear here"}</Text>
        </View>
      );
    }
    case "divider":
      return <View style={[styles.divider, { backgroundColor: palette.border }]} />;
    case "spacer":
      return <View style={{ height: Math.min(node.sizeDp, 32) }} />;
    case "button":
      return (
        <View style={[styles.button, { backgroundColor: palette.accent, borderRadius: 20 }]}>
          <Text style={[styles.buttonLabel, fontStyle(family), { color: onAccent(palette.accent) }]}>{template(node.label, data)}</Text>
        </View>
      );
    case "link":
      return <Text style={[styles.linkLabel, fontStyle(family), { color: palette.accent }]}>{node.label}</Text>;
    case "toggle": {
      const on = node.isOn ? palette.accent : palette.muted;
      return (
        <View style={styles.toggle}>
          <Text style={[styles.toggleLabel, fontStyle(family), { color: on }]}>{template(node.label, data)}</Text>
        </View>
      );
    }
    case "slider": {
      const value = Number(resolve(node.valueBinding, data) ?? node.minValue);
      const ratio = Math.max(0, Math.min(1, (value - node.minValue) / (node.maxValue - node.minValue)));
      return (
        <View style={styles.sliderContainer}>
          <Text style={[styles.sliderValue, fontStyle(family), { color: palette.text }]} numberOfLines={1}>
            {node.label}: {String(Math.round(value))}
          </Text>
          <View style={[{ height: 12, backgroundColor: palette.surface, borderRadius: 6, overflow: "hidden" }]}>
            <View style={{ width: `${ratio * 100}%`, height: "100%", backgroundColor: palette.accent }} />
          </View>
        </View>
      );
    }
    case "chip": {
      const isSelected = node.isSelected ? palette.accent : palette.muted;
      return (
        <View style={styles.chip}>

          <Text style={[styles.chipLabel, fontStyle(family), { color: isSelected }]}>{template(node.label, data)}</Text>
        </View>
      );
    }
  }
}

/** In-app preview of the same versioned WidgetSpec consumed by the Android Glance renderer. */
export function SpecPreview({ spec, data, sample = false }: Props) {
  const palette = paletteFor(spec.presentation.theme, useColorScheme(), spec.presentation.palette, spec.presentation.themeVariant);
  const family = spec.presentation.fontFamily ?? "sans";
  const hasGithubSource = spec.dataSources.some((source) => source.connector === "github");
  const background = spec.presentation.backgroundImageAssetId
    ? data?.[`asset_${spec.presentation.backgroundImageAssetId}`]?.items[0]
    : undefined;
  return (
    <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}>
      {background?.imageData && (
        <Image
          source={{ uri: `data:${background.imageMimeType ?? "image/jpeg"};base64,${background.imageData}` }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityLabel="Widget background image"
        />
      )}
      <View style={styles.header}>
        <View style={[styles.accentMark, { backgroundColor: palette.accent }]} />
        <Text style={[styles.name, fontStyle(family), { color: palette.text }]} numberOfLines={1}>{spec.name}</Text>
      </View>
      <NodePreview node={spec.root} data={data} palette={palette} family={family} />
      {sample && hasGithubSource && <Text style={[styles.sample, { color: palette.muted }]}>Sample GitHub data · connect GitHub for live updates</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 12,
    overflow: "hidden",
    position: "relative",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 24 },
  accentMark: { width: 4, height: 16, borderRadius: 2 },
  name: { fontSize: 14, fontWeight: "600", letterSpacing: 0.1 },
  text: { fontSize: 14, lineHeight: 20 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
  clockTime: { fontSize: 30, lineHeight: 35, fontWeight: "700", fontVariant: ["tabular-nums"] },
  caption: { fontSize: 12, lineHeight: 16 },
  metric: { gap: 2 },
  metricValue: { fontSize: 26, lineHeight: 31, fontWeight: "700", fontVariant: ["tabular-nums"] },
  list: { gap: 8 },
  listItem: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 4 },
  streakChart: { gap: 7 },
  streakStats: { gap: 1 },
  streakValue: { fontSize: 22, lineHeight: 27, fontWeight: "700", fontVariant: ["tabular-nums"] },
  streakGrid: { gap: 3, alignSelf: "flex-start" },
  streakRow: { flexDirection: "row", gap: 3 },
  streakCell: { width: 10, height: 10, borderRadius: 3 },
  itemTitle: { fontWeight: "600" },
  image: { width: 48, height: 48, borderRadius: 12 },
  button: { alignSelf: "flex-start", minHeight: 48, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 10 },
  progress: { gap: 4 },
  progressTrack: { width: "100%", overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, width: "100%" },
  buttonLabel: { fontSize: 14, fontWeight: "600" },
  linkLabel: { fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
  sample: { fontSize: 10, lineHeight: 14 },
  toggle: {
    padding: 8,
    backgroundColor: "#211F26",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toggleLabel: { fontSize: 12, fontWeight: "500" },
  sliderContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  sliderValue: { fontSize: 12, fontWeight: "500" },
  sliderTrack: { height: 12, backgroundColor: "#211F26", borderRadius: 6, overflow: "hidden" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#211F26",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chipLabel: { fontSize: 12, fontWeight: "500" },
});
