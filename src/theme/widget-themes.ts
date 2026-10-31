import { type ImageSource } from "expo-image";

import { type ClockThemeName } from "@/theme/clock-themes";

/**
 * The style, colour and size options shown in the verified design reference
 * (assets/design-references/onboarding/screens/onboarding-04-customize-your-style.png).
 * Shared by onboarding, Create and Customize so the three stay in step.
 */

export type StyleOption = {
  id: string;
  label: string;
  image: ImageSource;
  /** Styles other than Minimal pin a fixed look; Minimal takes the chosen colour theme. */
  theme?: ClockThemeName;
};

export const styleOptions: StyleOption[] = [
  { id: "minimal", label: "Minimal", image: require("@/assets/images/styles/minimal.jpg") },
  { id: "modern", label: "Modern", image: require("@/assets/images/styles/modern.jpg"), theme: "dusk" },
  {
    id: "aesthetic",
    label: "Aesthetic",
    image: require("@/assets/images/styles/aesthetic.jpg"),
    theme: "nature",
  },
  { id: "bold", label: "Bold", image: require("@/assets/images/styles/bold.jpg"), theme: "graphite" },
];

export type ColorOption = {
  id: string;
  label: string;
  dot: string;
  theme: ClockThemeName;
};

export const colorOptions: ColorOption[] = [
  { id: "green", label: "Green", dot: "#5BD13A", theme: "default" },
  { id: "teal", label: "Teal", dot: "#1FB5B0", theme: "ocean" },
  { id: "indigo", label: "Indigo", dot: "#5A54F0", theme: "royal" },
  { id: "purple", label: "Purple", dot: "#8A5CF0", theme: "nightfall" },
  { id: "red", label: "Red", dot: "#E0322C", theme: "crimson" },
  { id: "orange", label: "Orange", dot: "#FF9A2E", theme: "sunset" },
  { id: "pink", label: "Pink", dot: "#F2A7B4", theme: "blush" },
  { id: "light", label: "Light", dot: "#E3E9F2", theme: "light" },
];

export type SizeOption = {
  id: string;
  label: string;
  /**
   * Scales the preview only. The renderer keeps one aspect ratio, so these do not
   * yet map to Android launcher cell spans — that needs the native widget provider.
   */
  previewScale: number;
};

export const sizeOptions: SizeOption[] = [
  { id: "small", label: "Small", previewScale: 0.78 },
  { id: "medium", label: "Medium", previewScale: 0.9 },
  { id: "large", label: "Large", previewScale: 1 },
];

/** Resolves the renderer theme for a style + colour pair. */
export function resolveTheme(style: StyleOption, color: ColorOption): ClockThemeName {
  return style.theme ?? color.theme;
}
