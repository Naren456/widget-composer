import { Image } from "expo-image";
import { Platform } from "react-native";

/** Every image the onboarding pages render, so the first swipe never waits on a decode. */
const onboardingImages = [
  require("@/assets/images/backgrounds/background.jpg"),
  require("@/assets/images/brand/logo-symbol.png"),
  require("@/assets/images/illustrations/widgets.png"),
  require("@/assets/images/styles/minimal.jpg"),
  require("@/assets/images/styles/modern.jpg"),
  require("@/assets/images/styles/aesthetic.jpg"),
  require("@/assets/images/styles/bold.jpg"),
  require("@/assets/images/widget-photos/leaves.png"),
  require("@/assets/images/widget-photos/morning.jpg"),
  require("@/assets/images/widget-photos/mountain.jpg"),
];

/** Decodes the onboarding images into memory. Never rejects: a failed image just loads late. */
export async function preloadOnboardingAssets(): Promise<void> {
  await Promise.all(onboardingImages.map((source) => Image.loadAsync(source).catch(() => null)));
}

/**
 * Drops decoded images from memory once onboarding is done. This clears the whole
 * expo-image memory cache; images still on screen reload from the bundle on demand.
 */
export function releaseOnboardingAssets(): void {
  if (Platform.OS === "web") return;
  Image.clearMemoryCache().catch(() => {});
}
