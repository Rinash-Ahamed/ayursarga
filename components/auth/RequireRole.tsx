"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { PortalRole } from "@/features/auth/contracts";
import { getRoleHomePath, getRoleLoginPath } from "@/features/auth/roles";
import { useAuth } from "@/hooks/useAuth";

export function RequireRole({
  role,
  children,
  fallback = null,
}: {
  role: PortalRole;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const router = useRouter();
  const { profile, status, isLoading } = useAuth();
  const authorized = profile?.role === role && profile.status !== "suspended";

  useEffect(() => {
    if (isLoading || status === "loading" || authorized) return;
    if (!profile) {
      router.replace(getRoleLoginPath(role));
      return;
    }
    router.replace(getRoleHomePath(profile.role));
  }, [authorized, isLoading, profile, role, router, status]);

  return authorized ? children : fallback;
}
