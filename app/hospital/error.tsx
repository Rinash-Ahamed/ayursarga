"use client";

import { PortalRouteError } from "@/components/portal/PortalRouteError";

export default function HospitalError({ error }: { error: Error & { digest?: string } }) {
  return <PortalRouteError error={error} fallbackHref="/hospital" />;
}
