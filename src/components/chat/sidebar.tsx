import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing, typography } from "@/theme/tokens";
import { hostFromUrl, type SavedWidget } from "@/types/widget";

type Props = {
  open: boolean;
  onClose: () => void;
  widgets: SavedWidget[];
  onNewChat: () => void;
  onOpenWidget: (widget: SavedWidget) => void;
  onOpenGitHub: () => void;
  onOpenProfile: () => void;
};

function Row({
  icon,
  label,
  meta,
  onPress,
}: {
  icon: SymbolViewProps["name"];
  label: string;
  meta?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <SymbolView name={icon} tintColor={colors.text} size={20} />
      <View style={styles.rowText}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {label}
        </Text>
        {meta && (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/** Slide-in drawer in the ChatGPT pattern: new chat up top, history, account at the bottom. */
export function Sidebar({ open, onClose, widgets, onNewChat, onOpenWidget, onOpenGitHub, onOpenProfile }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerWidth = Math.min(width * 0.82, 320);

  return (
    // pointerEvents as a style (not a prop) so react-native-web lets taps through when closed.
    <View
      style={[StyleSheet.absoluteFill, { pointerEvents: open ? "auto" : "none" }]}
      aria-hidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
    >
      <Animated.View
        style={[
          styles.backdrop,
          { opacity: open ? 1 : 0, transitionProperty: "opacity", transitionDuration: 220 },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal={open}
        style={[
          styles.drawer,
          {
            width: drawerWidth,
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            transform: [{ translateX: open ? 0 : -drawerWidth }],
            transitionProperty: "transform",
            transitionDuration: 240,
            transitionTimingFunction: "ease-out",
          },
        ]}
      >
        <Row
          icon={{ ios: "square.and.pencil", android: "edit_square", web: "edit_square" }}
          label="New widget"
          onPress={onNewChat}
        />

        <Text style={styles.section}>Sources</Text>
        <Row
          icon={{ ios: "chevron.left.forwardslash.chevron.right", android: "code", web: "code" }}
          label="GitHub"
          meta="Pull requests and public activity"
          onPress={onOpenGitHub}
        />

        <Text style={styles.section}>Your widgets</Text>
        <ScrollView style={styles.history} showsVerticalScrollIndicator={false}>
          {widgets.length === 0 ? (
            <Text style={styles.empty}>Widgets you save show up here.</Text>
          ) : (
            widgets.map((w) => (
              <Row
                key={w.id}
                icon={{ ios: "square.grid.2x2", android: "widgets", web: "widgets" }}
                label={w.name}
                meta={w.url ? hostFromUrl(w.url) : w.summary}
                onPress={() => onOpenWidget(w)}
              />
            ))
          )}
        </ScrollView>

        <Pressable
          onPress={onOpenProfile}
          accessibilityRole="button"
          accessibilityLabel="Profile"
          style={({ pressed }) => [styles.account, pressed && styles.rowPressed]}
        >
          <View style={styles.accountAvatar}>
            <Text style={styles.accountInitial}>G</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Guest</Text>
            <Text style={styles.rowMeta}>Not signed in</Text>
          </View>
          <SymbolView
            name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
            tintColor={colors.textMuted}
            size={16}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: spacing.md,
    backgroundColor: "#0B110D",
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    ...typography.body,
    color: colors.text,
  },
  rowMeta: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 1,
  },
  section: {
    ...typography.meta,
    color: colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  history: {
    flex: 1,
  },
  empty: {
    ...typography.meta,
    color: colors.textSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  account: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accountAvatar: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: "rgba(166, 239, 92, 0.4)",
  },
  accountInitial: {
    ...typography.label,
    color: colors.brand,
  },
});
