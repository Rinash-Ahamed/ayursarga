import "server-only";

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

export async function requireActiveAdmin(request: Request) {
  return requireActiveRole(request, "admin");
}

export async function requireActiveConsumer(request: Request) {
  return requireActiveRole(request, "consumer");
}

async function requireActiveRole(request: Request, expectedRole: "admin" | "consumer") {
  const token = bearerToken(request);
  const roleLabel = expectedRole === "admin" ? "Admin" : "Consumer";
  if (!token) throw new AdminAuthorizationError(`${roleLabel} authentication is required.`, 401);
  try {
    const auth = getFirebaseAdminAuth();
    const firestore = getFirebaseAdminFirestore();
    const decoded = await auth.verifyIdToken(token, true);
    const profileSnapshot = await firestore.collection("users").doc(decoded.uid).get();
    const profile = profileSnapshot.data();
    if (!profileSnapshot.exists || profile?.role !== expectedRole || profile.status !== "active") {
      throw new AdminAuthorizationError(`Only an active ${roleLabel} can complete this action.`, 403);
    }
    return { uid: decoded.uid, auth, firestore };
  } catch (error) {
    if (error instanceof AdminAuthorizationError) throw error;
    throw new AdminAuthorizationError(`Your ${roleLabel} session is invalid or has expired.`, 401);
  }
}
