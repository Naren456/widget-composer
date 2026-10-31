import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";

import { type Modifiers, type WidgetDocument, type WidgetNode } from "@/widget-engine/document";
import {
  applyAction,
  pickIndex,
  renderTemplate,
  resolveColor,
  resolveScheme,
  type ResolvedScheme,
} from "@/widget-engine/semantics";

/**
 * In-app player for WidgetComposer Documents: renders the same document the Android
 * home screen plays, so previews show what will actually be placed.
 *
 * Layout follows Compose defaults rather than React Native's — children wrap and
 * start-align instead of stretching — so both players agree. Sizes are authored in dp
 * for a 4×2-cell widget and scaled to the requested width.
 */

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** Design size of a 4×2 Android widget, in dp. */
export const WIDGET_DESIGN = { width: 300, height: 150 };

type Props = {
  doc: WidgetDocument;
  width: number;
  /** Scheme of the surface the widget sits on; resolves `scheme: "system"` documents. */
  surface?: ResolvedScheme;
};

export function WidgetDocumentView({ doc, width, surface = "dark" }: Props) {
  const [state, setState] = useState(doc.state);
  const u = width / WIDGET_DESIGN.width;
  const scheme = resolveScheme(doc, surface);
  // Evaluated once per render, like the widget runtime evaluates player variables.
  const now = useMemo(() => new Date(), []);

  const color = (ref: string | undefined) => resolveColor(doc, ref, scheme);

  const modStyle = (m: Modifiers | undefined): ViewStyle => {
    if (!m) return {};
    const style: Mutable<ViewStyle> = {};
    if (m.width === "fill") style.alignSelf = "stretch";
    else if (typeof m.width === "number") style.width = m.width * u;
    if (m.height === "fill") style.flexGrow = 1;
    else if (typeof m.height === "number") style.height = m.height * u;
    if (m.bg) style.backgroundColor = color(m.bg);
    if (typeof m.radius === "number") {
      style.borderRadius = m.radius * u;
      style.overflow = "hidden";
    }
    if (typeof m.pad === "number") style.padding = m.pad * u;
    else if (m.pad) {
      style.paddingLeft = m.pad[0] * u;
      style.paddingTop = m.pad[1] * u;
      style.paddingRight = m.pad[2] * u;
      style.paddingBottom = m.pad[3] * u;
    }
    return style;
  };

  const justify = (arrange: string | undefined): ViewStyle["justifyContent"] => {
    switch (arrange) {
      case "center":
        return "center";
      case "end":
        return "flex-end";
      case "spaceBetween":
        return "space-between";
      case "spaceAround":
        return "space-around";
      case "spaceEvenly":
        return "space-evenly";
      default:
        return "flex-start";
    }
  };
  const align = (a: string | undefined): ViewStyle["alignItems"] =>
    a === "center" ? "center" : a === "end" ? "flex-end" : "flex-start";

  const render = (node: WidgetNode, key: string): React.ReactNode => {
    switch (node.type) {
      case "column":
      case "row": {
        const style: ViewStyle = {
          flexDirection: node.type === "row" ? "row" : "column",
          justifyContent: justify(node.arrange),
          alignItems: align(node.align),
          // A gap only applies without an explicit arrangement, as in the Compose player.
          gap: node.arrange ? undefined : (node.gap ?? 0) * u,
          ...modStyle(node.mod),
        };
        return (
          <View key={key} style={style}>
            {node.children.map((child, i) => render(child, `${key}.${i}`))}
          </View>
        );
      }
      case "box": {
        const center = node.align === "center";
        const end = node.align === "bottomEnd";
        return (
          <View
            key={key}
            style={{
              alignItems: center ? "center" : end ? "flex-end" : "flex-start",
              justifyContent: center ? "center" : end ? "flex-end" : "flex-start",
              ...modStyle(node.mod),
            }}
          >
            {node.children.map((child, i) => render(child, `${key}.${i}`))}
          </View>
        );
      }
      case "text": {
        const style: TextStyle = {
          color: color(node.color) ?? "#FFFFFF",
          fontSize: (node.size ?? 14) * u,
          lineHeight: (node.size ?? 14) * 1.3 * u,
          fontWeight: node.weight ?? "400",
          textAlign: node.align === "end" ? "right" : node.align === "center" ? "center" : "left",
          flexShrink: 1,
        };
        return (
          <Text key={key} numberOfLines={node.lines} style={[style, modStyle(node.mod) as TextStyle]}>
            {renderTemplate(doc, node.text, state, now)}
          </Text>
        );
      }
      case "spacer":
        return <View key={key} style={modStyle(node.mod)} />;
      case "button":
        return (
          <Pressable
            key={key}
            onPress={() => setState((s) => applyAction(s, node.action))}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              { paddingHorizontal: 14 * u, paddingVertical: 6 * u, borderRadius: 999 },
              modStyle(node.mod),
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.buttonText, { fontSize: 12 * u }]}>{renderTemplate(doc, node.label, state, now)}</Text>
          </Pressable>
        );
      case "pick": {
        const i = pickIndex(state, node.key, node.children.length);
        return i < 0 ? null : render(node.children[i], `${key}.p${i}`);
      }
      default:
        // Unknown node types are skipped, matching the home-screen player.
        return null;
    }
  };

  return (
    // The frame is preview chrome, not part of the document: on a home screen the
    // wallpaper gives the widget its edge, in-app the dark background would hide it.
    <View
      style={[
        styles.frame,
        { width, height: width * (WIDGET_DESIGN.height / WIDGET_DESIGN.width), borderRadius: 20 * u },
      ]}
    >
      {render(doc.root, "r")}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
  },
  button: {
    backgroundColor: "#5BD13A",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#070C09",
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.8,
  },
});
