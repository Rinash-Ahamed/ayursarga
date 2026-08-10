"use client";

import { useEffect } from "react";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";

export function PortalRouteError({ error, fallbackHref }: { error: Error & { digest?: string }; fallbackHref: string }) {
  useEffect(() => {
    console.error("Portal route failed to open", error.digest ?? error.message);
  }, [error]);

  return <PortalLoadGuard
    loading={false}
    error="We could not open this page. Please try again."
    fallbackHref={fallbackHref}
  />;
}
