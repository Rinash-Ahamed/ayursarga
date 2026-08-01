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
import { getRoleHomePath, getSafeRoleRedirect } from "@/features/auth/roles";
import { ROUTES } from "@/config/routes";
import { authService } from "@/services/auth/authService";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthContextValue = {
  firebaseUser: AuthSnapshot["user"];
  userProfile: AuthSnapshot["profile"];
  role: PortalRole | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthenticationError | null;
  login(credentials: LoginCredentials, expectedRole?: PortalRole, requestedPath?: string | null): Promise<UserProfile>;
  registerConsumer(input: ConsumerRegistration): Promise<UserProfile>;
  logout(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  refreshUserProfile(): Promise<UserProfile | null>;
  clearError(): void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<AuthSnapshot>({ user: null, profile: null });
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<AuthenticationError | null>(null);

  useEffect(() => authService.subscribe((nextSnapshot) => {
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

  const login = useCallback((credentials: LoginCredentials, expectedRole?: PortalRole, requestedPath?: string | null) =>
    run(async () => {
      const profile = await authService.login(credentials, expectedRole);
      setSnapshot((current) => ({ ...current, profile }));
      setStatus("authenticated");
      router.replace(getSafeRoleRedirect(requestedPath, profile.role));
      return profile;
    }), [router, run]);

  const registerConsumer = useCallback((input: ConsumerRegistration) =>
    run(async () => {
      const profile = await authService.registerConsumer(input);
      setSnapshot((current) => ({ ...current, profile }));
      setStatus("authenticated");
      router.replace(getRoleHomePath(profile.role));
      return profile;
    }), [router, run]);

  const logout = useCallback(() => run(async () => {
    await authService.logout();
    setSnapshot({ user: null, profile: null });
    setStatus("unauthenticated");
    router.replace(ROUTES.public.home);
  }), [router, run]);

  const resetPassword = useCallback((email: string) =>
    run(() => authService.resetPassword(email)), [run]);

  const refreshUserProfile = useCallback(() => run(async () => {
    const profile = await authService.getCurrentProfile(true);
    setSnapshot((current) => ({ ...current, profile }));
    return profile;
  }), [run]);

  const clearError = useCallback(() => setError(null), []);
  const value = useMemo<AuthContextValue>(() => ({
    firebaseUser: snapshot.user,
    userProfile: snapshot.profile,
    role: snapshot.profile?.role ?? null,
    status,
    isAuthenticated: status === "authenticated" && Boolean(snapshot.user && snapshot.profile),
    isLoading: status === "loading" || processing,
    error,
    login,
    registerConsumer,
    logout,
    resetPassword,
    refreshUserProfile,
    clearError,
  }), [clearError, error, login, logout, processing, refreshUserProfile, registerConsumer, resetPassword, snapshot, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
