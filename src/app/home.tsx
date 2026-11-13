import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Composer, type ReferenceImage } from "@/components/chat/composer";
import { AssistantMessage, GeneratedWidgetMessage, PendingMessage, UserMessage } from "@/components/chat/messages";
import { Sidebar } from "@/components/chat/sidebar";
import { Screen } from "@/components/ui/screen";
import { type ChatMessage, messageId, parseRequest } from "@/features/chat/compose";
import { addToHomeScreen, refreshPlacedWidgets, syncPlacedWidget } from "@/features/home-screen/home-screen-widgets";
import { generateWidget, previewData, saveWidget, saveWidgetVersion, validateWidgetDesign, type WidgetSpec } from "@/services/widget-api";
import { colors, radius, spacing, typography } from "@/theme/tokens";

/** Starter prompts in the ChatGPT pattern. Tapping one fills the composer, it never sends. */
const suggestions = [
  {
    title: "Assigned issues",
    body: "your GitHub issues",
    prompt: "Show my assigned GitHub issues in a compact list",
  },
  {
    title: "Open pull requests",
    body: "across your repositories",
    prompt: "Show my open GitHub pull requests in a compact list",
  },
  {
    title: "Review requests",
    body: "waiting for you",
    prompt: "Show GitHub pull requests waiting for my review",
  },
  {
    title: "Issue count",
    body: "assigned to you",
    prompt: "Show a count of my assigned GitHub issues with a short list of the latest ones",
  },
  {
    title: "Local clock",
    body: "time and date",
    prompt: "Create a clean 24-hour clock widget with the current local time and date",
  },
  {
    title: "Website widget",
    body: "page title and headings",
    prompt: "Turn https://news.ycombinator.com into a compact widget showing the page title and top headings",
  },
  {
    title: "YouTube channel",
    body: "channel title and description",
    prompt: "Create a compact widget for https://www.youtube.com/@YouTube showing the channel title and description with a button to open the channel",
  },
  {
    title: "XDA Developers",
    body: "latest page headlines",
    prompt: "Turn https://www.xda-developers.com/ into a compact widget showing the page title and top article headings",
  },
];

const QUERY_LABELS: Record<string, string> = {
  assigned_issues: "issues assigned to you",
  open_pull_requests: "your open pull requests",
  review_requests: "pull requests waiting for your review",
};

/** Turns backend errors into a useful assistant response. */
function generationError(result: Extract<Awaited<ReturnType<typeof generateWidget>>, { ok: false }>): string {
  if (result.code === "LLM_UNAVAILABLE") return "Widget generation isn't set up on the server yet (no AI key).";
  return [result.message, ...result.details].join("\n");
}

function generatedReply(spec: WidgetSpec, updated: boolean): string {
  const sources = spec.dataSources.map((source) => source.connector === "github"
    ? `${QUERY_LABELS[source.query] ?? source.query} from GitHub`
    : new URL(source.url).hostname,
  );
  const summary = updated ? "Updated the same widget." : `Here's a preview of "${spec.name}".`;
  return `${summary}${sources.length ? ` It uses ${sources.join(" and ")}.` : ""}`;
}

/** Chat-style home: sends prompts to the WidgetComposer API. The thread is session-only state. */
export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [attachedUrl, setAttachedUrl] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<ReferenceImage | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const params = useLocalSearchParams<{ widget?: string; refresh?: string; ts?: string }>();
  const handledRefreshRef = useRef<string | null>(null);

  // Android back closes the drawer before leaving the screen.
  useEffect(() => {
    if (!drawerOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setDrawerOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [drawerOpen]);

  // Placed widgets get fresh data whenever the app is opened or comes back to the foreground.
  useEffect(() => {
    void refreshPlacedWidgets();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshPlacedWidgets();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (params.refresh !== "true" || !params.widget || !params.ts) return;
    const key = `${params.widget}:${params.ts}`;
    if (handledRefreshRef.current === key) return;
    handledRefreshRef.current = key;
    void refreshPlacedWidgets({ widgetId: params.widget, force: true });
  }, [params.refresh, params.ts, params.widget]);

  // Bumped by "New chat" so a reply that lands after the thread was cleared is dropped.
  const threadRef = useRef(0);
  const activeWidgetId = useRef<string | null>(null);
  const busy = messages.some((m) => m.role === "assistant" && m.pending);

  const send = async () => {
    const { url, description } = parseRequest(text, attachedUrl);
    if (busy || (!url && !description && !attachedImage)) return;

    const thread = threadRef.current;
    const replyId = messageId();
    const prompt = [text.trim(), attachedUrl].filter(Boolean).join(" ") || "Create a widget based on the attached reference image.";
    setMessages((current) => [
      ...current,
      { id: messageId(), role: "user", text: text.trim(), url: attachedUrl, imageUri: attachedImage?.uri ?? null },
      { id: replyId, role: "assistant", pending: true },
    ]);
    setText("");
    setAttachedUrl(null);
    setAttachedImage(null);

    const widgetId = activeWidgetId.current;
    const result = await generateWidget(prompt, widgetId ?? undefined, attachedImage
      ? { mediaType: attachedImage.mediaType, base64: attachedImage.base64 }
      : undefined);
    if (!result.ok) {
      if (threadRef.current !== thread) return;
      setMessages((current) => current.map((m) =>
        m.id === replyId ? { id: replyId, role: "assistant", text: generationError(result) } : m,
      ));
      return;
    }

    const { spec, generationRunId } = result.data;
    if (threadRef.current !== thread) return;
    const saved = widgetId
      ? await saveWidgetVersion(widgetId, spec, generationRunId)
      : await saveWidget(spec, generationRunId);
    if (threadRef.current !== thread) return;
    if (!saved.ok) {
      setMessages((current) => current.map((m) =>
        m.id === replyId ? { id: replyId, role: "assistant", text: `I couldn't save this widget update: ${saved.message}` } : m,
      ));
      return;
    }
    const savedWidgetId = widgetId ?? saved.data.id;
    activeWidgetId.current = savedWidgetId;
    const preview = await previewData(spec);
    if (threadRef.current !== thread) return;
    const placed = preview.ok && syncPlacedWidget(savedWidgetId, spec, preview.data.data, preview.data.sample);
    setMessages((current) => current.map((m) =>
      m.id === replyId
        ? {
            id: replyId,
            role: "assistant",
            text: generatedReply(spec, widgetId !== null),
            spec,
            widgetId: savedWidgetId,
            data: preview.ok ? preview.data.data : null,
            sample: preview.ok && preview.data.sample,
            generationRunId,
            ...(placed ? { placement: { kind: "updated" as const } } : {}),
          }
        : placed && m.role === "assistant" && "spec" in m && m.widgetId === savedWidgetId
          ? { ...m, placement: { kind: "updated" as const } }
          : m,
    ));
  };

  const addWidget = async (id: string) => {
    const message = messages.find((item) => item.id === id);
    if (!message || message.role !== "assistant" || !("spec" in message) || !message.spec || message.adding) return;
    if (message.placement && message.placement.kind !== "failed") return;

    setMessages((current) => current.map((item) =>
      item.id === id && item.role === "assistant" && "spec" in item ? { ...item, adding: true } : item,
    ));
    const placement = await addToHomeScreen(message.spec, message.generationRunId, {
      data: message.data ?? null,
      sample: message.sample ?? false,
    }, message.widgetId);
    setMessages((current) => current.map((item) =>
      item.id === id && item.role === "assistant" && "spec" in item ? { ...item, adding: false, placement } : item,
    ));
  };

  const reviewDesign = async (id: string) => {
    const message = messages.find((item) => item.id === id);
    if (!message || message.role !== "assistant" || !("spec" in message) || !message.spec || message.reviewing) return;
    setMessages((current) => current.map((item) => item.id === id && item.role === "assistant" && "spec" in item
      ? { ...item, reviewing: true, designReviewError: undefined }
      : item));
    const result = await validateWidgetDesign(message.spec);
    setMessages((current) => current.map((item) => item.id === id && item.role === "assistant" && "spec" in item
      ? result.ok
        ? { ...item, reviewing: false, designReview: result.data.review, designReviewError: undefined }
        : { ...item, reviewing: false, designReviewError: result.message }
      : item));
  };

  const newChat = () => {
    threadRef.current += 1;
    activeWidgetId.current = null;
    setMessages([]);
    setText("");
    setAttachedUrl(null);
    setAttachedImage(null);
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
            accessibilityLabel="New chat"
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
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {empty ? (
            <View style={styles.welcome}>
              <Image
                source={require("@/assets/images/brand/logo-symbol.png")}
                style={styles.welcomeLogo}
                contentFit="contain"
              />
              <Text style={styles.welcomeTitle}>What should your widget show?</Text>
              <Text style={styles.welcomeBody}>Describe a widget, share a website, or ask for GitHub activity or a local clock.</Text>
            </View>
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <UserMessage key={m.id} text={m.text} url={m.url} imageUri={m.imageUri} />
              ) : m.pending ? (
                <PendingMessage key={m.id} />
              ) : m.spec ? (
                <GeneratedWidgetMessage
                  key={m.id}
                  text={m.text}
                  spec={m.spec}
                  data={m.data ?? null}
                  sample={m.sample ?? false}
                  designReview={m.designReview}
                  reviewing={m.reviewing ?? false}
                  designReviewError={m.designReviewError}
                  placement={m.placement}
                  adding={m.adding ?? false}
                  onAdd={() => void addWidget(m.id)}
                  onReview={() => void reviewDesign(m.id)}
                />
              ) : (
                <AssistantMessage key={m.id} text={m.text} />
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
            attachedImage={attachedImage}
            onAttachImage={setAttachedImage}
            onSend={send}
            busy={busy}
          />
        </View>
      </KeyboardAvoidingView>

      <Sidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNewChat={newChat}
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
