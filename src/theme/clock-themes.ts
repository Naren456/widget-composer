import { type ImageSource } from "expo-image";

/**
 * Colour themes for the in-app clock preview.
 *
 * Owned by the theme layer rather than the renderer so that `widget-themes.ts` and the
 * appearance hook can name a theme without importing a component.
 */

export type ClockTheme = {
  /** Top-left and bottom-right background colors. */
  background: [string, string];
  border: string;
  /** Color of the wave; omit for themes without one. */
  wave?: string;
  photo?: ImageSource;
  /** Tint laid over the photo. */
  photoTint?: string;
  /** Diagonal light streak, used by Graphite. */
  streak?: boolean;
  /** Light themes use dark text. */
  light?: boolean;
};

export const clockThemes = {
  default: { background: ["#0A140C", "#040906"], border: "#6FDB55", wave: "#5BD13A" },
  aurora: { background: ["#0E4A1F", "#04140A"], border: "#37C94F", wave: "#3EDB5A" },
  ocean: { background: ["#0B4247", "#041A1D"], border: "#1FA8A6", wave: "#1FB5B0" },
  royal: { background: ["#202274", "#0A0B2A"], border: "#5A54F0", wave: "#6B5CFF" },
  nightfall: { background: ["#2C1C4E", "#120A22"], border: "#7A55D6", wave: "#8A5CF0" },
  crimson: { background: ["#5E1013", "#1E0507"], border: "#E0322C", wave: "#F0352E" },
  sunset: { background: ["#82400F", "#2A1206"], border: "#F08A2A", wave: "#FF9A2E" },
  blush: { background: ["#FCE6E9", "#F2C6CD"], border: "#F6D5DA", wave: "#EBA0AE", light: true },
  light: { background: ["#F5F7FB", "#DCE3EE"], border: "#E9EDF3", wave: "#B5C6DF", light: true },
  graphite: { background: ["#3C4044", "#15181B"], border: "#A3A8AD", streak: true },
  dusk: {
    background: ["#1B2950", "#0A1022"],
    border: "#3E5FB0",
    photo: require("@/assets/images/widget-photos/mountain.jpg"),
    photoTint: "rgba(20, 40, 110, 0.25)",
  },
  nature: {
    background: ["#F2B49C", "#C98472"],
    border: "#F6D2C2",
    photo: require("@/assets/images/widget-photos/morning.jpg"),
    photoTint: "rgba(255, 150, 120, 0.42)",
  },
} satisfies Record<string, ClockTheme>;

export type ClockThemeName = keyof typeof clockThemes;
