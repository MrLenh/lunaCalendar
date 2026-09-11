import { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import type { Contact } from "@luna/shared-types";
import * as api from "../../lib/api";

export default function FriendsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const result = await api.listContacts();
      setContacts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  return (
    <View style={styles.container}>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Chưa có bạn bè nào. Kết nối Google/Lark ở mục Cài đặt để đồng bộ danh bạ.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.displayName}</Text>
            {item.email && <Text style={styles.email}>{item.email}</Text>}
            <Text style={styles.provider}>{providerLabel(item.provider)}</Text>
          </View>
        )}
      />
    </View>
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
  errorText: { color: "#c0392b", textAlign: "center", marginTop: 12 },
  emptyText: { textAlign: "center", color: "#8a8f98", marginTop: 24, paddingHorizontal: 24 },
  card: { backgroundColor: "#f4f6f8", borderRadius: 10, padding: 14 },
  name: { fontSize: 15, fontWeight: "600", color: "#1c2b39" },
  email: { fontSize: 13, color: "#5c6b77", marginTop: 2 },
  provider: { fontSize: 11, color: "#2f6690", marginTop: 6, fontWeight: "600" },
});
