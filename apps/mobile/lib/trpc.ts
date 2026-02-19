import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@basicsos/api";

// tRPC client for mobile — uses the same AppRouter type as the web app.
// Auth token is injected per-request by TRPCProvider.
export const trpc = createTRPCReact<AppRouter>();
