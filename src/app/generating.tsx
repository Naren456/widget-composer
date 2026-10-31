import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { BackHandler } from "react-native";

import { CreatingWidgetScreen } from "@/features/widgets/creating-widget-screen";

/**
 * Composition happens on-device and is effectively instant, so this is a brief
 * designed transition rather than a report of backend progress. The bar sweeps
 * instead of claiming a percentage, and the copy does not name steps that never ran.
 */
const TRANSITION_MS = 900;

export default function Generating() {
  const { url, description, theme } = useLocalSearchParams<{
    url: string;
    description: string;
    theme: string;
  }>();

  const cancel = () => router.back();

  useEffect(() => {
    const id = setTimeout(() => {
      router.replace({ pathname: "/widget/preview", params: { url, description, theme } });
    }, TRANSITION_MS);
    return () => clearTimeout(id);
  }, [url, description, theme]);

  // Android back abandons the composition rather than leaving a stranded screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.back();
      return true;
    });
    return () => sub.remove();
  }, []);

  return (
    <CreatingWidgetScreen
      title="Creating your widget…"
      note={"Composing from your description\nand the style you picked."}
      onCancel={cancel}
    />
  );
}
