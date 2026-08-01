import "server-only";

import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirebaseAdminApp } from "@/services/firebase/admin";
import { AuthenticationError } from "@/features/auth/errors";
import { isPortalRole } from "@/features/auth/roles";
import type { PortalRole } from "@/features/auth/contracts";

export function getServerAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export async function verifyServerRole(idToken: string, expectedRole?: PortalRole) {
  const decodedToken = await getServerAuth().verifyIdToken(idToken);
  const role = decodedToken.role;

  if (!isPortalRole(role)) throw new AuthenticationError("role-mismatch");
  if (expectedRole && role !== expectedRole) throw new AuthenticationError("role-mismatch");

  return {
    uid: decodedToken.uid,
    email: decodedToken.email ?? null,
    role,
  };
}
