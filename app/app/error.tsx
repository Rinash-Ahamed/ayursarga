"use client";

import { PortalRouteError } from "@/components/portal/PortalRouteError";

export default function ConsumerError({ error }: { error: Error & { digest?: string } }) {
  return <PortalRouteError error={error} fallbackHref="/app" />;
}
