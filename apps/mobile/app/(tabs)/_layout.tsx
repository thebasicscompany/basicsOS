import { Tabs } from "expo-router";

// Expo Router requires default export for layouts.
const TabLayout = (): JSX.Element => (
  <Tabs
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: "#6366f1",
      tabBarInactiveTintColor: "#9ca3af",
      tabBarStyle: {
        backgroundColor: "#fff",
        borderTopColor: "#e5e7eb",
      },
    }}
  >
    <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: () => null }} />
    <Tabs.Screen name="tasks/index" options={{ title: "Tasks", tabBarIcon: () => null }} />
    <Tabs.Screen name="crm/index" options={{ title: "CRM", tabBarIcon: () => null }} />
    <Tabs.Screen
      name="meetings/index"
      options={{ title: "Meetings", tabBarIcon: () => null }}
    />
    <Tabs.Screen
      name="assistant/index"
      options={{ title: "Assistant", tabBarIcon: () => null }}
    />
    <Tabs.Screen name="hub/index" options={{ title: "Hub", tabBarIcon: () => null }} />
  </Tabs>
);

export default TabLayout;
