import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radius, spacing, typography } from "@/theme/tokens";
import { hostFromUrl, normalizeUrl } from "@/utils/url";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  /** Website attached with the + button, shown as a chip above the input. */
  attachedUrl: string | null;
  onAttachUrl: (url: string | null) => void;
  attachedImage: ReferenceImage | null;
  onAttachImage: (image: ReferenceImage | null) => void;
  onSend: () => void;
  /** A reply is still being built; sending again waits for it. */
  busy?: boolean;
};

const MAX_LENGTH = 500;
const MAX_IMAGE_BASE64_CHARS = 4_500_000;
export type ReferenceImage = { uri: string; base64: string; mediaType: "image/jpeg" };

/** ChatGPT-style prompt pill: attach a site, type the request, send. */
export function Composer({ value, onChangeText, attachedUrl, onAttachUrl, attachedImage, onAttachImage, onSend, busy = false }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [imagePicking, setImagePicking] = useState(false);

  const linkUrl = normalizeUrl(linkDraft);
  const canSend = !busy && (value.trim().length > 0 || attachedUrl !== null || attachedImage !== null);

  const attach = () => {
    if (!linkUrl) return;
    onAttachUrl(linkUrl);
    setLinkDraft("");
    setLinkOpen(false);
  };

  const attachImage = async () => {
    if (imagePicking || busy) return;
    setImagePicking(true);
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
      });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      const scale = Math.min(1, 1280 / Math.max(asset.width, asset.height));
      const editor = ImageManipulator.manipulate(asset.uri);
      if (scale < 1) editor.resize({ width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) });
      const rendered = await editor.renderAsync();
      const processed = await rendered.saveAsync({
        format: ImageManipulator.SaveFormat.JPEG,
        compress: 0.78,
        base64: true,
      });
      if (!processed.base64 || processed.base64.length > MAX_IMAGE_BASE64_CHARS) {
        Alert.alert("Image too large", "Choose a smaller image for your widget reference.");
        return;
      }
      onAttachImage({ uri: processed.uri, base64: processed.base64, mediaType: "image/jpeg" });
    } catch {
      Alert.alert("Couldn’t attach image", "Try selecting a different image.");
    } finally {
      setImagePicking(false);
    }
  };

  return (
    <View style={[styles.container, focused && styles.containerFocused]}>
      {attachedUrl && (
        <View style={styles.chip}>
          <SymbolView name={{ ios: "link", android: "link", web: "link" }} tintColor={colors.brand} size={14} />
          <Text style={styles.chipText} numberOfLines={1}>
            {hostFromUrl(attachedUrl)}
          </Text>
          <Pressable
            onPress={() => onAttachUrl(null)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Remove website"
          >
            <SymbolView
              name={{ ios: "xmark", android: "close", web: "close" }}
              tintColor={colors.textMuted}
              size={14}
            />
          </Pressable>
        </View>
      )}

      {attachedImage && (
        <View style={styles.imageChip}>
          <Image source={{ uri: attachedImage.uri }} style={styles.imageThumb} contentFit="cover" />
          <Text style={styles.chipText}>Visual reference</Text>
          <Pressable onPress={() => onAttachImage(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove image">
            <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} tintColor={colors.textMuted} size={14} />
          </Pressable>
        </View>
      )}

      {linkOpen && (
        <View style={styles.linkRow}>
          <TextInput
            value={linkDraft}
            onChangeText={setLinkDraft}
            onSubmitEditing={attach}
            autoFocus
            placeholder="Paste a website or GitHub URL"
            placeholderTextColor={colors.textSubtle}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            style={styles.linkInput}
            accessibilityLabel="Website or GitHub URL"
          />
          <Pressable
            onPress={attach}
            disabled={!linkUrl}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Attach website"
            accessibilityState={{ disabled: !linkUrl }}
          >
            <Text style={[styles.linkAction, !linkUrl && styles.linkActionDisabled]}>Add</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.row}>
        <Pressable
          onPress={() => setLinkOpen((v) => !v)}
          hitSlop={6}
          accessibilityRole="button"
            accessibilityLabel={linkOpen ? "Close link field" : "Add a website or GitHub link"}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <SymbolView
            name={
              linkOpen
                ? { ios: "xmark", android: "close", web: "close" }
                : { ios: "plus", android: "add", web: "add" }
            }
            tintColor={colors.text}
            size={20}
          />
        </Pressable>

        <Pressable
          onPress={() => void attachImage()}
          disabled={busy || imagePicking}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Attach a widget design reference image"
          accessibilityState={{ disabled: busy || imagePicking }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, (busy || imagePicking) && styles.disabled]}
        >
          <SymbolView name={{ ios: "photo", android: "image", web: "image" }} tintColor={colors.text} size={19} />
        </Pressable>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline
          // Web textareas default to two rows; Android treats numberOfLines as a fixed height.
          numberOfLines={Platform.OS === "web" ? 1 : undefined}
          maxLength={MAX_LENGTH}
          placeholder="Describe a widget from a website, GitHub, or your local clock…"
          placeholderTextColor={colors.textSubtle}
          style={styles.input}
          accessibilityLabel="Describe your widget"
        />

        <Pressable
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !canSend }}
          style={({ pressed }) => [styles.send, !canSend && styles.sendDisabled, pressed && styles.pressed]}
        >
          <SymbolView
            name={{ ios: "arrow.up", android: "arrow_upward", web: "arrow_upward" }}
            tintColor={canSend ? colors.background : colors.textSubtle}
            size={18}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  containerFocused: {
    borderColor: colors.brandDeep,
    boxShadow: `0 0 18px ${colors.glow}`,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    maxWidth: "100%",
    marginLeft: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandWash,
  },
  chipText: {
    ...typography.meta,
    color: colors.brand,
    flexShrink: 1,
  },
  imageChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.sm,
    marginLeft: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.lg,
    backgroundColor: colors.brandWash,
  },
  imageThumb: { width: 34, height: 34, borderRadius: radius.sm },
  disabled: { opacity: 0.5 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  linkAction: {
    ...typography.label,
    color: colors.brand,
  },
  linkActionDisabled: {
    color: colors.textSubtle,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    maxHeight: 140,
    ...typography.body,
    fontSize: 16,
    color: colors.text,
    paddingHorizontal: spacing.xs,
    paddingTop: 10,
    paddingBottom: 10,
    textAlignVertical: "center",
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  sendDisabled: {
    backgroundColor: colors.track,
  },
  pressed: {
    opacity: 0.8,
  },
});
