import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import * as SecureStore from "expo-secure-store";
import { trpc } from "../lib/trpc";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface TRPCProviderProps {
  children: React.ReactNode;
}

export const TRPCProvider = ({ children }: TRPCProviderProps): JSX.Element => {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${API_URL}/trpc`,
          async headers() {
            const token = await SecureStore.getItemAsync("auth_token");
            if (token !== null) {
              return { Authorization: `Bearer ${token}` };
            }
            return {};
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
};
