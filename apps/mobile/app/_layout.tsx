import "dayjs/locale/vi";
import dayjs from "dayjs";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { CalendarDisplayProvider } from "../context/CalendarDisplayContext";

// Vietnamese month/weekday names app-wide (dayjs locale is a global singleton,
// so setting it once here applies to every `dayjs(...)` call in the app).
dayjs.locale("vi");

function RootNavigation() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="event/new"
        options={{ presentation: "modal", headerShown: true, title: "Sự kiện mới" }}
      />
      <Stack.Screen
        name="event/[id]"
        options={{ presentation: "modal", headerShown: true, title: "Chi tiết sự kiện" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CalendarDisplayProvider>
          <RootNavigation />
          <StatusBar style="auto" />
        </CalendarDisplayProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
