import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { syncPlacedWidget } from "@/features/home-screen/home-screen-widgets";
import {
  deleteImageAsset,
  generateImageAsset,
  getImageAsset,
  listImageAssets,
  listWidgets,
  previewData,
  publishWidgetVersion,
  saveWidgetVersion,
  type ImageAsset,
  type SavedWidget,
  type WidgetSpec,
  type WidgetReferenceImage,
} from "@/services/widget-api";
import { colors, radius, spacing, typography } from "@/theme/tokens";

const STYLES = ["minimal", "abstract", "illustration", "gradient", "cyberpunk"] as const;
const RATIOS = ["square", "portrait", "landscape"] as const;
type ImageStyle = (typeof STYLES)[number];
type AspectRatio = (typeof RATIOS)[number];

export default function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<ImageStyle>("abstract");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("square");
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [selected, setSelected] = useState<ImageAsset | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<WidgetReferenceImage | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<SavedWidget[]>([]);
  const [choosingWidget, setChoosingWidget] = useState(false);
  const [applyingWidgetId, setApplyingWidgetId] = useState<string | null>(null);

  const reloadAssets = async () => {
    setLoadingAssets(true);
    const result = await listImageAssets();
    if (result.ok) setAssets(result.data.assets);
    else setError(result.message);
    setLoadingAssets(false);
  };

  useEffect(() => {
    let active = true;
    void listImageAssets().then((result) => {
      if (!active) return;
      if (result.ok) setAssets(result.data.assets);
      else setError(result.message);
      setLoadingAssets(false);
    });
    return () => { active = false; };
  }, []);

  const selectAsset = async (asset: ImageAsset) => {
    setSelected(asset);
    setError(null);
    const result = await getImageAsset(asset.id);
    if (!result.ok) {
      setImageData(null);
      setError(result.message);
      return;
    }
    setImageData(result.data.imageData);
  };

  const generate = async () => {
    if (generating || prompt.trim().length < 5) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    const result = await generateImageAsset({
      prompt: prompt.trim(),
      style,
      aspectRatio,
      ...(referenceImage ? { referenceImage } : {}),
    });
    if (!result.ok) {
      setError(result.message);
      setGenerating(false);
      return;
    }
    setSelected(result.data.asset);
    setImageData(result.data.imageData);
    await reloadAssets();
    setGenerating(false);
  };

  const addReference = async () => {
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: false });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      const scale = Math.min(1, 1280 / Math.max(asset.width, asset.height));
      const editor = ImageManipulator.manipulate(asset.uri);
      if (scale < 1) editor.resize({ width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) });
      const rendered = await editor.renderAsync();
      const processed = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.78, base64: true });
      if (!processed.base64 || processed.base64.length > 4_000_000) {
        setError("That reference image is too large. Choose a smaller image.");
        return;
      }
      setReferenceImage({ mediaType: "image/jpeg", base64: processed.base64 });
      setError(null);
    } catch {
      setError("Couldn’t load that reference image. Try choosing another one.");
    }
  };

  const useSelectedAsReference = () => {
    if (!selected || !imageData) return;
    setReferenceImage({ mediaType: "image/jpeg", base64: imageData });
    setNotice("Selected image will be used as an editing reference.");
  };

  const openWidgetPicker = async () => {
    setChoosingWidget(true);
    setError(null);
    const result = await listWidgets();
    if (!result.ok) {
      setError(result.message);
      setChoosingWidget(false);
      return;
    }
    setWidgets(result.data.widgets.filter((widget) => widget.latestVersion));
  };

  const applyBackground = async (widget: SavedWidget) => {
    const original = widget.latestVersion?.spec;
    if (!original || !selected) return;
    setApplyingWidgetId(widget.id);
    setError(null);
    const spec: WidgetSpec = {
      ...original,
      schemaVersion: 9,
      presentation: { ...original.presentation, backgroundImageAssetId: selected.id },
    };
    const version = await saveWidgetVersion(widget.id, spec);
    if (!version.ok) {
      setError(version.message);
      setApplyingWidgetId(null);
      return;
    }
    const published = await publishWidgetVersion(widget.id, version.data.id);
    if (!published.ok) {
      setError(`The background was saved as a new version, but could not be published: ${published.message}`);
      setApplyingWidgetId(null);
      return;
    }
    const preview = await previewData(spec);
    if (preview.ok) syncPlacedWidget(widget.id, spec, preview.data.data, preview.data.sample);
    setNotice(`Applied the background to “${widget.name}”.`);
    setChoosingWidget(false);
    setApplyingWidgetId(null);
  };

  const removeSelected = async () => {
    if (!selected) return;
    const result = await deleteImageAsset(selected.id);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSelected(null);
    setImageData(null);
    await reloadAssets();
  };

  return (
    <Screen insetTop={spacing.sm} insetBottom={spacing.sm}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}>
          <SymbolView name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }} tintColor={colors.text} size={22} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">Image studio</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Create artwork for your widgets. FLUX.2 Klein keeps text and dynamic data native.</Text>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          multiline
          maxLength={1_000}
          placeholder="Describe a background or illustration…"
          placeholderTextColor={colors.textSubtle}
          style={styles.prompt}
          accessibilityLabel="Image description"
        />
        <Text style={styles.label}>Style</Text>
        <View style={styles.chips}>
          {STYLES.map((item) => <Choice key={item} label={item} selected={style === item} onPress={() => setStyle(item)} />)}
        </View>
        <Text style={styles.label}>Aspect ratio</Text>
        <View style={styles.chips}>
          {RATIOS.map((item) => <Choice key={item} label={item} selected={aspectRatio === item} onPress={() => setAspectRatio(item)} />)}
        </View>
        {referenceImage ? (
          <Pressable onPress={() => setReferenceImage(null)} style={styles.reference}>
            <Text style={styles.meta}>Editing reference attached · tap to remove</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => void addReference()} style={styles.reference}>
            <SymbolView name={{ ios: "photo", android: "image", web: "image" }} tintColor={colors.brand} size={18} />
            <Text style={styles.meta}>Add reference image for editing</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => void generate()}
          disabled={generating || prompt.trim().length < 5}
          accessibilityRole="button"
          accessibilityState={{ disabled: generating || prompt.trim().length < 5 }}
          style={({ pressed }) => [styles.generateButton, (generating || prompt.trim().length < 5) && styles.disabled, pressed && styles.pressed]}
        >
          {generating ? <ActivityIndicator color={colors.background} /> : <Text style={styles.generateText}>{selected ? "Regenerate image" : "Generate image"}</Text>}
        </Pressable>
        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        {selected && (
          <View style={styles.previewCard}>
            {imageData ? (
              <Image source={{ uri: `data:${selected.mediaType};base64,${imageData}` }} style={[styles.previewImage, { aspectRatio: selected.width && selected.height ? selected.width / selected.height : 1 }]} contentFit="cover" accessibilityLabel="Generated widget artwork" />
            ) : <View style={[styles.previewImage, styles.imageLoading]}><ActivityIndicator color={colors.brand} /></View>}
            <Text style={styles.assetPrompt} numberOfLines={3}>{selected.prompt}</Text>
            <View style={styles.actions}>
              <Pressable onPress={useSelectedAsReference} style={styles.secondaryButton}><Text style={styles.secondaryText}>Use as reference</Text></Pressable>
              <Pressable onPress={() => void openWidgetPicker()} style={styles.primaryButton}><Text style={styles.primaryText}>Apply to widget</Text></Pressable>
            </View>
            <Pressable onPress={() => void removeSelected()} style={styles.deleteButton}><Text style={styles.deleteText}>Delete image</Text></Pressable>
          </View>
        )}

        {choosingWidget && (
          <View style={styles.widgetPicker}>
            <View style={styles.pickerHeader}>
              <Text style={styles.label}>Choose a widget</Text>
              <Pressable onPress={() => setChoosingWidget(false)} accessibilityRole="button" accessibilityLabel="Close widget picker">
                <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} tintColor={colors.textMuted} size={18} />
              </Pressable>
            </View>
            {widgets.length === 0 ? <Text style={styles.meta}>No saved widgets are available yet.</Text> : widgets.map((widget) => (
              <Pressable key={widget.id} disabled={applyingWidgetId !== null} onPress={() => void applyBackground(widget)} style={styles.widgetRow}>
                <Text style={styles.widgetName}>{widget.name}</Text>
                {applyingWidgetId === widget.id ? <ActivityIndicator color={colors.brand} /> : <Text style={styles.meta}>Apply</Text>}
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.galleryHeader}>
          <Text style={styles.label}>Saved assets</Text>
          {loadingAssets && <ActivityIndicator color={colors.brand} size="small" />}
        </View>
        {assets.length === 0 && !loadingAssets ? <Text style={styles.meta}>Generated images are saved here for reuse.</Text> : assets.map((asset) => (
          <Pressable key={asset.id} onPress={() => void selectAsset(asset)} style={[styles.assetRow, selected?.id === asset.id && styles.assetSelected]}>
            <View style={styles.assetThumbnail}><SymbolView name={{ ios: "photo", android: "image", web: "image" }} tintColor={colors.brand} size={20} /></View>
            <View style={styles.assetText}>
              <Text style={styles.widgetName} numberOfLines={2}>{asset.prompt || "Widget image"}</Text>
              <Text style={styles.meta}>{asset.style} · {asset.width ?? "?"} × {asset.height ?? "?"}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.choice, selected && styles.choiceSelected]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  back: { position: "absolute", left: spacing.xl },
  title: { ...typography.heading, color: colors.text },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md },
  intro: { ...typography.body, color: colors.textMuted, lineHeight: 21 },
  prompt: { minHeight: 88, maxHeight: 150, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.md, color: colors.text, textAlignVertical: "top" },
  label: { ...typography.label, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.surface },
  choiceSelected: { borderColor: colors.brand, backgroundColor: colors.brandWash },
  choiceText: { ...typography.meta, color: colors.textMuted, textTransform: "capitalize" },
  choiceTextSelected: { color: colors.brand },
  reference: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", paddingVertical: spacing.xs },
  meta: { ...typography.meta, color: colors.textMuted },
  generateButton: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  generateText: { ...typography.label, color: colors.background },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78 },
  error: { ...typography.body, color: colors.danger },
  notice: { ...typography.body, color: colors.brand },
  previewCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.md, overflow: "hidden" },
  previewImage: { width: "100%", aspectRatio: 1, borderRadius: radius.md },
  imageLoading: { alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  assetPrompt: { ...typography.body, color: colors.text },
  actions: { flexDirection: "row", gap: spacing.sm },
  secondaryButton: { minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.md, flex: 1 },
  secondaryText: { ...typography.meta, color: colors.text },
  primaryButton: { minHeight: 42, borderRadius: radius.md, backgroundColor: colors.brand, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.md, flex: 1 },
  primaryText: { ...typography.meta, color: colors.background },
  deleteButton: { alignSelf: "flex-end", padding: spacing.xs },
  deleteText: { ...typography.meta, color: colors.danger },
  widgetPicker: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  pickerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  widgetRow: { minHeight: 42, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  widgetName: { ...typography.body, color: colors.text, flex: 1 },
  galleryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  assetRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  assetSelected: { borderColor: colors.brand },
  assetThumbnail: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  assetText: { flex: 1, gap: 2 },
});
