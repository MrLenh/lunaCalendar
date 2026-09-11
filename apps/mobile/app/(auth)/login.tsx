import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useAuth } from "../../context/AuthContext";
import { oauthStartUrl } from "../../lib/api";

// Required on web so the popup opened by openAuthSessionAsync can hand control
// back to this tab once the OAuth redirect completes.
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<"google" | "lark" | null>(null);

  const handleDevLogin = async () => {
    if (!email.trim() || !displayName.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập email và tên hiển thị.");
      return;
    }
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), displayName.trim());
    } catch (err) {
      Alert.alert("Đăng nhập thất bại", err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthConnect = async (provider: "google" | "lark") => {
    setConnectingProvider(provider);
    try {
      // lunacalendar:// is registered via app.json's "scheme" - the backend's
      // OAuth flow should redirect back to this URL once linking completes.
      const redirectUrl = Linking.createURL("/");
      const startUrl = `${oauthStartUrl(provider)}?redirect_uri=${encodeURIComponent(redirectUrl)}`;
      await WebBrowser.openAuthSessionAsync(startUrl, redirectUrl);
    } catch (err) {
      Alert.alert("Không thể kết nối", err instanceof Error ? err.message : String(err));
    } finally {
      setConnectingProvider(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Luna Calendar</Text>
      <Text style={styles.subtitle}>Lịch Âm - Dương cho người Việt</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dev sign-in (no real account needed)</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#8a8f98"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Tên hiển thị"
          placeholderTextColor="#8a8f98"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <Pressable style={styles.primaryButton} onPress={handleDevLogin} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Liên kết tài khoản lịch</Text>
        <Text style={styles.cardHint}>
          Kết nối để đồng bộ sự kiện với Google Calendar hoặc Lark Calendar.
        </Text>
        <Pressable
          style={[styles.oauthButton, styles.googleButton]}
          onPress={() => handleOAuthConnect("google")}
          disabled={connectingProvider !== null}
        >
          {connectingProvider === "google" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.oauthButtonText}>Kết nối Google Calendar</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.oauthButton, styles.larkButton]}
          onPress={() => handleOAuthConnect("lark")}
          disabled={connectingProvider !== null}
        >
          {connectingProvider === "lark" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.oauthButtonText}>Kết nối Lark Calendar</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 80, backgroundColor: "#f4f6f8" },
  title: { fontSize: 32, fontWeight: "700", textAlign: "center", color: "#1c2b39" },
  subtitle: { fontSize: 15, textAlign: "center", color: "#5c6b77", marginBottom: 32 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12, color: "#1c2b39" },
  cardHint: { fontSize: 13, color: "#5c6b77", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#c7ccd1",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: "#2f6690",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  oauthButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  googleButton: { backgroundColor: "#dd4b39" },
  larkButton: { backgroundColor: "#2a2a2a" },
  oauthButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
