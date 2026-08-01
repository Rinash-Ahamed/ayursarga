"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PortalRole } from "@/features/auth/contracts";
import { getRoleHomePath, getRoleLoginPath } from "@/features/auth/roles";
import { useAuth } from "@/hooks/useAuth";
import { AuthLoading } from "@/components/auth/AuthLoading";

export function RequireRole({
  role,
  children,
  fallback = <AuthLoading />,
}: {
  role: PortalRole;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { userProfile, status, isLoading } = useAuth();
  const authorized = userProfile?.role === role && userProfile.status === "active";

  useEffect(() => {
    if (isLoading || status === "loading" || authorized) return;
    if (!userProfile) {
      const login = getRoleLoginPath(role);
      const target = pathname === login ? login : `${login}?next=${encodeURIComponent(pathname)}`;
      if (pathname !== login) router.replace(target);
      return;
    }
    const target = getRoleHomePath(userProfile.role);
    if (pathname !== target) router.replace(target);
  }, [authorized, isLoading, pathname, role, router, status, userProfile]);

  return authorized ? children : fallback;
}

export function RequireAuthenticated({ children, fallback = <AuthLoading /> }: { children: ReactNode; fallback?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, role } = useAuth();

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    const login = role ? getRoleLoginPath(role) : getRoleLoginPath("consumer");
    if (pathname !== login) router.replace(`${login}?next=${encodeURIComponent(pathname)}`);
  }, [isAuthenticated, isLoading, pathname, role, router]);

  return isAuthenticated ? children : fallback;
}

export function GuestOnly({ children, fallback = <AuthLoading /> }: { children: ReactNode; fallback?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, role } = useAuth();

  useEffect(() => {
    if (isLoading || !isAuthenticated || !role) return;
    const target = getRoleHomePath(role);
    if (pathname !== target) router.replace(target);
  }, [isAuthenticated, isLoading, pathname, role, router]);

  if (isLoading || isAuthenticated) return fallback;
  return children;
}
