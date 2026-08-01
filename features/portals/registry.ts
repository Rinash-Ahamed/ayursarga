import type { PortalRole } from "@/features/auth/contracts";

export type PortalDefinition = {
  role: PortalRole;
  loginPath: `/${string}/login`;
  homePath: `/${string}`;
  enabled: boolean;
  installable: boolean;
};

/**
 * One source of truth for future portal routing and feature gating.
 * All portals stay disabled until their routes and authentication are built.
 */
export const PORTALS = {
  admin: {
    role: "admin",
    loginPath: "/admin/login",
    homePath: "/admin",
    enabled: false,
    installable: false,
  },
  hospital: {
    role: "hospital",
    loginPath: "/hospital/login",
    homePath: "/hospital",
    enabled: false,
    installable: false,
  },
  consumer: {
    role: "consumer",
    loginPath: "/consumer/login",
    homePath: "/consumer",
    enabled: false,
    installable: true,
  },
} as const satisfies Record<PortalRole, PortalDefinition>;
