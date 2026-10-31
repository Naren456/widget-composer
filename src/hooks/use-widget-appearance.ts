import { useState } from "react";

import { type ClockThemeName } from "@/theme/clock-themes";
import { defaultAppearance, type WidgetAppearance } from "@/types/widget";
import {
  type ColorOption,
  colorOptions,
  resolveTheme,
  type SizeOption,
  sizeOptions,
  type StyleOption,
  styleOptions,
} from "@/theme/widget-themes";

export type { WidgetAppearance };

export type WidgetAppearanceState = WidgetAppearance & {
  style: StyleOption;
  color: ColorOption;
  size: SizeOption;
  /** Renderer theme for the current style + colour pair. */
  theme: ClockThemeName;
  /** Styles other than Minimal pin their own look, so the colour row is inert. */
  colorsEnabled: boolean;
  setStyleId: (id: string) => void;
  setColorId: (id: string) => void;
  setSizeId: (id: string) => void;
  appearance: WidgetAppearance;
};

/** Selection state for the style / colour / size pickers, shared by Create and Customize. */
export function useWidgetAppearance(initial: WidgetAppearance = defaultAppearance): WidgetAppearanceState {
  const [styleId, setStyleId] = useState(initial.styleId);
  const [colorId, setColorId] = useState(initial.colorId);
  const [sizeId, setSizeId] = useState(initial.sizeId);

  const style = styleOptions.find((o) => o.id === styleId) ?? styleOptions[0];
  const color = colorOptions.find((o) => o.id === colorId) ?? colorOptions[0];
  const size = sizeOptions.find((o) => o.id === sizeId) ?? sizeOptions[1];

  return {
    styleId,
    colorId,
    sizeId,
    style,
    color,
    size,
    theme: resolveTheme(style, color),
    colorsEnabled: !style.theme,
    setStyleId,
    setColorId,
    setSizeId,
    appearance: { styleId, colorId, sizeId },
  };
}
