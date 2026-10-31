import { memo, useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";

import { relativeTime } from "@/utils/time";
import { type SavedWidget } from "@/types/widget";
import { WidgetDocumentView } from "@/widget-engine/player";
import { documentFor } from "@/widget-engine/templates";

type Props = {
  widget: SavedWidget;
  width: number;
  onPress: () => void;
};

/**
 * A saved widget, drawn by the widget render engine from the same document that is
 * pushed to the Android home screen — so the preview is what gets placed.
 */
export const WidgetCard = memo(function WidgetCard({ widget, width, onPress }: Props) {
  const doc = useMemo(() => documentFor(widget), [widget]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${widget.name} widget, created ${relativeTime(widget.createdAt)}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* Keyed on the document so a theme change restarts its state cleanly. */}
      <WidgetDocumentView key={`${widget.id}:${widget.theme}`} doc={doc} width={width} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    alignSelf: "flex-start",
    borderRadius: 20,
    boxShadow: "0 6px 24px rgba(0, 0, 0, 0.35)",
  },
  pressed: {
    opacity: 0.85,
  },
});
