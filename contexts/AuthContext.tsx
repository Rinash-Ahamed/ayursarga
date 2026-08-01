"use client";

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type {
  AuthSnapshot,
  ConsumerRegistration,
  LoginCredentials,
  PortalRole,
  UserProfile,
} from "@/features/auth/contracts";
import { AuthenticationError, toAuthenticationError } from "@/features/auth/errors";
import { getRoleHomePath } from "@/features/auth/roles";
import { ROUTES } from "@/config/routes";
import { firebaseAuthAdapter } from "@/services/auth/firebase-client";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthContextValue = AuthSnapshot & {
  status: AuthStatus;
  isLoading: boolean;
  error: AuthenticationError | null;
  login(credentials: LoginCredentials, expectedRole?: PortalRole): Promise<UserProfile>;
  register(input: ConsumerRegistration): Promise<UserProfile>;
  logout(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  refreshProfile(): Promise<UserProfile | null>;
  clearError(): void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<AuthSnapshot>({ user: null, profile: null });
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<AuthenticationError | null>(null);

  useEffect(() => firebaseAuthAdapter.subscribe((nextSnapshot) => {
    setSnapshot(nextSnapshot);
    setStatus(nextSnapshot.user ? "authenticated" : "unauthenticated");
  }, (nextError) => {
    setError(toAuthenticationError(nextError));
    setStatus("unauthenticated");
  }), []);

  const run = useCallback(async <T,>(operation: () => Promise<T>) => {
    setProcessing(true);
    setError(null);
    try {
      return await operation();
    } catch (caught) {
      const nextError = toAuthenticationError(caught);
      setError(nextError);
      throw nextError;
    } finally {
      setProcessing(false);
    }
  }, []);

  const login = useCallback((credentials: LoginCredentials, expectedRole?: PortalRole) =>
    run(async () => {
      const profile = await firebaseAuthAdapter.login(credentials, expectedRole);
      setSnapshot((current) => ({ ...current, profile }));
      router.replace(getRoleHomePath(profile.role));
      return profile;
    }), [router, run]);

  const register = useCallback((input: ConsumerRegistration) =>
    run(async () => {
      const profile = await firebaseAuthAdapter.registerConsumer(input);
      setSnapshot((current) => ({ ...current, profile }));
      router.replace(getRoleHomePath(profile.role));
      return profile;
    }), [router, run]);

  const logout = useCallback(() => run(async () => {
    await firebaseAuthAdapter.logout();
    setSnapshot({ user: null, profile: null });
    setStatus("unauthenticated");
    router.replace(ROUTES.public.home);
  }), [router, run]);

  const resetPassword = useCallback((email: string) =>
    run(() => firebaseAuthAdapter.resetPassword(email)), [run]);

  const refreshProfile = useCallback(() => run(async () => {
    const profile = await firebaseAuthAdapter.getCurrentProfile();
    setSnapshot((current) => ({ ...current, profile }));
    return profile;
  }), [run]);

  const value = useMemo<AuthContextValue>(() => ({
    ...snapshot,
    status,
    isLoading: status === "loading" || processing,
    error,
    login,
    register,
    logout,
    resetPassword,
    refreshProfile,
    clearError: () => setError(null),
  }), [error, login, logout, processing, refreshProfile, register, resetPassword, snapshot, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
