import "server-only";

import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirebaseAdminApp } from "@/services/firebase/admin";
import { AuthenticationError } from "@/features/auth/errors";
import { isPortalRole } from "@/features/auth/roles";
import { parseUserProfile } from "@/features/auth/profile";
import { verifyProfileRole } from "@/features/auth/roles";
import type { PortalRole } from "@/features/auth/contracts";
import { getServerFirestore } from "@/services/firestore/server";

export function getServerAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export async function getServerUserProfile(uid: string) {
  const snapshot = await getServerFirestore().collection("users").doc(uid).get();
  if (!snapshot.exists) throw new AuthenticationError("profile-not-found");
  return parseUserProfile(uid, snapshot.data());
}

export async function verifyServerRole(idToken: string, expectedRole?: PortalRole) {
  const decodedToken = await getServerAuth().verifyIdToken(idToken);
  const role = decodedToken.role;

  if (!isPortalRole(role)) throw new AuthenticationError("role-mismatch");
  if (expectedRole && role !== expectedRole) throw new AuthenticationError("role-mismatch");
  const profile = verifyProfileRole(await getServerUserProfile(decodedToken.uid), role);

  return {
    uid: decodedToken.uid,
    email: decodedToken.email ?? null,
    role,
    profile,
  };
}
