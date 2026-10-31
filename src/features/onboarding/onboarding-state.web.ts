/** Web variant: expo-file-system is native-only, so the flag lives in localStorage. */
const KEY = "onboarding-complete";

export function hasSeenOnboarding(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingSeen(): void {
  try {
    globalThis.localStorage?.setItem(KEY, "1");
  } catch {
    // Storage blocked: onboarding shows again next visit.
  }
}
