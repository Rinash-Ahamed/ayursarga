"use client";

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type {
  AuthSnapshot,
  LoginCredentials,
  PortalRole,
  UserProfile,
} from "@/features/auth/contracts";
import { AuthenticationError, toAuthenticationError } from "@/features/auth/errors";
import { getConsumerProfileCompletionRedirect, getSafeRoleRedirect, isConsumerProfileComplete } from "@/features/auth/roles";
import { ROUTES } from "@/config/routes";
import { authService } from "@/services/auth/authService";
import { useSessionIdleTimeout } from "@/hooks/useSessionIdleTimeout";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  firebaseUser: AuthSnapshot["user"];
  userProfile: AuthSnapshot["profile"];
  role: PortalRole | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthenticationError | null;
  login(credentials: LoginCredentials, expectedRole?: PortalRole, requestedPath?: string | null): Promise<UserProfile>;
  completeAdminMfa(code: string, requestedPath?: string | null): Promise<UserProfile>;
  completeAdminMfaEnrollment(code: string, requestedPath?: string | null): Promise<UserProfile>;
  loginConsumerWithGoogle(requestedPath?: string | null, stayOnPage?: boolean): Promise<UserProfile>;
  logout(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  reauthenticate(currentPassword: string, authenticatorCode?: string): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
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
      setError(null);
      router.replace(getSafeRoleRedirect(requestedPath, profile.role));
      return profile;
    }), [router, run]);

  const loginConsumerWithGoogle = useCallback((requestedPath?: string | null, stayOnPage = false) =>
    run(async () => {
      const profile = await authService.loginConsumerWithGoogle();
      setSnapshot((current) => ({ ...current, profile }));
      setStatus("authenticated");
      if (!stayOnPage) {
        const safeRequestedPath = getSafeRoleRedirect(requestedPath, profile.role);
        router.replace(isConsumerProfileComplete(profile)
          ? safeRequestedPath
          : getConsumerProfileCompletionRedirect(safeRequestedPath));
      }
      return profile;
    }), [router, run]);

  const finishAdminMfa = useCallback((code: string, enrollment: boolean, requestedPath?: string | null) => run(async () => {
    const profile = await (enrollment ? authService.completeAdminMfaEnrollment(code) : authService.completeAdminMfa(code));
    setSnapshot((current) => ({ ...current, profile }));
    setStatus("authenticated"); setError(null);
    router.replace(getSafeRoleRedirect(requestedPath, "admin"));
    return profile;
  }), [router, run]);
  const completeAdminMfa = useCallback((code: string, requestedPath?: string | null) => finishAdminMfa(code, false, requestedPath), [finishAdminMfa]);
  const completeAdminMfaEnrollment = useCallback((code: string, requestedPath?: string | null) => finishAdminMfa(code, true, requestedPath), [finishAdminMfa]);

  const logout = useCallback(() => run(async () => {
    await authService.logout();
    setSnapshot({ user: null, profile: null });
    setStatus("unauthenticated");
    router.replace(ROUTES.public.home);
  }), [router, run]);

  const resetPassword = useCallback((email: string) =>
    run(() => authService.resetPassword(email)), [run]);

  const reauthenticate = useCallback((currentPassword: string, authenticatorCode?: string) =>
    authService.reauthenticate(currentPassword, authenticatorCode), []);

  const changePassword = useCallback((currentPassword: string, newPassword: string) =>
    run(() => authService.changePassword(currentPassword, newPassword)), [run]);

  const refreshUserProfile = useCallback(() => run(async () => {
    const profile = await authService.getCurrentProfile(true);
    setSnapshot((current) => ({ ...current, profile }));
    return profile;
  }), [run]);

  const clearError = useCallback(() => setError(null), []);

  const expireIdleSession = useCallback(async () => {
    await authService.logout().catch(() => undefined);
    setSnapshot({ user: null, profile: null });
    setStatus("unauthenticated");
    setProcessing(false);
    setError(null);
  }, []);

  useSessionIdleTimeout(
    status === "authenticated" && Boolean(snapshot.user && snapshot.profile),
    expireIdleSession,
  );

  const value = useMemo<AuthContextValue>(() => ({
    firebaseUser: snapshot.user,
    userProfile: snapshot.profile,
    role: snapshot.profile?.role ?? null,
    status,
    isAuthenticated: status === "authenticated" && Boolean(snapshot.user && snapshot.profile),
    isLoading: status === "loading" || processing,
    error,
    login,
    completeAdminMfa,
    completeAdminMfaEnrollment,
    loginConsumerWithGoogle,
    logout,
    resetPassword,
    reauthenticate,
    changePassword,
    refreshUserProfile,
    clearError,
  }), [changePassword, clearError, completeAdminMfa, completeAdminMfaEnrollment, error, login, loginConsumerWithGoogle, logout, processing, reauthenticate, refreshUserProfile, resetPassword, snapshot, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
