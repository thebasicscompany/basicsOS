import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Stack, router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { TRPCProvider } from "../providers/TRPCProvider";
import { trpc } from "../lib/trpc";

// Requests notification permissions and registers the Expo push token.
// Must render inside TRPCProvider to use tRPC hooks.
const PushRegistrar = (): null => {
  const { mutate: registerToken } = trpc.auth.registerPushToken.useMutation();

  useEffect(() => {
    const register = async (): Promise<void> => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") return;

        const { data: token } = await Notifications.getExpoPushTokenAsync();
        const platform =
          Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
        registerToken({ token, platform });
      } catch {
        // Push notifications unavailable in simulator or missing project config — non-fatal
      }
    };
    void register();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

// Root layout — required by Expo Router.
const RootLayout = (): JSX.Element => {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      const token = await SecureStore.getItemAsync("auth_token");
      if (token === null) {
        router.replace("/(auth)/login");
      } else {
        setAuthed(true);
      }
      setChecked(true);
    };
    void checkAuth();
  }, []);

  if (!checked) {
    return <></>;
  }

  return (
    <TRPCProvider>
      {authed && <PushRegistrar />}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
      </Stack>
    </TRPCProvider>
  );
};

export default RootLayout;
