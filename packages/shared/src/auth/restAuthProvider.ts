import type { AuthProvider } from "ra-core";
import { createAuthClient } from "better-auth/react";
import { canAccess } from "./canAccess";

export function createRestAuthProvider(apiUrl: string): AuthProvider {
  const authClient = createAuthClient({
    baseURL: apiUrl || undefined,
  });

  return {
    login: async ({ email, password }) => {
      const { error } = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/contacts",
      });
      if (error) throw new Error(error.message ?? "Login failed");
    },
    logout: async () => {
      await authClient.signOut();
    },
    checkAuth: async () => {
      if (
        window.location.pathname === "/set-password" ||
        window.location.pathname === "/forgot-password" ||
        window.location.pathname === "/sign-up" ||
        window.location.pathname === "/oauth/consent"
      ) {
        return;
      }
      const { data: session } = await authClient.getSession();
      if (!session?.user) {
        throw { redirectTo: "/login", message: false };
      }
    },
    checkError: async (error) => {
      const status = (error as { status?: number } | undefined)?.status;
      if (status === 401 || status === 403) {
        throw { redirectTo: "/login", message: false };
      }
    },
    getIdentity: async () => {
      const res = await fetch(`${apiUrl || ""}/api/me`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to get identity");
      const data = await res.json();
      return {
        id: data.id,
        fullName: data.fullName,
        avatar: data.avatar?.src ?? data.avatar,
      };
    },
    getAuthorizationDetails: () => {
      throw new Error("OAuth not supported");
    },
    approveAuthorization: () => {
      throw new Error("OAuth not supported");
    },
    denyAuthorization: () => {
      throw new Error("OAuth not supported");
    },
    canAccess: async (params) => {
      const res = await fetch(`${apiUrl || ""}/api/me`, {
        credentials: "include",
      });
      if (!res.ok) return false;
      const sale = await res.json();
      const role = sale.administrator ? "admin" : "user";
      return canAccess(role, params);
    },
  };
}

export { createAuthClient } from "better-auth/react";
