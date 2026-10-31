import { router } from "expo-router";
import { useEffect } from "react";

import { preloadOnboardingAssets } from "@/features/onboarding/onboarding-assets";
import { hasSeenOnboarding } from "@/features/onboarding/onboarding-state";
import { CreatingWidgetScreen } from "@/features/widgets/creating-widget-screen";

/** Returning users only see the brand moment. */
const SPLASH_MS = 1600;
/** First launch holds a little longer while onboarding images decode... */
const FIRST_LAUNCH_MIN_MS = 2500;
/** ...but never longer than this, so a slow decode cannot strand the user here. */
const FIRST_LAUNCH_MAX_MS = 6000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Brand splash. On first launch it preloads the onboarding images before showing
 * onboarding; after that, onboarding and its images are skipped entirely. The bar
 * sweeps rather than reporting a percentage it cannot know.
 */
export default function Index() {
  useEffect(() => {
    let cancelled = false;
    const firstLaunch = !hasSeenOnboarding();

    const ready = firstLaunch
      ? Promise.race([
          Promise.all([preloadOnboardingAssets(), wait(FIRST_LAUNCH_MIN_MS)]),
          wait(FIRST_LAUNCH_MAX_MS),
        ])
      : wait(SPLASH_MS);

    ready.then(() => {
      if (!cancelled) router.replace(firstLaunch ? "/onboarding" : "/home");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CreatingWidgetScreen
      title="Getting things ready…"
      note={"Describe a widget and WidgetComposer\nwill compose it for you."}
    />
  );
}
