import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";

import { Screen } from "@/components/ui/screen";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export default function GitHubData() {
  return (
    <Screen insetTop={spacing.sm} insetBottom={spacing.sm}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.back}
        >
          <SymbolView
            name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
            tintColor={colors.text}
            size={22}
          />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">GitHub data</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>No sign-in needed</Text>
        <Text style={styles.description}>
          GitHub widgets read public data. Name the GitHub username in your widget prompt and WidgetComposer shows that
          account issues, pull requests, review requests, or contribution streak. Nothing is connected and no GitHub
          password or token is stored.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <SymbolView name={{ ios: "chevron.left.forwardslash.chevron.right", android: "code", web: "code" }} tintColor={colors.brand} size={22} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Example prompts</Text>
            <Text style={styles.cardLine}>“My open pull requests for Naren456”</Text>
            <Text style={styles.cardLine}>“Contribution streak for octocat”</Text>
          </View>
        </View>

        <Text style={styles.privacy}>
          Public GitHub data is read without an account, so very frequent refreshes can hit GitHub rate limits. Widgets
          keep the last good data and retry later.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  back: { position: "absolute", left: spacing.xl },
  headerTitle: { fontSize: 18, fontWeight: "600", color: colors.text },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  title: { ...typography.heading, color: colors.text },
  description: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 22 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardIcon: { width: 42, height: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandWash },
  cardText: { flex: 1 },
  cardTitle: { ...typography.label, color: colors.text },
  cardLine: { ...typography.meta, color: colors.textMuted, marginTop: 6, lineHeight: 18 },
  privacy: { ...typography.meta, color: colors.textSubtle, lineHeight: 18, marginTop: spacing.xl },
});
