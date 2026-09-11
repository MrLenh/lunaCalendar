import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import type { CalendarAccount } from "@luna/shared-types";
import * as api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useCalendarDisplay, type CalendarDisplayMode } from "../../context/CalendarDisplayContext";
import { SegmentedControl } from "../../components/SegmentedControl";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { displayMode, setDisplayMode } = useCalendarDisplay();
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.listAccounts();
      setAccounts(result);
    } catch {
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDisconnect = (account: CalendarAccount) => {
    Alert.alert("Ngắt kết nối", `Ngắt kết nối tài khoản ${providerLabel(account.provider)}?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Ngắt kết nối",
        style: "destructive",
        onPress: async () => {
          try {
            await api.disconnectAccount(account.id);
            load();
          } catch (err) {
            Alert.alert("Lỗi", err instanceof Error ? err.message : String(err));
          }
        },
      },
    ]);
  };

  const handleConnect = async (provider: "google" | "lark") => {
    try {
      const redirectUrl = Linking.createURL("/");
      const startUrl = `${api.oauthStartUrl(provider)}?redirect_uri=${encodeURIComponent(redirectUrl)}`;
      await WebBrowser.openAuthSessionAsync(startUrl, redirectUrl);
      load();
    } catch (err) {
      Alert.alert("Không thể kết nối", err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      data={accounts}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={{ gap: 16, marginBottom: 8 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tài khoản</Text>
            <Text style={styles.profileName}>{user?.displayName}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hiển thị lịch</Text>
            <SegmentedControl<CalendarDisplayMode>
              value={displayMode}
              onChange={setDisplayMode}
              options={[
                { label: "Âm lịch", value: "lunar" },
                { label: "Dương lịch", value: "solar" },
                { label: "Cả hai", value: "both" },
              ]}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tài khoản đã kết nối</Text>
            {isLoading && <ActivityIndicator />}
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.accountRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.accountName}>{item.displayName}</Text>
            <Text style={styles.accountMeta}>
              {providerLabel(item.provider)} • {item.providerAccountId}
            </Text>
          </View>
          <Pressable style={styles.disconnectButton} onPress={() => handleDisconnect(item)}>
            <Text style={styles.disconnectButtonText}>Ngắt kết nối</Text>
          </Pressable>
        </View>
      )}
      ListFooterComponent={
        <View style={{ gap: 16, marginTop: 8 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Kết nối thêm tài khoản</Text>
            <Pressable style={[styles.oauthButton, styles.googleButton]} onPress={() => handleConnect("google")}>
              <Text style={styles.oauthButtonText}>Kết nối Google Calendar</Text>
            </Pressable>
            <Pressable style={[styles.oauthButton, styles.larkButton]} onPress={() => handleConnect("lark")}>
              <Text style={styles.oauthButtonText}>Kết nối Lark Calendar</Text>
            </Pressable>
          </View>

          <Pressable style={styles.signOutButton} onPress={() => signOut()}>
            <Text style={styles.signOutButtonText}>Đăng xuất</Text>
          </Pressable>
        </View>
      }
    />
  );
}

function providerLabel(provider: string): string {
  switch (provider) {
    case "google":
      return "Google";
    case "lark":
      return "Lark";
    default:
      return provider;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  card: {
    backgroundColor: "#f4f6f8",
    borderRadius: 10,
    padding: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1c2b39", marginBottom: 10 },
  profileName: { fontSize: 16, fontWeight: "600", color: "#1c2b39" },
  profileEmail: { fontSize: 13, color: "#5c6b77", marginTop: 2 },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f6f8",
    borderRadius: 10,
    padding: 14,
  },
  accountName: { fontSize: 14, fontWeight: "600", color: "#1c2b39" },
  accountMeta: { fontSize: 12, color: "#5c6b77", marginTop: 2 },
  disconnectButton: {
    borderWidth: 1,
    borderColor: "#c0392b",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  disconnectButtonText: { color: "#c0392b", fontSize: 12, fontWeight: "600" },
  oauthButton: { borderRadius: 8, padding: 12, alignItems: "center", marginBottom: 8 },
  googleButton: { backgroundColor: "#dd4b39" },
  larkButton: { backgroundColor: "#2a2a2a" },
  oauthButtonText: { color: "#fff", fontWeight: "600" },
  signOutButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#c0392b",
  },
  signOutButtonText: { color: "#c0392b", fontWeight: "700" },
});
