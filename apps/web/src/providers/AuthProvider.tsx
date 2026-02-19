"use client";

import { createContext, useContext } from "react";
import { authClient } from "@/lib/auth-client";

type Session = Awaited<ReturnType<typeof authClient.getSession>>["data"];

interface AuthContextValue {
  session: Session;
  user: NonNullable<Session>["user"] | null;
}

const AuthContext = createContext<AuthContextValue>({ session: null, user: null });

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps): JSX.Element => {
  const { data: session } = authClient.useSession();

  return (
    <AuthContext.Provider
      value={{
        session: session ?? null,
        user: session?.user ?? null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => useContext(AuthContext);
