import { File, Paths } from "expo-file-system";

/**
 * Remembers on-device that onboarding has been seen, so it only runs on first launch.
 * A marker file in the documents directory survives restarts and is removed with the app.
 */
const marker = () => new File(Paths.document, "onboarding-complete");

export function hasSeenOnboarding(): boolean {
  try {
    return marker().exists;
  } catch {
    return false;
  }
}

export function markOnboardingSeen(): void {
  try {
    const file = marker();
    if (!file.exists) file.create();
  } catch (error) {
    // Failing only means onboarding shows again next launch.
    if (__DEV__) console.warn("[onboarding] could not save completion", error);
  }
}
