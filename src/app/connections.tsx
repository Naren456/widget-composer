import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";

import { Screen } from "@/components/ui/screen";
import { PrimaryButton } from "@/components/ui/primary-button";
import { type ConnectedAccount, connectGitHub, disconnectConnector, listConnectors } from "@/services/widget-api";
import { colors, radius, spacing, typography } from "@/theme/tokens";

function accountStatus(account: ConnectedAccount): string {
  switch (account.status) {
    case "active": return "Connected";
    case "pending": return "Connection pending";
    case "failed": return "Connection failed. Reconnect to try again.";
    case "expired": return "Access expired. Reconnect to continue.";
  }
}

export default function Connections() {
  const params = useLocalSearchParams<{ provider?: string; status?: string }>();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await listConnectors();
    if (result.ok) {
      setAccounts(result.data.connectors);
    } else {
      setNotice(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listConnectors().then((result) => {
      if (cancelled) return;
      if (result.ok) setAccounts(result.data.connectors);
      else setNotice(result.message);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = async () => {
    setWorking(true);
    setNotice(null);
    const result = await connectGitHub();
    if (!result.ok) {
      setNotice(result.message);
      setWorking(false);
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(result.data.authorizeUrl);
      await refresh();
    } catch {
      setNotice("Couldn't open the GitHub authorization page. Try again.");
    }
    setWorking(false);
  };

  const disconnect = async (account: ConnectedAccount) => {
    setWorking(true);
    setNotice(null);
    const result = await disconnectConnector(account.id);
    if (result.ok) {
      setNotice("GitHub disconnected.");
      await refresh();
    } else {
      setNotice(result.message);
    }
    setWorking(false);
  };

  const active = accounts.find((account) => account.status === "active");
  const callbackNotice = params.provider === "github" && params.status
    ? params.status === "connected" ? "GitHub connected." : "GitHub connection did not complete."
    : null;
  const visibleNotice = notice ?? callbackNotice;

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
        <Text style={styles.headerTitle} accessibilityRole="header">Connected services</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Connect GitHub</Text>
        <Text style={styles.description}>
          Let WidgetComposer read your assigned issues, open pull requests, and review requests to keep your widgets up to date.
        </Text>

        <View style={styles.accountCard}>
          <View style={styles.accountIcon}>
            <SymbolView name={{ ios: "chevron.left.forwardslash.chevron.right", android: "code", web: "code" }} tintColor={colors.brand} size={22} />
          </View>
          <View style={styles.accountText}>
            <Text style={styles.accountName}>GitHub</Text>
            <Text style={styles.accountStatus}>
              {loading ? "Checking connection…" : active ? accountStatus(active) : accounts[0] ? accountStatus(accounts[0]) : "Not connected"}
            </Text>
          </View>
        </View>

        {visibleNotice ? (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>{visibleNotice}</Text>
        ) : null}

        {active ? (
          <Pressable
            onPress={() => void disconnect(active)}
            disabled={working}
            accessibilityRole="button"
            accessibilityState={{ disabled: working }}
            style={({ pressed }) => [styles.disconnect, working && styles.disabled, pressed && styles.pressed]}
          >
            <Text style={styles.disconnectText}>{working ? "Please wait…" : "Disconnect GitHub"}</Text>
          </Pressable>
        ) : (
          <PrimaryButton label={working ? "Opening GitHub…" : "Connect GitHub"} onPress={() => void connect()} disabled={working || loading} />
        )}

        <Text style={styles.privacy}>
          WidgetComposer uses GitHub access only to read the activity needed by your widgets. You can disconnect at any time.
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
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountIcon: { width: 42, height: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandWash },
  accountText: { flex: 1 },
  accountName: { ...typography.label, color: colors.text },
  accountStatus: { ...typography.meta, color: colors.textMuted, marginTop: 3 },
  notice: { ...typography.meta, color: colors.brand, marginTop: spacing.md, lineHeight: 18 },
  disconnect: { alignSelf: "flex-start", marginTop: spacing.xl, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong },
  disconnectText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  privacy: { ...typography.meta, color: colors.textSubtle, lineHeight: 18, marginTop: spacing.xl },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
});
