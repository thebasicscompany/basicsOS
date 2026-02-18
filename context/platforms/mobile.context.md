# Mobile App — Platform Context

## Stack
- **Framework**: Expo SDK 54+ with React Native (`apps/mobile/`)
- **Routing**: Expo Router v4 (file-based, same as Next.js App Router)
- **Styling**: Tamagui (mobile-native components, not Tailwind/Radix)
- **Storage**: MMKV for local cache (fast, synchronous)
- **Push notifications**: Expo Push Notifications

## Running Locally

```bash
pnpm --filter @basicos/mobile dev   # starts Expo dev server
# Scan QR code with Expo Go on your phone, or:
pnpm --filter @basicos/mobile ios   # open in iOS simulator
```

## App Structure

```
apps/mobile/app/
  _layout.tsx           # Root layout — auth check, branding fetch
  connect.tsx           # First-launch: enter company URL or scan QR code
  (tabs)/
    _layout.tsx         # Tab bar navigation
    index.tsx           # Dashboard (home)
    assistant/index.tsx # Company Assistant chat
    crm/index.tsx        # CRM pipeline + contacts
    tasks/index.tsx      # Task list
    meetings/index.tsx   # Meeting summaries
    hub/index.tsx        # Quick links
```

## Tab Navigation

6 tabs in the bottom bar:
1. 🏠 Dashboard
2. 🤖 Assistant (AI chat)
3. 🤝 CRM
4. ✅ Tasks
5. 🎯 Meetings
6. 🔗 Hub

## First Launch Flow

1. App opens → checks MMKV for saved company URL
2. If none → `app/connect.tsx` → user enters URL or scans QR code from web portal
3. App fetches `/api/branding` from that URL → saves to MMKV
4. Branding (company name, accent color, logo) applied at runtime
5. User logs in via Better Auth (same backend as web)

## Shared Code with Web

The mobile app shares:
- `packages/shared` — all Zod validators and TypeScript types
- `packages/auth` — Better Auth client
- API calls via `@trpc/react-query` with React Native fetch adapter

It does NOT share:
- UI components (`packages/ui` is web/Radix only)
- CSS/Tailwind (mobile uses Tamagui)
- Next.js-specific features

## Adding a New Screen

```ts
// apps/mobile/app/(tabs)/new-screen/index.tsx
import { View, Text } from "react-native";
import { trpc } from "@/lib/trpc";

const NewScreen = (): JSX.Element => {
  const { data } = trpc.myModule.list.useQuery({});
  return (
    <View>
      <Text>{JSON.stringify(data)}</Text>
    </View>
  );
};

export default NewScreen;
```

Add to `apps/mobile/app/(tabs)/_layout.tsx` tabs array.

## Push Notifications

```ts
import * as Notifications from "expo-notifications";

// On login — register token
const token = await Notifications.getExpoPushTokenAsync();
// Send token to API: trpc.notifications.registerDevice({ token })
```

The API stores tokens in the `users` table. Workers send push notifications via Expo Push API.

## EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Build for iOS (TestFlight)
eas build --platform ios --profile preview

# Build for Android
eas build --platform android --profile preview
```

Config in `apps/mobile/eas.json`.
