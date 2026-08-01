import { ROUTES } from "@/config/routes";
import { AuthenticationError } from "@/features/auth/errors";
import type { PortalRole, UserProfile } from "@/features/auth/contracts";

const ROLE_HOME_PATHS = {
  admin: ROUTES.admin.home,
  hospital: ROUTES.hospital.home,
  consumer: ROUTES.consumer.home,
} as const satisfies Record<PortalRole, string>;

const ROLE_LOGIN_PATHS = {
  admin: ROUTES.admin.login,
  hospital: ROUTES.hospital.login,
  consumer: ROUTES.consumer.login,
} as const satisfies Record<PortalRole, string>;

export function isPortalRole(value: unknown): value is PortalRole {
  return value === "admin" || value === "hospital" || value === "consumer";
}

export function getRoleHomePath(role: PortalRole) {
  return ROLE_HOME_PATHS[role];
}

export function getRoleLoginPath(role: PortalRole) {
  return ROLE_LOGIN_PATHS[role];
}

export function verifyProfileRole(profile: UserProfile, expectedRole: PortalRole) {
  if (profile.role !== expectedRole) throw new AuthenticationError("role-mismatch");
  if (profile.status === "suspended") throw new AuthenticationError("account-suspended");
  return profile;
}
