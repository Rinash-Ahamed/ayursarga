import { FieldValue } from "firebase-admin/firestore";
import { apiHealth, apiJson, logApiError } from "@/services/api/server";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import {
  AdminAuthorizationError,
  requireVerifiedFirebaseUser,
} from "@/services/firebase/adminAuthorization";

export const runtime = "nodejs";

const APPROVED_ADMIN_EMAIL = "info@ayursarga.com";

export function GET() {
  return apiHealth("/api/auth/bootstrap-admin", [
    { name: "firebaseAdmin", ready: isFirebaseAdminReady() },
  ]);
}

export async function POST(request: Request) {
  try {
    const { uid, decoded, firestore } = await requireVerifiedFirebaseUser(request);
    const email = decoded.email?.trim().toLowerCase() ?? "";
    if (email !== APPROVED_ADMIN_EMAIL || decoded.firebase.sign_in_provider !== "password") {
      return apiJson({ error: "This account is not approved for Admin recovery." }, 403);
    }

    const userReference = firestore.collection("users").doc(uid);
    const auditReference = firestore.collection("auditLogs").doc();
    const created = await firestore.runTransaction(async (transaction) => {
      const existingSnapshot = await transaction.get(userReference);
      if (existingSnapshot.exists) {
        const existing = existingSnapshot.data();
        if (
          existing?.uid === uid
          && existing.email?.trim().toLowerCase() === APPROVED_ADMIN_EMAIL
          && existing.role === "admin"
          && existing.status === "active"
        ) return false;
        throw new Error("ADMIN_PROFILE_CONFLICT");
      }

      const now = FieldValue.serverTimestamp();
      const profile = {
        uid,
        name: decoded.name?.trim() || "Ayursarga Admin",
        email,
        phone: null,
        address: null,
        role: "admin",
        status: "active",
        hospitalId: null,
        privacyConsentAt: null,
        privacyConsentVersion: null,
        customerTermsAcceptedAt: null,
        customerTermsVersion: null,
        createdAt: now,
        createdBy: uid,
        updatedAt: now,
        updatedBy: uid,
        archivedAt: null,
        archivedBy: null,
        lastAuditId: auditReference.id,
      };
      transaction.create(userReference, profile);
      transaction.create(auditReference, {
        action: "create",
        module: "users",
        recordId: uid,
        actorId: uid,
        actorRole: "admin",
        previousValues: null,
        updatedValues: profile,
        timestamp: now,
        source: "server",
        device: {
          userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
          platform: null,
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        },
      });
      return true;
    });

    return apiJson({ ok: true, created }, created ? 201 : 200);
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return apiJson({ error: error.message }, error.status);
    }
    if (error instanceof Error && error.message === "ADMIN_PROFILE_CONFLICT") {
      return apiJson({ error: "An existing account profile prevents automatic Admin recovery." }, 409);
    }
    logApiError("/api/auth/bootstrap-admin", error);
    return apiJson({ error: "Admin recovery is temporarily unavailable." }, 503);
  }
}
