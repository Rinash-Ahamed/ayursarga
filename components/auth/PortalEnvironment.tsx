"use client";

import { useLayoutEffect, type ReactNode } from "react";
import type { PortalRole } from "@/features/auth/contracts";

export function PortalEnvironment({ area, children }: { area: PortalRole; children: ReactNode }) {
  useLayoutEffect(() => {
    document.body.classList.remove("loading");
    document.body.classList.add("portal-active");
    return () => document.body.classList.remove("portal-active");
  }, []);

  return <div className="portal-root" data-portal={area}>{children}</div>;
}
