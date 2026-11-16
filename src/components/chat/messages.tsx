import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { SymbolView } from "expo-symbols";
import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "@/theme/tokens";
import { hostFromUrl } from "@/utils/url";
import { SpecPreview } from "@/components/widget-preview/spec-preview";
import type { DesignReview, WidgetDataMap, WidgetSpec } from "@/services/widget-api";
import type { PlaceOutcome } from "@/features/home-screen/home-screen-widgets";

export const UserMessage = memo(function UserMessage({ text, url, imageUri }: { text: string; url: string | null; imageUri?: string | null }) {
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
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.userReferenceImage} contentFit="cover" accessibilityLabel="Widget design reference" /> : null}
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

const URL_PATTERN = /(https?:\/\/[^\s)]+)/g;

/** Assistant text with tappable links. */
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

/** Shown while the request is genuinely in flight. */
export function PendingMessage() {
  return (
    <View style={styles.assistantRow} accessibilityLiveRegion="polite">
      <AssistantAvatar />
      <View style={[styles.assistantBody, styles.pending]}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.pendingText}>Sending…</Text>
      </View>
    </View>
  );
}

export const AssistantMessage = memo(function AssistantMessage({ text }: { text: string }) {
  return (
    <View style={styles.assistantRow}>
      <AssistantAvatar />
      <View style={styles.assistantBody}>
        <LinkedText text={text} />
      </View>
    </View>
  );
});

function placementText(placement: PlaceOutcome): string {
  switch (placement.kind) {
    case "prompted": return "Confirm the launcher prompt to place it on your home screen.";
    case "manual": return "Saved. Long-press your home screen, open Widgets, then add WidgetComposer.";
    case "updated": return "Updated on your home screen.";
    case "unsupported": return "Saved to your account. Home-screen placement is available in the Android app.";
    case "failed": return `Couldn't save this widget: ${placement.message}`;
  }
}

export function GeneratedWidgetMessage({
  text,
  spec,
  data,
  dataError,
  sample,
  placement,
  adding,
  designReview,
  reviewing,
  designReviewError,
  onAdd,
  onReview,
}: {
  text: string;
  spec: WidgetSpec;
  data: WidgetDataMap | null;
  dataError?: string;
  sample: boolean;
  placement?: PlaceOutcome;
  adding: boolean;
  designReview?: DesignReview;
  reviewing: boolean;
  designReviewError?: string;
  onAdd: () => void;
  onReview: () => void;
}) {
  const canRetry = placement?.kind === "failed";
  return (
    <View style={styles.assistantRow}>
      <AssistantAvatar />
      <View style={styles.generatedBody}>
        <Text style={styles.assistantText}>{text}</Text>
        <SpecPreview spec={spec} data={data} sample={sample} />
        {dataError ? <Text style={styles.dataError}>Live data could not be loaded: {dataError}</Text> : null}
        {designReview ? (
          <View style={styles.reviewCard}>
            <Text style={styles.reviewScore}>Design review · {designReview.score}/100</Text>
            <Text style={styles.reviewText}>{designReview.summary}</Text>
            {designReview.improvements.map((item, index) => <Text key={`i-${index}`} style={styles.reviewText}>• {item}</Text>)}
            {designReview.improvements.length === 0 && designReview.strengths.slice(0, 2).map((item, index) => <Text key={`s-${index}`} style={styles.reviewText}>• {item}</Text>)}
          </View>
        ) : null}
        {designReviewError ? <Text style={styles.reviewError}>{designReviewError}</Text> : null}
        <Pressable
          onPress={onReview}
          disabled={reviewing}
          accessibilityRole="button"
          accessibilityState={{ disabled: reviewing }}
          style={({ pressed }) => [styles.reviewButton, pressed && !reviewing && styles.addButtonPressed]}
        >
          {reviewing ? <ActivityIndicator size="small" color={colors.brand} /> : null}
          <Text style={styles.reviewButtonText}>{reviewing ? "Reviewing design…" : designReview ? "Review again" : "Validate design"}</Text>
        </Pressable>
        {placement ? (
          <Text style={[styles.placementText, placement.kind === "failed" && styles.placementError]}>
            {placementText(placement)}
          </Text>
        ) : null}
        {!placement || canRetry ? (
          <Pressable
            onPress={onAdd}
            disabled={adding}
            accessibilityRole="button"
            accessibilityState={{ disabled: adding }}
            style={({ pressed }) => [styles.addButton, adding && styles.addButtonDisabled, pressed && !adding && styles.addButtonPressed]}
          >
            <Text style={styles.addButtonText}>{adding ? "Saving…" : canRetry ? "Try again" : "Add to home screen"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

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
  userReferenceImage: { width: 180, height: 128, borderRadius: radius.md, marginTop: spacing.xs },
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
  generatedBody: {
    flex: 1,
    gap: spacing.md,
    paddingTop: 4,
  },
  assistantText: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
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
  link: {
    color: colors.brand,
    textDecorationLine: "underline",
  },
  addButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  addButtonDisabled: { opacity: 0.55 },
  addButtonPressed: { opacity: 0.8 },
  addButtonText: { color: colors.background, fontSize: 14, fontWeight: "700" },
  placementText: { ...typography.meta, color: colors.textMuted, lineHeight: 18 },
  placementError: { color: "#FF9A8F" },
  reviewCard: { gap: 5, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  reviewScore: { ...typography.meta, color: colors.brand, fontWeight: "700" },
  reviewText: { ...typography.meta, color: colors.textMuted, lineHeight: 18 },
  reviewError: { ...typography.meta, color: "#FF9A8F" },
  dataError: { ...typography.meta, color: "#FF9A8F", lineHeight: 18 },
  reviewButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  reviewButtonText: { ...typography.meta, color: colors.brand, fontWeight: "700" },
});
