import { router } from "expo-router";

import { releaseOnboardingAssets } from "@/features/onboarding/onboarding-assets";
import { markOnboardingSeen } from "@/features/onboarding/onboarding-state";
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen";

export default function Onboarding() {
  const done = () => {
    markOnboardingSeen();
    router.replace("/home");
    releaseOnboardingAssets();
  };

  return <OnboardingScreen onDone={done} />;
}
