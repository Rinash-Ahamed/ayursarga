"use client";

import type { ReactNode } from "react";
import type { PortalRole } from "@/features/auth/contracts";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortalEnvironment } from "@/components/auth/PortalEnvironment";
import { ConsumerProfileGate } from "@/components/auth/ConsumerProfileGate";

export function PortalProviders({ area, children }: { area: PortalRole; children: ReactNode }) {
  return <PortalEnvironment area={area}><AuthProvider>
    {area === "consumer" ? <ConsumerProfileGate>{children}</ConsumerProfileGate> : children}
  </AuthProvider></PortalEnvironment>;
}
