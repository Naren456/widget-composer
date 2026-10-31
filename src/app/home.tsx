import { Image } from "expo-image";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Composer } from "@/components/chat/composer";
import { AssistantMessage, PendingMessage, UserMessage } from "@/components/chat/messages";
import { Sidebar } from "@/components/chat/sidebar";
import { Screen } from "@/components/ui/screen";
import { type AssistantDone, type ChatMessage, messageId, parseRequest } from "@/features/chat/compose";
import { useWidgetStore } from "@/features/widgets/widget-store";
import { composeWithAgent } from "@/services/agent";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { nameFromUrl, type SavedWidget } from "@/types/widget";

/** Starter prompts in the ChatGPT pattern. Tapping one fills the composer, it never sends. */
const suggestions = [
  {
    title: "Latest headlines",
    body: "from techcrunch.com",
    prompt: "Show the latest headlines from techcrunch.com in a compact list",
  },
  {
    title: "Top stories",
    body: "on Hacker News",
    prompt: "Top 5 stories from news.ycombinator.com",
  },
  {
    title: "New videos",
    body: "from a YouTube channel",
    prompt: "Latest videos with thumbnails from youtube.com/@mkbhd",
  },
  {
    title: "Product updates",
    body: "from a company blog",
    prompt: "Newest product announcements from blog.google",
  },
];

/**
 * Chat-style home: describe a widget, get a draft back, save it.
 *
 * Requests go to the server agent (Claude + Composio, see `src/server/agent.ts`), which
 * returns a widget document. When the agent is not configured or unreachable the chat
 * falls back to an on-device draft and says so. The thread is session-only state.
 */
export default function Home() {
  const { widgets, save, stage } = useWidgetStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [attachedUrl, setAttachedUrl] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const cardWidth = Math.min((contentWidth - 42) * 0.78, 260);

  // Android back closes the drawer before leaving the screen.
  useEffect(() => {
    if (!drawerOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setDrawerOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [drawerOpen]);

  // Bumped by "New widget" so a reply that lands after the thread was cleared is dropped.
  const threadRef = useRef(0);
  const busy = messages.some((m) => m.role === "assistant" && m.status === "pending");

  const localDraft = (url: string, description: string): SavedWidget => ({
    id: `w_${Date.now().toString(36)}`,
    name: nameFromUrl(url),
    url,
    description,
    theme: "dark",
    createdAt: Date.now(),
  });

  const send = async () => {
    const { url, description } = parseRequest(text, attachedUrl);
    if (busy || (!url && !description)) return;

    const thread = threadRef.current;
    const replyId = messageId();
    setMessages((current) => [
      ...current,
      { id: messageId(), role: "user", text: text.trim(), url: attachedUrl },
      { id: replyId, role: "assistant", status: "pending" },
    ]);
    setText("");
    setAttachedUrl(null);

    const result = await composeWithAgent(text.trim() || `A widget for ${url}`, url);
    if (threadRef.current !== thread) return;

    let reply: AssistantDone;
    if (result.ok) {
      const doc = result.document;
      reply = {
        id: replyId,
        role: "assistant",
        status: "done",
        source: "agent",
        saved: false,
        toolsUsed: result.toolsUsed,
        widget: {
          id: `w_${Date.now().toString(36)}`,
          name: result.name,
          url: url ?? "",
          description,
          summary: result.summary,
          document: doc,
          dataSource: result.dataSource,
          refreshedAt: result.dataSource ? Date.now() : undefined,
          theme: doc.scheme === "light" ? "light" : "dark",
          createdAt: Date.now(),
        },
      };
    } else if (result.reason === "needs_input") {
      reply = { id: replyId, role: "assistant", status: "done", source: "agent", saved: false, widget: null, text: result.message, toolsUsed: result.toolsUsed };
    } else {
      // Agent unavailable or failed: fall back to the on-device draft, and say why.
      reply = {
        id: replyId,
        role: "assistant",
        status: "done",
        source: "local",
        saved: false,
        widget: url ? localDraft(url, description) : null,
        note:
          result.reason === "unconfigured"
            ? "The widget agent isn't set up on the server, so this is a local draft."
            : `${result.message} This is a local draft instead.`,
      };
    }
    setMessages((current) => current.map((m) => (m.id === replyId ? reply : m)));
  };

  const updateReply = (id: string, update: (m: AssistantDone) => AssistantDone) =>
    setMessages((current) =>
      current.map((m) => (m.id === id && m.role === "assistant" && m.status === "done" ? update(m) : m)),
    );

  const saveWidget = (id: string, widget: SavedWidget) => {
    save(widget);
    updateReply(id, (m) => ({ ...m, saved: true }));
  };

  const toggleTheme = (id: string, widget: SavedWidget, saved: boolean) => {
    const next: SavedWidget = { ...widget, theme: widget.theme === "light" ? "dark" : "light" };
    if (saved) save(next);
    updateReply(id, (m) => ({ ...m, widget: next }));
  };

  const openWidget = (widget: SavedWidget, saved: boolean) => {
    // Unsaved drafts are staged: an agent document does not fit in route params.
    if (!saved) stage(widget);
    router.push({ pathname: "/widget/preview", params: { id: widget.id } });
  };

  const newChat = () => {
    threadRef.current += 1;
    setMessages([]);
    setText("");
    setAttachedUrl(null);
    setDrawerOpen(false);
  };

  const fromDrawer = (go: () => void) => {
    setDrawerOpen(false);
    go();
  };

  const empty = messages.length === 0;

  return (
    <Screen insetTop={spacing.xs} insetBottom={spacing.sm}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.header}>
          <Pressable
            onPress={() => setDrawerOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            style={styles.headerButton}
          >
            <SymbolView
              name={{ ios: "line.3.horizontal", android: "menu", web: "menu" }}
              tintColor={colors.text}
              size={22}
            />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            Widget<Text style={styles.accent}>Composer</Text>
          </Text>
          <Pressable
            onPress={newChat}
            disabled={empty}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="New widget"
            accessibilityState={{ disabled: empty }}
            style={styles.headerButton}
          >
            <SymbolView
              name={{ ios: "square.and.pencil", android: "edit_square", web: "edit_square" }}
              tintColor={empty ? colors.textSubtle : colors.text}
              size={21}
            />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.thread, empty && styles.threadEmpty]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          onLayout={(e) => setContentWidth(e.nativeEvent.layout.width - spacing.lg * 2)}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {empty ? (
            <View style={styles.welcome}>
              <Image
                source={require("@/assets/images/brand/logo-symbol.png")}
                style={styles.welcomeLogo}
                contentFit="contain"
              />
              <Text style={styles.welcomeTitle}>What should we put on your home screen?</Text>
              <Text style={styles.welcomeBody}>Name a website and what you want to see from it.</Text>
            </View>
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <UserMessage key={m.id} text={m.text} url={m.url} />
              ) : m.status === "pending" ? (
                <PendingMessage key={m.id} />
              ) : (
                <AssistantMessage
                  key={m.id}
                  message={m}
                  cardWidth={cardWidth}
                  onSave={() => m.widget && saveWidget(m.id, m.widget)}
                  onToggleTheme={() => m.widget && toggleTheme(m.id, m.widget, m.saved)}
                  onOpen={() => m.widget && openWidget(m.widget, m.saved)}
                />
              ),
            )
          )}
        </ScrollView>

        {empty && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.suggestions}
            style={styles.suggestionsBar}
          >
            {suggestions.map((s) => (
              <Pressable
                key={s.title}
                onPress={() => setText(s.prompt)}
                accessibilityRole="button"
                accessibilityHint="Fills in the message"
                style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
              >
                <Text style={styles.suggestionTitle}>{s.title}</Text>
                <Text style={styles.suggestionBody}>{s.body}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.composer}>
          <Composer
            value={text}
            onChangeText={setText}
            attachedUrl={attachedUrl}
            onAttachUrl={setAttachedUrl}
            onSend={send}
            busy={busy}
          />
        </View>
      </KeyboardAvoidingView>

      <Sidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        widgets={widgets}
        onNewChat={newChat}
        onOpenWidget={(w) => fromDrawer(() => openWidget(w, true))}
        onOpenGitHub={() => fromDrawer(() => router.push("/github"))}
        onOpenProfile={() => fromDrawer(() => router.push("/profile"))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: colors.text,
  },
  accent: {
    color: colors.brand,
  },
  thread: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  threadEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  welcome: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  welcomeLogo: {
    width: 44,
    height: 41,
    marginBottom: spacing.lg,
  },
  welcomeTitle: {
    ...typography.heading,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
    textAlign: "center",
  },
  welcomeBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  suggestionsBar: {
    flexGrow: 0,
  },
  suggestions: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  suggestion: {
    width: 170,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionTitle: {
    ...typography.label,
    color: colors.text,
  },
  suggestionBody: {
    ...typography.meta,
    color: colors.textMuted,
    marginTop: 2,
  },
  composer: {
    paddingHorizontal: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
});
