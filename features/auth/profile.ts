import { AuthenticationError } from "@/features/auth/errors";
import { isPortalRole } from "@/features/auth/roles";
import type { UserProfile, UserStatus } from "@/features/auth/contracts";

const isUserStatus = (value: unknown): value is UserStatus =>
  value === "active" || value === "pending" || value === "suspended";

export function parseUserProfile(uid: string, value: unknown, fallbackEmail = ""): UserProfile {
  if (!value || typeof value !== "object") throw new AuthenticationError("profile-not-found");
  const data = value as Record<string, unknown>;

  if (!isPortalRole(data.role) || !isUserStatus(data.status)) {
    throw new AuthenticationError("profile-invalid");
  }

  return {
    uid,
    email: typeof data.email === "string" ? data.email : fallbackEmail,
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    role: data.role,
    status: data.status,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
  };
}
