import { Stack } from "expo-router";

// Root layout — required by Expo Router.
const RootLayout = (): JSX.Element => (
  <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="(tabs)" />
  </Stack>
);

export default RootLayout;
