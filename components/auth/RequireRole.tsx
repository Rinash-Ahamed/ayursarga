"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PortalRole } from "@/features/auth/contracts";
import { getRoleHomePath, getRoleLoginRedirect, isConsumerProfileComplete } from "@/features/auth/roles";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/hooks/useAuth";
import { AuthLoading } from "@/components/auth/AuthLoading";

export function RequireRole({
  role,
  children,
  fallback = <AuthLoading />,
  requestedPath,
}: {
  role: PortalRole;
  children: ReactNode;
  fallback?: ReactNode;
  requestedPath?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { userProfile, status, isLoading } = useAuth();
  const authorized = userProfile?.role === role && userProfile.status === "active";
  const needsConsumerProfile = authorized && role === "consumer" && !isConsumerProfileComplete(userProfile);
  const mayRender = authorized && (!needsConsumerProfile || pathname === ROUTES.consumer.completeProfile);

  useEffect(() => {
    if (isLoading || status === "loading") return;
    if (needsConsumerProfile) {
      if (pathname !== ROUTES.consumer.completeProfile) router.replace(ROUTES.consumer.completeProfile);
      return;
    }
    if (authorized) return;
    const target = getRoleLoginRedirect(role, requestedPath ?? pathname);
    if (pathname !== target) router.replace(target);
  }, [authorized, isLoading, needsConsumerProfile, pathname, requestedPath, role, router, status, userProfile]);

  return mayRender ? children : fallback;
}

export function GuestOnly({
  children,
  fallback = <AuthLoading />,
  role: targetRole,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  role?: PortalRole;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, role, userProfile } = useAuth();
  const sameRoleSession = Boolean(isAuthenticated && role && (!targetRole || role === targetRole));

  useEffect(() => {
    if (isLoading || !sameRoleSession || !role) return;
    const target = role === "consumer" && !isConsumerProfileComplete(userProfile)
      ? ROUTES.consumer.completeProfile
      : getRoleHomePath(role);
    if (pathname !== target) router.replace(target);
  }, [isLoading, pathname, role, router, sameRoleSession, userProfile]);

  if (isLoading || sameRoleSession) return fallback;
  return children;
}
