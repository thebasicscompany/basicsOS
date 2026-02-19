import { auth } from "@basicsos/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Mount Better Auth handler at /api/auth/* for all HTTP methods.
export const { GET, POST } = toNextJsHandler(auth);
