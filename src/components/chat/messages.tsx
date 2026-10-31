import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { WidgetCard } from "@/components/widget-cards/widget-card";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { type AssistantDone } from "@/features/chat/compose";
import { hostFromUrl } from "@/types/widget";

export const UserMessage = memo(function UserMessage({ text, url }: { text: string; url: string | null }) {
  return (
    <View style={styles.userRow}>
      <View style={styles.userBubble}>
        {url && (
          <View style={styles.userLink}>
            <SymbolView name={{ ios: "link", android: "link", web: "link" }} tintColor={colors.brand} size={12} />
            <Text style={styles.userLinkText} numberOfLines={1}>
              {hostFromUrl(url)}
            </Text>
          </View>
        )}
        {text.length > 0 && <Text style={styles.userText}>{text}</Text>}
      </View>
    </View>
  );
});

function AssistantAvatar() {
  return (
    <View style={styles.avatar}>
      <Image
        source={require("@/assets/images/brand/logo-symbol.png")}
        style={styles.avatarLogo}
        contentFit="contain"
      />
    </View>
  );
}

type Action = { label: string; icon: SymbolViewProps["name"]; onPress: () => void; active?: boolean };

const URL_PATTERN = /(https?:\/\/[^\s)]+)/g;

/** Agent text with tappable links, e.g. a Composio connect link. */
function LinkedText({ text }: { text: string }) {
  return (
    <Text style={styles.assistantText}>
      {text.split(URL_PATTERN).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <Text
            key={i}
            style={styles.link}
            accessibilityRole="link"
            onPress={() => WebBrowser.openBrowserAsync(part)}
          >
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

/** Shown while the server agent builds a reply; the request is genuinely in flight. */
export function PendingMessage() {
  return (
    <View style={styles.assistantRow} accessibilityLiveRegion="polite">
      <AssistantAvatar />
      <View style={[styles.assistantBody, styles.pending]}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.pendingText}>Building your widget…</Text>
      </View>
    </View>
  );
}

type AssistantProps = {
  message: AssistantDone;
  cardWidth: number;
  onSave: () => void;
  onToggleTheme: () => void;
  onOpen: () => void;
};

/**
 * A finished reply. Says who built the widget — the server agent or the on-device
 * fallback — and never claims website content was read when it was not.
 */
export const AssistantMessage = memo(function AssistantMessage({
  message,
  cardWidth,
  onSave,
  onToggleTheme,
  onOpen,
}: AssistantProps) {
  const { widget, saved, source, text, note, toolsUsed } = message;

  if (!widget) {
    return (
      <View style={styles.assistantRow}>
        <AssistantAvatar />
        <View style={styles.assistantBody}>
          {text ? (
            <LinkedText text={text} />
          ) : (
            <Text style={styles.assistantText}>
              Which website should this widget use? Add one with{" "}
              <Text style={styles.strong}>+</Text>, or include it in your message, like{" "}
              <Text style={styles.strong}>techcrunch.com</Text>.
            </Text>
          )}
          {note && <Text style={styles.note}>{note}</Text>}
        </View>
      </View>
    );
  }

  const host = widget.url ? hostFromUrl(widget.url) : null;
  const actions: Action[] = [
    saved
      ? { label: "Saved", icon: { ios: "checkmark", android: "check", web: "check" }, onPress: onOpen, active: true }
      : { label: "Save", icon: { ios: "plus", android: "add", web: "add" }, onPress: onSave },
    {
      label: widget.theme === "light" ? "Light" : "Dark",
      icon:
        widget.theme === "light"
          ? { ios: "sun.max", android: "light_mode", web: "light_mode" }
          : { ios: "moon", android: "dark_mode", web: "dark_mode" },
      onPress: onToggleTheme,
    },
    { label: "Open", icon: { ios: "arrow.up.right", android: "open_in_new", web: "open_in_new" }, onPress: onOpen },
  ];

  return (
    <View style={styles.assistantRow}>
      <AssistantAvatar />
      <View style={styles.assistantBody}>
        {source === "agent" && widget.summary ? (
          <Text style={styles.assistantText}>{widget.summary}</Text>
        ) : (
          <Text style={styles.assistantText}>
            Here&apos;s a draft widget for <Text style={styles.strong}>{host}</Text>
            {widget.description ? (
              <>
                {" "}that will show: <Text style={styles.quote}>{widget.description}</Text>
              </>
            ) : (
              "."
            )}
          </Text>
        )}

        {cardWidth > 0 && (
          <View style={styles.card}>
            <WidgetCard widget={widget} width={cardWidth} onPress={onOpen} />
          </View>
        )}

        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              accessibilityRole="button"
              style={({ pressed }) => [styles.action, a.active && styles.actionActive, pressed && styles.pressed]}
            >
              <SymbolView name={a.icon} tintColor={a.active ? colors.brand : colors.textMuted} size={15} />
              <Text style={[styles.actionText, a.active && styles.actionTextActive]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {toolsUsed && toolsUsed.length > 0 && (
          <Text style={styles.note}>Data via Composio: {[...new Set(toolsUsed)].join(", ")}</Text>
        )}
        <Text style={styles.note}>
          {saved
            ? "Saved to My widgets for this session."
            : note ??
              (source === "agent"
                ? "Built by the widget agent."
                : "Website content isn't fetched yet — the card shows your request.")}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  userRow: {
    alignItems: "flex-end",
  },
  userBubble: {
    maxWidth: "82%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 22,
    borderBottomRightRadius: 6,
    backgroundColor: "#1C241F",
    gap: 6,
  },
  userLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  userLinkText: {
    ...typography.meta,
    color: colors.brand,
  },
  userText: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  assistantRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(150, 255, 120, 0.28)",
  },
  avatarLogo: {
    width: 18,
    height: 17,
  },
  assistantBody: {
    flex: 1,
    paddingTop: 4,
  },
  assistantText: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  strong: {
    fontWeight: "700",
    color: colors.brand,
  },
  link: {
    color: colors.brand,
    textDecorationLine: "underline",
  },
  pending: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pendingText: {
    ...typography.body,
    color: colors.textMuted,
  },
  quote: {
    color: colors.textMuted,
  },
  card: {
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionActive: {
    borderColor: "rgba(166, 239, 92, 0.4)",
    backgroundColor: colors.brandWash,
  },
  actionText: {
    ...typography.meta,
    fontSize: 13,
    color: colors.textMuted,
  },
  actionTextActive: {
    color: colors.brand,
  },
  note: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.75,
  },
});
