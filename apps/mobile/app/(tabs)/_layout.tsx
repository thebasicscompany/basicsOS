import { Tabs } from "expo-router";
import {
  Home,
  CheckSquare,
  Users,
  Video,
  BookOpen,
  Sparkles,
  Briefcase,
} from "lucide-react-native";
import { colors } from "../../lib/tokens";

// Expo Router requires default export for layouts.
const TabLayout = (): JSX.Element => (
  <Tabs
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.brand,
      tabBarInactiveTintColor: colors.textPlaceholder,
      tabBarStyle: {
        backgroundColor: colors.surfaceCard,
        borderTopColor: colors.border,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: "500",
      },
    }}
  >
    <Tabs.Screen
      name="index"
      options={{
        title: "Home",
        tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
      }}
    />
    <Tabs.Screen
      name="tasks/index"
      options={{
        title: "Tasks",
        tabBarIcon: ({ color, size }) => <CheckSquare size={size} color={color} />,
      }}
    />
    <Tabs.Screen
      name="crm/index"
      options={{
        title: "CRM",
        tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
      }}
    />
    <Tabs.Screen
      name="meetings/index"
      options={{
        title: "Meetings",
        tabBarIcon: ({ color, size }) => <Video size={size} color={color} />,
      }}
    />
    <Tabs.Screen
      name="knowledge/index"
      options={{
        title: "Knowledge",
        tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
      }}
    />
    <Tabs.Screen
      name="assistant/index"
      options={{
        title: "Assistant",
        tabBarIcon: ({ color, size }) => <Sparkles size={size} color={color} />,
      }}
    />
    <Tabs.Screen
      name="ai-employees/index"
      options={{
        title: "AI Jobs",
        tabBarIcon: ({ color, size }) => <Briefcase size={size} color={color} />,
      }}
    />
  </Tabs>
);

export default TabLayout;
