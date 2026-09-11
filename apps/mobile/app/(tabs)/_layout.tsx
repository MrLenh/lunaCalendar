import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true, tabBarActiveTintColor: "#2f6690" }}>
      <Tabs.Screen
        name="index"
        options={{ title: "Lịch", tabBarIcon: () => <TabIcon emoji="📅" /> }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: "Sự kiện", tabBarIcon: () => <TabIcon emoji="🗒️" /> }}
      />
      <Tabs.Screen
        name="friends"
        options={{ title: "Bạn bè", tabBarIcon: () => <TabIcon emoji="👥" /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Cài đặt", tabBarIcon: () => <TabIcon emoji="⚙️" /> }}
      />
    </Tabs>
  );
}
