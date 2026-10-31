import { Image } from "expo-image";
import { type ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme/tokens";

type Props = {
  children: ReactNode;
  /** Lays the brand background art behind the content. Reserved for brand moments. */
  art?: boolean;
  /** Extra padding added to the safe-area inset. */
  insetTop?: number;
  insetBottom?: number;
  /** Pad for the bottom safe area. Off inside tabs, where the tab bar owns that inset. */
  safeBottom?: boolean;
  style?: ViewStyle;
};

/** Safe-area frame shared by every full-screen route. */
export function Screen({ children, art = false, insetTop = 0, insetBottom = 0, safeBottom = true, style }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + insetTop, paddingBottom: (safeBottom ? insets.bottom : 0) + insetBottom },
        style,
      ]}
    >
      {art && (
        <Image
          source={require("@/assets/images/backgrounds/background.jpg")}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
