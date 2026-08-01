import { AuthenticationError } from "@/features/auth/errors";
import { isPortalRole } from "@/features/auth/roles";
import type { UserProfile, UserStatus } from "@/features/auth/contracts";
import { toDate } from "@/utils/date";

const isUserStatus = (value: unknown): value is UserStatus =>
  value === "active" || value === "inactive" || value === "pending";

export function parseUserProfile(uid: string, value: unknown, fallbackEmail = ""): UserProfile {
  if (!value || typeof value !== "object") throw new AuthenticationError("profile-not-found");
  const data = value as Record<string, unknown>;

  if (!isPortalRole(data.role) || !isUserStatus(data.status)) {
    throw new AuthenticationError("profile-invalid");
  }

  return {
    uid,
    name: typeof data.name === "string" ? data.name : "",
    email: typeof data.email === "string" ? data.email : fallbackEmail,
    phone: typeof data.phone === "string" ? data.phone : null,
    role: data.role,
    status: data.status,
    hospitalId: typeof data.hospitalId === "string" ? data.hospitalId : null,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}
