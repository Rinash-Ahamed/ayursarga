import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import type { PortalRole } from "@/features/auth/contracts";
import { isPortalRole } from "@/features/auth/roles";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/services/firebase/admin";

export class AdminAuthorizationError extends Error {
  constructor(message: string, public readonly status: 401 | 403) {
    super(message);
    this.name = "AdminAuthorizationError";
  }
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

export async function requireActiveUser(request: Request, allowedRoles?: readonly PortalRole[]) {
  const token = bearerToken(request);
  if (!token) throw new AdminAuthorizationError("Authentication is required.", 401);
  try {
    const auth = getFirebaseAdminAuth();
    const firestore = getFirebaseAdminFirestore();
    const decoded = await auth.verifyIdToken(token, true);
    const profileSnapshot = await firestore.collection("users").doc(decoded.uid).get();
    const profile = profileSnapshot.data();
    if (!profileSnapshot.exists || profile?.status !== "active") {
      throw new AdminAuthorizationError("Your Ayursarga account is not active.", 403);
    }
    if (!isPortalRole(profile.role)) {
      throw new AdminAuthorizationError("Your Ayursarga account permissions are invalid.", 403);
    }
    const role: PortalRole = profile.role;
    if (!allowedRoles?.includes(role) && allowedRoles?.length) {
      throw new AdminAuthorizationError("You do not have permission to complete this action.", 403);
    }
    return { uid: decoded.uid, role, profile, decoded: decoded as DecodedIdToken, auth, firestore };
  } catch (error) {
    if (error instanceof AdminAuthorizationError) throw error;
    throw new AdminAuthorizationError("Your session is invalid or has expired.", 401);
  }
}

export async function requireActiveAdmin(request: Request) {
  try {
    return await requireActiveUser(request, ["admin"]);
  } catch (error) {
    if (error instanceof AdminAuthorizationError && error.status === 403) {
      throw new AdminAuthorizationError("Only an active Admin can complete this action.", 403);
    }
    throw error;
  }
}
