import type { PortalRole } from "@/features/auth/contracts";
import { ROUTES } from "@/config/routes";

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
    loginPath: ROUTES.admin.login,
    homePath: ROUTES.admin.home,
    enabled: false,
    installable: false,
  },
  hospital: {
    role: "hospital",
    loginPath: ROUTES.hospital.login,
    homePath: ROUTES.hospital.home,
    enabled: false,
    installable: false,
  },
  consumer: {
    role: "consumer",
    loginPath: ROUTES.consumer.login,
    homePath: ROUTES.consumer.home,
    enabled: false,
    installable: true,
  },
} as const satisfies Record<PortalRole, PortalDefinition>;
