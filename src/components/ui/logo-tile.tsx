import { Image } from "expo-image";
import { StyleSheet } from "react-native";
import Animated, { type CSSAnimationKeyframes } from "react-native-reanimated";

import { colors } from "@/theme/tokens";

const pulse: CSSAnimationKeyframes = {
  from: { boxShadow: `0 0 26px ${colors.glow}` },
  to: { boxShadow: "0 0 46px rgba(110, 230, 60, 0.7)" },
};

export function LogoTile() {
  return (
    <Animated.View
      style={[
        styles.tile,
        {
          animationName: pulse,
          animationDuration: "2.4s",
          animationIterationCount: "infinite",
          animationDirection: "alternate",
          animationTimingFunction: "ease-in-out",
        },
      ]}
    >
      <Image
        source={require("@/assets/images/brand/logo-symbol.png")}
        style={styles.logo}
        contentFit="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundImage: "linear-gradient(160deg, #142116, #040705)",
    borderWidth: 1,
    borderColor: "rgba(150, 255, 120, 0.28)",
    boxShadow: `0 0 26px ${colors.glow}`,
  },
  logo: {
    width: 56,
    height: 52,
  },
});
