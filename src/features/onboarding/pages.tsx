import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";

import { LogoTile } from "@/components/ui/logo-tile";
import {
  ClockWidget,
  CountdownWidget,
  MorningWidget,
  MountainWidget,
  QuoteWidget,
  TaskWidget,
} from "@/components/widget-preview/previews";
import {
  ControlLabel,
  WidgetColorSelector,
  WidgetSizeSelector,
  WidgetStyleSelector,
} from "@/components/forms/widget-controls";
import { colors } from "@/theme/tokens";
import { useWidgetAppearance } from "@/hooks/use-widget-appearance";

/**
 * Example content for the showcase grid. It is written as an illustration of what a
 * user could make, not presented as their data; the countdown targets the real next
 * New Year so its numbers are true.
 */
function nextNewYear(now = new Date()): Date {
  return new Date(now.getFullYear() + 1, 0, 1);
}

const examples = {
  quote: "A better\nversion of you\nevery day.",
  mountain: "Discipline today,\nbrighter tomorrow.",
  tasks: [
    { label: "Plan the week", done: true },
    { label: "Read 10 pages", done: false },
    { label: "Exercise", done: false },
  ],
};

export type PageProps = {
  /** Usable content width of the page. */
  width: number;
};

type HeadingPart = { text: string; accent?: boolean };

function Heading({ parts, subtitle }: { parts: HeadingPart[]; subtitle: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title} accessibilityRole="header">
        {parts.map((p) => (
          <Text key={p.text} style={p.accent && styles.accent}>
            {p.text}
          </Text>
        ))}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function Sparkle({ size, style }: { size: number; style?: object }) {
  return (
    <SymbolView
      name={{ ios: "sparkle", android: "auto_awesome", web: "auto_awesome" }}
      tintColor={colors.brand}
      size={size}
      style={[{ position: "absolute" }, style]}
    />
  );
}

export function WelcomePage({ width }: PageProps) {
  return (
    <View style={styles.page}>
      <View style={styles.welcomeHeader}>
        <LogoTile />
        <Text style={styles.wordmark} accessibilityRole="header">
          Widget <Text style={styles.accent}>Composer</Text>
        </Text>
        <Text style={styles.welcomeTagline}>Your ideas, on your{"\n"}home screen.</Text>
      </View>
      <Image
        source={require("@/assets/images/illustrations/widgets.png")}
        style={[styles.welcomeArt, { width: width + 32 }]}
        contentFit="contain"
        accessibilityLabel="Example widgets: clock and weather, quote, task list and countdown"
      />
    </View>
  );
}

export function CreatePage({ width }: PageProps) {
  const gap = 12;
  const cardWidth = Math.min((width - gap) / 2, 180);
  return (
    <View style={styles.page}>
      <Heading
        parts={[{ text: "Create beautiful\nwidgets " }, { text: "with AI", accent: true }]}
        subtitle="Turn simple ideas into stunning home screen widgets in seconds."
      />
      <View style={[styles.grid, { width: cardWidth * 2 + gap, gap }]}>
        <ClockWidget width={cardWidth} style={{ height: cardWidth * 0.8 }} />
        <QuoteWidget width={cardWidth} style={{ height: cardWidth * 0.8 }} text={examples.quote} />
        <MountainWidget width={cardWidth} style={{ height: cardWidth * 0.8 }} text={examples.mountain} />
        <CountdownWidget
          width={cardWidth}
          style={{ height: cardWidth * 0.8 }}
          title="New Year"
          target={nextNewYear()}
        />
        <TaskWidget width={cardWidth} style={{ height: cardWidth * 0.8 }} tasks={examples.tasks} />
        <MorningWidget width={cardWidth} style={{ height: cardWidth * 0.8 }} />
      </View>
    </View>
  );
}

export function DescribePage({ width }: PageProps) {
  const previewWidth = Math.min(width * 0.62, 230);
  return (
    <View style={styles.page}>
      <Heading
        parts={[{ text: "Just " }, { text: "describe", accent: true }, { text: "\nyour idea" }]}
        subtitle={"Tell the AI what you want —\na clock, quote, todo list, countdown\nor anything you imagine."}
      />
      <View style={styles.describeBody}>
        <View style={styles.prompt}>
          <SymbolView
            name={{ ios: "sparkles", android: "auto_awesome", web: "auto_awesome" }}
            tintColor={colors.text}
            size={18}
          />
          <Text style={styles.promptText}>A minimal dark clock widget{"\n"}with date and weather</Text>
          <View style={styles.promptSend}>
            <SymbolView
              name={{ ios: "arrow.right", android: "arrow_forward", web: "arrow_forward" }}
              tintColor={colors.background}
              size={18}
            />
          </View>
        </View>
        <SymbolView
          name={{ ios: "arrow.down", android: "arrow_downward", web: "arrow_downward" }}
          tintColor={colors.brand}
          size={36}
          style={styles.downArrow}
        />
        <View>
          <ClockWidget width={previewWidth} />
          <Sparkle size={18} style={{ left: -34, top: previewWidth * 0.2 }} />
          <Sparkle size={14} style={{ right: -30, top: previewWidth * 0.36 }} />
        </View>
      </View>
    </View>
  );
}

export function CustomizePage({ width }: PageProps) {
  const a = useWidgetAppearance();
  const previewWidth = Math.min(width * 0.7, 240) * a.size.previewScale;

  return (
    <View style={styles.page}>
      <Heading
        parts={[{ text: "Customize", accent: true }, { text: "\nyour style" }]}
        subtitle={"Change colors, fonts, backgrounds\nand make it truly yours."}
      />
      <View style={styles.customizePreview}>
        <ClockWidget width={previewWidth} theme={a.theme} />
        <Sparkle size={14} style={{ left: 4, top: 30 }} />
        <Sparkle size={10} style={{ right: 6, top: 70 }} />
      </View>

      <View style={styles.controls}>
        <ControlLabel>Style</ControlLabel>
        <WidgetStyleSelector value={a.styleId} onChange={a.setStyleId} />

        <View style={styles.controlGap} />
        <ControlLabel>Color theme</ControlLabel>
        <WidgetColorSelector value={a.colorId} onChange={a.setColorId} disabled={!a.colorsEnabled} />

        <View style={styles.controlGap} />
        <ControlLabel>Widget size</ControlLabel>
        <WidgetSizeSelector value={a.sizeId} onChange={a.setSizeId} />
      </View>
    </View>
  );
}

const steps = ["Long press on home screen", "Tap on Widgets", "Find WidgetComposer", "Add your widget"];

export function HomeScreenPage({ width }: PageProps) {
  const phoneWidth = Math.min(width * 0.58, 210);
  return (
    <View style={styles.page}>
      <Heading
        parts={[{ text: "Add to your\n" }, { text: "home screen", accent: true }]}
        subtitle={"In just a few taps, add your\nwidget to the home screen\nand enjoy it every day."}
      />
      <View style={styles.homeArt}>
        <View style={[styles.phone, { width: phoneWidth, height: phoneWidth * 1.2 }]}>
          <View style={styles.phoneNotch} />
          <View style={styles.phoneGrid}>
            <View style={styles.phoneAppsColumn}>
              <View style={styles.appIcon} />
              <View style={styles.appIcon} />
            </View>
            <ClockWidget width={phoneWidth * 0.58} />
          </View>
          <View style={styles.phoneAppsRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.appIcon} />
            ))}
          </View>
        </View>
        <Sparkle size={22} style={{ right: 8, top: -6 }} />
        <Sparkle size={12} style={{ right: 0, top: 26 }} />

        <View style={styles.steps}>
          {steps.map((step, i) => (
            <View key={step} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
  },
  heading: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  accent: {
    color: colors.brand,
  },
  subtitle: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },

  welcomeHeader: {
    alignItems: "center",
    // The pager clips its content, so leave room for the logo's pulsing glow (up to 46px).
    marginTop: 48,
  },
  wordmark: {
    marginTop: 22,
    color: colors.text,
    fontSize: 31,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  welcomeTagline: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
  },
  welcomeArt: {
    flex: 1,
    marginTop: 8,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  describeBody: {
    width: "100%",
    alignItems: "center",
  },
  prompt: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.brandDeep,
    backgroundColor: "rgba(12, 22, 14, 0.9)",
    boxShadow: `0 0 20px ${colors.glow}`,
  },
  promptText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  promptSend: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  downArrow: {
    marginVertical: 18,
  },

  customizePreview: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  controls: {
    width: "100%",
  },
  controlGap: {
    height: 18,
  },

  homeArt: {
    width: "100%",
    alignItems: "center",
  },
  phone: {
    borderRadius: 30,
    borderWidth: 4,
    borderColor: "#3A3F44",
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 12,
    paddingTop: 26,
    gap: 12,
    backgroundImage: "linear-gradient(180deg, #121A2A, #0B1018)",
    overflow: "hidden",
  },
  phoneNotch: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    width: 54,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#000",
  },
  phoneGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  phoneAppsColumn: {
    gap: 12,
  },
  phoneAppsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  appIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  steps: {
    width: "100%",
    marginTop: -40,
    padding: 16,
    gap: 14,
    borderRadius: 20,
    backgroundColor: "rgba(22, 28, 25, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
    color: colors.text,
    fontSize: 14,
  },
});
