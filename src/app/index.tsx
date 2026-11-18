import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";

import { LoadingScreen } from "@/components/ui/loading-screen";
import { preloadLoadingAssets, preloadOnboardingAssets } from "@/features/onboarding/onboarding-assets";
import { hasSeenOnboarding } from "@/features/onboarding/onboarding-state";

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
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const firstLaunch = !hasSeenOnboarding();

    async function prepare() {
      // 1. Preload loading screen assets before hiding native splash screen
      await preloadLoadingAssets();
      if (cancelled) return;

      // 2. Hide native splash screen now that LoadingScreen assets are preloaded
      setAppReady(true);
      await SplashScreen.hideAsync().catch(() => {});

      // 3. Continue preloading remaining onboarding assets & waiting minimum splash duration
      const ready = firstLaunch
        ? Promise.race([
            Promise.all([preloadOnboardingAssets(), wait(FIRST_LAUNCH_MIN_MS)]),
            wait(FIRST_LAUNCH_MAX_MS),
          ])
        : wait(SPLASH_MS);

      await ready;
      if (!cancelled) {
        router.replace(firstLaunch ? "/onboarding" : "/home");
      }
    }

    void prepare();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!appReady) {
    return null;
  }

  return (
    <LoadingScreen
      title="Getting things ready…"
      note={"Describe a widget and WidgetComposer\nwill compose it for you."}
    />
  );
}
