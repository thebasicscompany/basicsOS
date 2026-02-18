import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@basicsos/api";

export const trpc = createTRPCReact<AppRouter>();
