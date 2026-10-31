import { Image } from "expo-image";
import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CreatePage,
  CustomizePage,
  DescribePage,
  HomeScreenPage,
  WelcomePage,
  type PageProps,
} from "@/features/onboarding/pages";
import { PrimaryButton } from "@/components/ui/primary-button";
import { colors } from "@/theme/tokens";

const PAGE_PADDING = 24;

const pages: { key: string; Page: ComponentType<PageProps>; button: string; primary?: boolean }[] = [
  { key: "welcome", Page: WelcomePage, button: "Get Started", primary: true },
  { key: "create", Page: CreatePage, button: "Next" },
  { key: "describe", Page: DescribePage, button: "Next" },
  { key: "customize", Page: CustomizePage, button: "Next" },
  { key: "home-screen", Page: HomeScreenPage, button: "Let's Create", primary: true },
];

type Props = {
  onDone: () => void;
};

export function OnboardingScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);
  // Measured rather than read from the window so server-rendered web output hydrates cleanly.
  const [{ width, height: pageHeight }, setPageSize] = useState({ width: 0, height: 0 });
  const current = pages[index];
  const isLast = index === pages.length - 1;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };

  const next = () => {
    if (isLast) {
      onDone();
      return;
    }
    goTo(index + 1);
  };

  // Android back steps to the previous page instead of leaving the app mid-onboarding.
  useEffect(() => {
    if (index === 0) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      scrollRef.current?.scrollTo({ x: (index - 1) * width, animated: true });
      setIndex(index - 1);
      return true;
    });
    return () => sub.remove();
  }, [index, width]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 20 }]}>
      <Image
        source={require("@/assets/images/backgrounds/background.jpg")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />

      <View style={styles.topBar}>
        {!isLast && (
          <Pressable onPress={onDone} hitSlop={12} accessibilityRole="button">
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.pager} onLayout={(e) => setPageSize(e.nativeEvent.layout)}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
        >
          {width > 0 &&
            pages.map(({ key, Page }) => (
              <View key={key} style={[styles.page, { width, height: pageHeight }]}>
                <Page width={width - PAGE_PADDING * 2} />
              </View>
            ))}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {pages.map(({ key }, i) => (
            <Animated.View
              key={key}
              style={[
                styles.dot,
                i === index && styles.dotActive,
                { transitionProperty: ["width", "backgroundColor"], transitionDuration: 250 },
              ]}
            />
          ))}
        </View>
        <PrimaryButton
          label={current.button}
          onPress={next}
          variant={current.primary ? "primary" : "secondary"}
          icon={{ ios: "arrow.right", android: "arrow_forward", web: "arrow_forward" }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    height: 40,
    paddingHorizontal: PAGE_PADDING,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  skip: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "500",
  },
  pager: {
    flex: 1,
  },
  page: {
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 16,
  },
  footer: {
    paddingHorizontal: PAGE_PADDING,
    gap: 20,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.track,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.brand,
  },
});
