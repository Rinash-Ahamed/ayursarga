"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthLoading } from "@/components/auth/AuthLoading";
import { ROUTES } from "@/config/routes";
import { isConsumerProfileComplete } from "@/features/auth/roles";
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
    if (redirecting) router.replace(ROUTES.consumer.completeProfile);
  }, [redirecting, router]);

  if (isLoading || redirecting) return <AuthLoading />;
  return children;
}
