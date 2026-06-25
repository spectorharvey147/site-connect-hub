import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { AuthContext, type AuthContextValue } from "@/context/authContextValue";
import { authService } from "@/services/authService";
import type {
  AppUser,
  AuthSession,
  InitialAdminInput,
  LoginCredentials,
} from "@/types/auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      setSession(await authService.getCurrentSession());
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const nextSession = await authService.login(credentials);
    setSession(nextSession);
  }, []);

  const logout = useCallback(async () => {
    const userId = session?.user.id;
    await authService.logout(userId);
    setSession(null);
  }, [session?.user.id]);

  const createInitialAdmin = useCallback(async (input: InitialAdminInput) => {
    const nextSession = await authService.createInitialAdmin(input);
    setSession(nextSession);
  }, []);

  const updateCurrentUser = useCallback((user: AppUser) => {
    setSession((current) => {
      if (!current) return current;
      const nextSession = { ...current, user };
      authService.persistUpdatedSession(nextSession);
      return nextSession;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      login,
      logout,
      createInitialAdmin,
      refreshSession,
      updateCurrentUser,
    }),
    [
      createInitialAdmin,
      loading,
      login,
      logout,
      refreshSession,
      session,
      updateCurrentUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
