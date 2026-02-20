# Mobile App — Platform Context

## Stack

- **Framework**: Expo SDK 54+ with React Native (`apps/mobile/`)
- **Routing**: Expo Router v4 (file-based, same as Next.js App Router)
- **Styling**: React Native `StyleSheet` (mobile-native — NOT Tailwind/Radix/Tamagui)
- **Storage**: `expo-secure-store` for auth token; MMKV for local cache
- **Push notifications**: Expo Push Notifications
- **Auth client**: Better Auth browser client (same backend as web)
- **tRPC**: `@trpc/react-query` with Bearer token auth header

## Running Locally

```bash
pnpm --filter @basicsos/mobile dev   # starts Expo dev server
# Scan QR code with Expo Go on your phone, or:
pnpm --filter @basicsos/mobile ios   # open in iOS simulator
```

## App Structure

```
apps/mobile/
  app/
    _layout.tsx           # Root layout — auth guard, wraps TRPCProvider
    (auth)/
      login.tsx           # Sign-in screen (Better Auth)
    (tabs)/
      _layout.tsx         # Tab bar navigation
      index.tsx           # Dashboard (home)
      crm/index.tsx       # CRM pipeline + contacts
      tasks/index.tsx     # Task list
      meetings/index.tsx  # Meeting summaries
      hub/index.tsx       # Quick links
      knowledge/index.tsx # Knowledge base
  lib/
    trpc.ts               # createTRPCReact<AppRouter>() — same type as web
    auth-client.ts        # Better Auth browser client → EXPO_PUBLIC_APP_URL
  providers/
    TRPCProvider.tsx      # QueryClient + tRPC; injects Bearer token from SecureStore
```

## Tab Navigation

8 tabs in the bottom bar (icons via `lucide-react-native`):

1. `LayoutDashboard` — Dashboard
2. `Sparkles` — Assistant (AI chat)
3. `BookOpen` — Knowledge base
4. `Users` — CRM
5. `CheckSquare` — Tasks
6. `Video` — Meetings
7. `Link2` — Hub
8. `Bot` — AI Employees

## Auth Flow

1. App opens → `_layout.tsx` checks `SecureStore` for `auth_token`
2. If no token → `router.replace("/(auth)/login")`
3. Login screen calls `authClient.signIn.email({ email, password })`
4. On success → stores `result.data.token` via `SecureStore.setItemAsync("auth_token", token)`
5. Redirects to `/(tabs)`
6. `TRPCProvider` reads token from `SecureStore` on each request → adds `Authorization: Bearer <token>` header

## Shared Code with Web

The mobile app shares:

- `packages/shared` — all Zod validators and TypeScript types
- `packages/api` — `AppRouter` type (for end-to-end type safety)
- `packages/auth` — Better Auth client (via `apps/mobile/lib/auth-client.ts`)
- tRPC call patterns — same `trpc.module.procedure.useQuery/useMutation()` API

It does NOT share:

- UI components (`packages/ui` is web/Radix/Tailwind only)
- CSS/Tailwind (mobile uses React Native `StyleSheet`)
- Next.js-specific features (routing is Expo Router)

## Adding a New Screen

```ts
// apps/mobile/app/(tabs)/new-screen/index.tsx
import { View, Text, StyleSheet } from "react-native";
import { trpc } from "../../lib/trpc";

// Expo Router requires default export for screens.
const NewScreen = (): JSX.Element => {
  const { data } = trpc.myModule.list.useQuery({});
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f9fafb" },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
});

export default NewScreen;
```

Add a tab entry in `apps/mobile/app/(tabs)/_layout.tsx`.

## tRPC Pattern in Mobile

Identical to web — same hook API, different auth mechanism:

```ts
// Web: session cookie (automatic via credentials: "include")
// Mobile: Bearer token (injected by TRPCProvider from SecureStore)

const { data, isLoading } = trpc.tasks.list.useQuery({});
const create = trpc.tasks.create.useMutation({ onSuccess: () => { ... } });
```

## Sign-Out Pattern

```ts
import * as SecureStore from "expo-secure-store";
import { authClient } from "../../lib/auth-client";
import { router } from "expo-router";

await authClient.signOut();
await SecureStore.deleteItemAsync("auth_token");
router.replace("/(auth)/login");
```

## Push Notifications

```ts
import * as Notifications from "expo-notifications";

// On login — register token
const token = await Notifications.getExpoPushTokenAsync();
// Send token to API: trpc.auth.registerPushToken({ token, platform })
```

The API stores tokens in the `pushTokens` table. Workers send push notifications via Expo Push API.

## EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Build for iOS (TestFlight)
eas build --platform ios --profile preview

# Build for Android
eas build --platform android --profile preview
```

Configure EAS Build by running `eas build:configure` in the mobile app directory.
