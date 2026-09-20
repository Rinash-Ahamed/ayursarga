"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthLoading } from "@/components/auth/AuthLoading";
import { ROUTES } from "@/config/routes";
import { getConsumerProfileCompletionRedirect, isConsumerProfileComplete } from "@/features/auth/roles";
import { useAuth } from "@/hooks/useAuth";

export function ConsumerProfileGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, userProfile } = useAuth();
  const needsCompletion = isAuthenticated
    && userProfile?.role === "consumer"
    && !isConsumerProfileComplete(userProfile);
  const redirecting = needsCompletion && pathname !== ROUTES.consumer.completeProfile;

  useEffect(() => {
    if (!redirecting) return;
    const currentSearch = window.location.search;
    const explicitNext = new URLSearchParams(currentSearch).get("next");
    const requestedPath = explicitNext ?? `${pathname}${currentSearch}`;
    router.replace(getConsumerProfileCompletionRedirect(requestedPath));
  }, [pathname, redirecting, router]);

  if (isLoading || redirecting) return <AuthLoading />;
  return children;
}
