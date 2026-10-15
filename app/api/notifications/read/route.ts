import { Timestamp } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { apiHealth, apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";

export const runtime = "nodejs";

export function GET() {
  return apiHealth("/api/notifications/read", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

export async function PATCH(request: Request) {
  try {
    if (!allowRequest(requestFingerprint(request, "notification-read"), 80, 10 * 60 * 1000)) {
      return apiJson({ error: "Too many notification updates were sent. Please wait and try again." }, 429);
    }
    const { uid, firestore } = await requireActiveUser(request);
    const value = await readJsonBody(request, 4_000);
    if (!value || typeof value !== "object" || Array.isArray(value)) return apiJson({ error: "Notification details are required." }, 400);
    const body = value as Record<string, unknown>;
    const ids = Array.isArray(body.notificationIds)
      ? [...new Set(body.notificationIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 160 && !id.includes("/")))]
      : [];
    if (!ids.length || ids.length > 20) return apiJson({ error: "Choose between one and twenty notifications." }, 400);
    const references = ids.map((id) => firestore.collection("notifications").doc(id));
    const snapshots = await firestore.getAll(...references);
    if (snapshots.some((snapshot) => !snapshot.exists || snapshot.data()?.recipientId !== uid)) {
      return apiJson({ error: "A notification could not be found." }, 404);
    }
    const now = Timestamp.now();
    const batch = firestore.batch();
    snapshots.forEach((snapshot) => {
      if (!snapshot.data()?.readAt) batch.update(snapshot.ref, { readAt: now, updatedAt: now, updatedBy: uid });
    });
    await batch.commit();
    return apiJson({ ok: true });
  } catch (error) {
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("PATCH /api/notifications/read", error);
    return apiJson({ error: "We could not update the notifications. Please try again." }, 503);
  }
}
