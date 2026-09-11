import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { User } from "@luna/shared-types";
import * as api from "../lib/api";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, if a token is already stored, try to resolve the current user.
  useEffect(() => {
    (async () => {
      const storedToken = await api.getStoredToken();
      if (storedToken) {
        try {
          const currentUser = await api.me();
          setUser(currentUser);
        } catch {
          // Stored token is stale/invalid - drop it and fall back to sign-in.
          await api.setStoredToken(null);
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const signIn = async (email: string, displayName: string) => {
    const result = await api.login(email, displayName);
    setUser(result.user);
  };

  const signOut = async () => {
    await api.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    const currentUser = await api.me();
    setUser(currentUser);
  };

  const value = useMemo(
    () => ({ user, isLoading, signIn, signOut, refreshUser }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
