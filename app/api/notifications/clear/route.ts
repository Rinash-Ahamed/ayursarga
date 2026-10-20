import { Timestamp } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { requestAuditDevice } from "@/services/api/audit";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid, role, firestore } = await requireActiveUser(request, ["admin", "hospital"]);
    if (!allowRequest(requestFingerprint(request, `notification-clear:${uid}`), 30, 10 * 60 * 1000)) return apiJson({ error: "Please wait before clearing notifications again." }, 429);
    const body = await readJsonBody(request, 1_000) as { confirmed?: unknown } | null;
    if (body?.confirmed !== true) return apiJson({ error: "Confirm before clearing notifications." }, 400);
    // A per-user dismissal boundary keeps the whole history intact. No looping
    // deletes/archives, and a notification arriving after this point stays new.
    const cutoff = Timestamp.now();
    const clearedThrough = await firestore.runTransaction(async (transaction) => {
      const reference = firestore.collection("notificationInboxes").doc(uid);
      const snapshot = await transaction.get(reference);
      const previous = snapshot.data();
      const prior = previous?.clearedThrough as Timestamp | undefined;
      if (prior && (prior.seconds > cutoff.seconds || (prior.seconds === cutoff.seconds && prior.nanoseconds >= cutoff.nanoseconds))) return prior;
      const audit = firestore.collection("auditLogs").doc();
      const data = {
        ...(previous ?? {}), recipientId: uid, clearedThrough: cutoff,
        createdAt: previous?.createdAt ?? cutoff, createdBy: previous?.createdBy ?? uid,
        updatedAt: cutoff, updatedBy: uid, archivedAt: null, archivedBy: null, lastAuditId: audit.id,
      };
      transaction.set(reference, data);
      transaction.create(audit, {
        action: "update", module: "notificationInboxes", recordId: uid, actorId: uid, actorRole: role,
        previousValues: previous ?? null, updatedValues: data, timestamp: cutoff, source: "server", device: requestAuditDevice(request),
      });
      return cutoff;
    });
    return apiJson({ ok: true, clearedThrough: { seconds: clearedThrough.seconds, nanoseconds: clearedThrough.nanoseconds } });
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    logApiError("POST /api/notifications/clear", error);
    return apiJson({ error: "We could not clear your notifications. Please try again." }, 503);
  }
}
