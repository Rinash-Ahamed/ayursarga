"use client";

import { PortalRouteError } from "@/components/portal/PortalRouteError";

export default function AdminError({ error }: { error: Error & { digest?: string } }) {
  return <PortalRouteError error={error} fallbackHref="/admin" />;
}
