import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useId } from "react";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { useNow } from "@/hooks/use-now";
import { type ClockTheme, clockThemes, type ClockThemeName } from "@/theme/clock-themes";
import { colors } from "@/theme/tokens";
import { greeting, pad2, timeUntil, widgetDate, widgetTime } from "@/utils/time";

/*
 * Every preview is designed at BASE width and scales its sizes from the `width` prop.
 * Content comes from props; date, time, countdown and greeting are computed live, so
 * nothing on a card claims data it does not have.
 */
const BASE = 150;
const serif = Platform.select({ ios: "Georgia", default: "serif" });

type PreviewProps = {
  width: number;
  style?: ViewStyle;
};

/** Mixes a #RRGGBB color toward white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number) {
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(c + (target - c) * t)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/** Weather is shown only when a caller has real readings to pass in. */
export type WeatherReading = { icon: string; temperature: string; place: string };

export function ClockWidget({
  width,
  style,
  theme = "default",
  weather,
}: PreviewProps & { theme?: ClockThemeName; weather?: WeatherReading }) {
  const t: ClockTheme = clockThemes[theme];
  const now = useNow();
  const u = width / BASE;
  const text = t.light ? "#18202C" : colors.text;
  const subText = t.light ? "#3A4454" : "#E4EAE5";
  // Gradient ids are document-global on web, so each instance needs its own.
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View
      style={[
        styles.card,
        styles.clockCard,
        {
          width,
          height: 100 * u,
          borderRadius: 18 * u,
          paddingHorizontal: 14 * u,
          paddingVertical: 12 * u,
          borderColor: t.border,
          backgroundImage: `linear-gradient(150deg, ${t.background[0]}, ${t.background[1]})`,
          boxShadow: `0 0 ${20 * u}px ${t.border}${t.light ? "40" : "70"}`,
        },
        style,
      ]}
    >
      {t.photo && (
        <>
          <Image source={t.photo} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: t.photoTint }]} />
          <View style={[StyleSheet.absoluteFill, styles.photoLegibility]} />
        </>
      )}
      {t.streak && <View style={[styles.streak, { width: 320 * u, height: 46 * u, top: 30 * u, left: -60 * u }]} />}
      {t.wave && (
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 300 200" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`hill${id}`} x1="1" y1="0.35" x2="0.25" y2="1">
              <Stop offset="0" stopColor={shade(t.wave, t.light ? 0.1 : 0.45)} />
              <Stop offset="0.45" stopColor={t.wave} stopOpacity="0.85" />
              <Stop offset="1" stopColor={shade(t.wave, t.light ? -0.1 : -0.7)} stopOpacity="0.2" />
            </LinearGradient>
            <LinearGradient id={`ripple${id}`} x1="0" y1="0" x2="0.6" y2="1">
              <Stop offset="0" stopColor={t.wave} stopOpacity="0.28" />
              <Stop offset="1" stopColor={t.wave} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path d="M0 128 C55 145 100 172 150 200 L0 200 Z" fill={`url(#ripple${id})`} />
          <Path d="M140 200 C185 178 202 130 244 110 C266 100 285 97 300 97 L300 200 Z" fill={`url(#hill${id})`} />
        </Svg>
      )}
      <Text style={[styles.clockDate, { fontSize: 8.5 * u, color: subText }]}>{widgetDate(now)}</Text>
      <Text
        style={[
          styles.clockTime,
          { fontSize: 31 * u, lineHeight: 37 * u, marginLeft: 16 * u, color: text },
          t.light && styles.noShadow,
        ]}
      >
        {widgetTime(now)}
      </Text>
      {weather ? (
        <View style={[styles.row, { gap: 6 * u, marginLeft: 18 * u }]}>
          <Text style={{ fontSize: 15 * u }}>{weather.icon}</Text>
          <View>
            <Text style={[styles.weatherTemp, { fontSize: 11 * u, color: text }]}>{weather.temperature}</Text>
            <Text style={[styles.weatherCity, { fontSize: 8.5 * u, color: subText }]}>{weather.place}</Text>
          </View>
        </View>
      ) : (
        // Keeps the card's vertical rhythm without inventing a reading.
        <View style={{ height: 24 * u }} />
      )}
    </View>
  );
}

export function QuoteWidget({ width, style, text }: PreviewProps & { text: string }) {
  const u = width / BASE;
  return (
    <View
      style={[
        styles.card,
        styles.paper,
        { width, height: 120 * u, borderRadius: 20 * u, paddingLeft: 13 * u },
        style,
      ]}
    >
      <Image
        source={require("@/assets/images/widget-photos/leaves.png")}
        style={{ position: "absolute", right: -4 * u, top: -4 * u, width: 66 * u, height: 128 * u }}
        contentFit="contain"
      />
      <Text style={[styles.quoteText, { fontSize: 11.5 * u, lineHeight: 15 * u }]}>
        {text}
      </Text>
      <View style={[styles.quoteDash, { width: 8 * u, marginTop: 6 * u }]} />
    </View>
  );
}

export function MountainWidget({ width, style, text }: PreviewProps & { text: string }) {
  const u = width / BASE;
  return (
    <View style={[styles.card, { width, height: 120 * u, borderRadius: 20 * u }, style]}>
      <Image
        source={require("@/assets/images/widget-photos/mountain.jpg")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <View style={[styles.photoShade, { padding: 13 * u }]}>
        <Text style={[styles.mountainText, { fontSize: 11 * u, lineHeight: 15 * u }]}>
          {text}
        </Text>
      </View>
    </View>
  );
}

/** Greets for the current time of day unless given its own text. */
export function MorningWidget({ width, style, text }: PreviewProps & { text?: string }) {
  const u = width / BASE;
  const now = useNow();
  return (
    <View style={[styles.card, { width, height: 120 * u, borderRadius: 20 * u }, style]}>
      <Image
        source={require("@/assets/images/widget-photos/morning.jpg")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <Text style={[styles.morningText, { fontSize: 17 * u, lineHeight: 20 * u, margin: 14 * u }]}>
        {text ?? greeting(now).replace(" ", "\n")}
      </Text>
    </View>
  );
}

export function CountdownWidget({ width, style, title, target }: PreviewProps & { title: string; target: Date }) {
  const u = width / BASE;
  const left = timeUntil(target, useNow());
  const countdown = [
    { value: pad2(left.days), unit: "DAYS" },
    { value: pad2(left.hours), unit: "HOURS" },
    { value: pad2(left.minutes), unit: "MINS" },
  ];
  return (
    <View
      style={[
        styles.card,
        styles.violet,
        { width, height: 120 * u, borderRadius: 20 * u, padding: 13 * u },
        style,
      ]}
    >
      <View style={[styles.row, { gap: 6 * u }]}>
        <SymbolView
          name={{ ios: "calendar", android: "calendar_month", web: "calendar_month" }}
          tintColor="#FFFFFF"
          size={14 * u}
        />
        <Text style={[styles.countdownTitle, { fontSize: 10 * u }]} numberOfLines={1}>
          {title}
        </Text>
        <SymbolView
          name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
          tintColor="#FFFFFF"
          size={12 * u}
        />
      </View>
      <View style={styles.countdownRow}>
        {countdown.map((part) => (
          <View key={part.unit} style={styles.countdownPart}>
            <Text style={[styles.countdownValue, { fontSize: 22 * u }]}>{part.value}</Text>
            <Text style={[styles.countdownUnit, { fontSize: 6.5 * u }]}>{part.unit}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export type TaskItem = { label: string; done: boolean };

export function TaskWidget({
  width,
  style,
  title = "Today",
  tasks,
}: PreviewProps & { title?: string; tasks: TaskItem[] }) {
  const u = width / BASE;
  return (
    <View
      style={[
        styles.card,
        styles.glass,
        { width, height: 120 * u, borderRadius: 20 * u, padding: 13 * u, gap: 7 * u },
        style,
      ]}
    >
      <View style={styles.taskHeader}>
        <Text style={[styles.taskTitle, { fontSize: 10 * u }]}>{title}</Text>
        <Text style={[styles.taskCount, { fontSize: 7 * u }]}>
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        </Text>
      </View>
      {tasks.slice(0, 3).map((task) => (
        <View key={task.label} style={[styles.row, { gap: 8 * u }]}>
          <View
            style={[
              styles.checkCircle,
              { width: 13 * u, height: 13 * u, borderRadius: 7 * u, borderWidth: 1.5 * u },
              task.done && styles.checkCircleDone,
            ]}
          >
            {task.done && (
              <SymbolView
                name={{ ios: "checkmark", android: "check", web: "check" }}
                tintColor={colors.background}
                size={9 * u}
              />
            )}
          </View>
          <Text style={[styles.taskLabel, { fontSize: 9 * u }]}>{task.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
  },
  glass: {
    backgroundImage: "linear-gradient(160deg, rgba(28, 52, 32, 0.96), rgba(6, 14, 9, 0.96))",
    borderWidth: 1,
    borderColor: "rgba(150, 255, 120, 0.32)",
    boxShadow: `0 0 16px ${colors.glow}`,
  },
  paper: {
    justifyContent: "center",
    backgroundImage: "linear-gradient(135deg, #EEE9D9, #D4CEBA)",
  },
  violet: {
    justifyContent: "space-between",
    backgroundImage: "linear-gradient(135deg, #6F5EF2, #3A2FB6)",
    borderWidth: 1,
    borderColor: "rgba(170, 160, 255, 0.45)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  clockCard: {
    borderWidth: 1.5,
    justifyContent: "space-between",
  },
  photoLegibility: {
    backgroundImage: "linear-gradient(90deg, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0) 70%)",
  },
  streak: {
    position: "absolute",
    height: 70,
    backgroundImage:
      "linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.09) 50%, rgba(255, 255, 255, 0))",
    transform: [{ rotate: "-28deg" }],
  },
  noShadow: {
    textShadowColor: "transparent",
  },
  clockDate: {
    color: "#E4EAE5",
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  clockTime: {
    color: colors.text,
    fontWeight: "600",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowRadius: 6,
  },
  weatherTemp: {
    color: colors.text,
    fontWeight: "700",
  },
  weatherCity: {
    color: "#D9E2DA",
  },
  quoteText: {
    color: "#2B2A24",
    fontFamily: serif,
  },
  quoteDash: {
    height: 1,
    backgroundColor: "#2B2A24",
  },
  photoShade: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundImage: "linear-gradient(180deg, rgba(10, 16, 30, 0) 35%, rgba(10, 16, 30, 0.75))",
  },
  mountainText: {
    color: "#E6E9F0",
    fontFamily: serif,
  },
  morningText: {
    color: "#2E2A22",
    fontWeight: "500",
  },
  countdownTitle: {
    flex: 1,
    color: colors.text,
    fontWeight: "500",
  },
  countdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  countdownPart: {
    alignItems: "center",
  },
  countdownValue: {
    color: colors.text,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  countdownUnit: {
    color: "#E2DEFF",
    letterSpacing: 0.3,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  taskTitle: {
    color: colors.text,
    fontWeight: "600",
  },
  taskCount: {
    color: colors.textMuted,
  },
  checkCircle: {
    borderColor: colors.brandDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleDone: {
    backgroundColor: colors.brandDeep,
  },
  taskLabel: {
    color: "#E7ECE8",
  },
});
