"use client";

import type { ReactNode } from "react";
import type { PortalRole } from "@/features/auth/contracts";
import { PortalEnvironment } from "@/components/auth/PortalEnvironment";
import { ConsumerProfileGate } from "@/components/auth/ConsumerProfileGate";

export function PortalProviders({ area, children }: { area: PortalRole; children: ReactNode }) {
  return <PortalEnvironment area={area}>
    {area === "consumer" ? <ConsumerProfileGate>{children}</ConsumerProfileGate> : children}
  </PortalEnvironment>;
}
