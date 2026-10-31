import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { WidgetStoreProvider } from "@/features/widgets/widget-store";
import { colors } from "@/theme/tokens";

export default function RootLayout() {
  return (
    <WidgetStoreProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ animation: "none" }} />
        <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
        <Stack.Screen name="home" options={{ animation: "fade" }} />
        <Stack.Screen name="generating" options={{ animation: "fade", gestureEnabled: false }} />
      </Stack>
    </WidgetStoreProvider>
  );
}
