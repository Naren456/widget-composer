import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { type CSSAnimationKeyframes } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogoTile } from "@/components/ui/logo-tile";
import { colors } from "@/theme/tokens";

const float: CSSAnimationKeyframes = {
  from: { transform: [{ translateY: -4 }] },
  to: { transform: [{ translateY: 4 }] },
};

// Indeterminate bar: a short fill sweeping the full width of the track.
const sweep: CSSAnimationKeyframes = {
  from: { transform: [{ translateX: "-120%" }] },
  to: { transform: [{ translateX: "320%" }] },
};

type Props = {
  /** 0–1. Omit when the real duration is unknown — the bar then sweeps instead. */
  progress?: number;
  title?: string;
  note?: string;
  /** Renders a cancel action under the note when the work can be abandoned. */
  onCancel?: () => void;
};

export function LoadingScreen({
  progress,
  title = "Creating your widget…",
  note = "Designs are generated using AI and\ncan be customized.",
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const determinate = progress !== undefined;
  const percent = determinate ? Math.round(Math.min(Math.max(progress, 0), 1) * 100) : undefined;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 28 }]}>
      <Image
        source={require("@/assets/images/backgrounds/background.jpg")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />

      <View style={styles.header}>
        <LogoTile />
        <Text style={styles.wordmark} accessibilityRole="header">
          Widget <Text style={styles.wordmarkAccent}>Composer</Text>
        </Text>
        <Text style={styles.tagline}>Your ideas, on your home screen.</Text>
      </View>

      <Animated.View
        style={[
          styles.widgets,
          {
            animationName: float,
            animationDuration: "3.2s",
            animationIterationCount: "infinite",
            animationDirection: "alternate",
            animationTimingFunction: "ease-in-out",
          },
        ]}
      >
        <Image
          source={require("@/assets/images/illustrations/widgets.png")}
          style={styles.widgetsImage}
          contentFit="contain"
          accessibilityLabel="Example widgets: clock and weather, quote, task list and countdown"
        />
      </Animated.View>

      <View style={styles.footer}>
        <Text style={styles.loadingTitle}>{title}</Text>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityLabel={title}
          accessibilityValue={determinate ? { min: 0, max: 100, now: percent } : undefined}
        >
          {determinate ? (
            <Animated.View
              style={[
                styles.fill,
                { width: `${percent}%`, transitionProperty: "width", transitionDuration: 300 },
              ]}
            />
          ) : (
            <Animated.View
              style={[
                styles.fill,
                styles.sweepFill,
                {
                  animationName: sweep,
                  animationDuration: "1.4s",
                  animationIterationCount: "infinite",
                  animationTimingFunction: "ease-in-out",
                },
              ]}
            />
          )}
        </View>
        <View style={styles.note}>
          <Image source={require("@/assets/images/icons/lightbulb.png")} style={styles.noteIcon} />
          <Text style={styles.noteText}>{note}</Text>
        </View>
        {onCancel && (
          <Pressable onPress={onCancel} hitSlop={12} accessibilityRole="button" style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  wordmark: {
    marginTop: 22,
    color: colors.text,
    fontSize: 31,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  wordmarkAccent: {
    color: colors.brand,
  },
  tagline: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 15,
  },
  widgets: {
    flex: 1,
    marginVertical: 12,
  },
  widgetsImage: {
    flex: 1,
  },
  footer: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "500",
  },
  track: {
    width: "100%",
    maxWidth: 260,
    height: 10,
    marginTop: 16,
    borderRadius: 5,
    overflow: "hidden",
    backgroundColor: colors.track,
  },
  sweepFill: {
    width: "40%",
  },
  fill: {
    height: "100%",
    borderRadius: 5,
    backgroundImage: `linear-gradient(90deg, ${colors.brandDeep}, ${colors.brand})`,
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 40,
  },
  noteIcon: {
    width: 30,
    height: 30,
  },
  cancel: {
    marginTop: 20,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "500",
  },
  noteText: {
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 18,
  },
});
