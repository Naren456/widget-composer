// Tokens verified against the exported design references in
// assets/design-references/splash/ and assets/design-references/onboarding/.
export const colors = {
  background: "#070C09",
  /** Cards and inputs sitting directly on the background. */
  surface: "#151A17",
  /** Panels that overlap other content, e.g. the setup step list. */
  surfaceElevated: "rgba(22, 28, 25, 0.96)",
  text: "#FFFFFF",
  textMuted: "#9AA39C",
  textSubtle: "#7F8882",
  brand: "#A6EF5C",
  brandDeep: "#5BD13A",
  track: "#2A2F2C",
  border: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.16)",
  /** Lime rim-glow used on the logo tile, primary buttons and widget cards. */
  glow: "rgba(110, 230, 60, 0.45)",
  /** Fill behind a selected control. */
  brandWash: "rgba(166, 239, 92, 0.12)",
  danger: "#FF6B6B",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
};

/** The lime CTA gradient used by primary buttons and the progress bar fill. */
export const brandGradient = `linear-gradient(90deg, ${colors.brandDeep}, ${colors.brand})`;

export const typography = {
  /** Page headings on onboarding and in-app screens. */
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.4 },
  /** Section headings inside a screen. */
  heading: { fontSize: 20, lineHeight: 26, fontWeight: "700", letterSpacing: -0.3 },
  /** Card titles and control group labels. */
  label: { fontSize: 14, lineHeight: 19, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  /** Timestamps, counts and other compact metadata. */
  meta: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
} as const;
