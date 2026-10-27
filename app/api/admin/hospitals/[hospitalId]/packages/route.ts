import { Timestamp } from "firebase-admin/firestore";
import { validatePackagePayload } from "@/features/hospitals/packages";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { mutationJson } from "@/services/api/mutation";
import { apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { requestAuditDevice } from "@/services/api/audit";
import { addPackageReviewNotifications, packageReviewRecipients, PackageNotificationError } from "@/services/notifications/packageNotificationsAdmin";

export const runtime = "nodejs";
class ReviewError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
const validId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 160 && !value.includes("/");

/** A bounded, atomic hospital-scoped review; never approve an unseen revision. */
export async function POST(request: Request, context: { params: Promise<{ hospitalId: string }> }) {
  try {
    if (!allowRequest(requestFingerprint(request, "admin-package-review"), 50, 10 * 60 * 1000)) return apiJson({ error: "Too many reviews. Please wait and try again." }, 429);
    const { uid, firestore } = await requireActiveUser(request, ["admin"]);
    const { hospitalId } = await context.params;
    if (!validId(hospitalId)) return apiJson({ error: "Hospital not found." }, 404);
    const body = await readJsonBody(request, 12_000) as { action?: unknown; packages?: unknown; reason?: unknown } | null;
    if (!body || (body.action !== "approve" && body.action !== "request_changes") || !Array.isArray(body.packages) || body.packages.length < 1 || body.packages.length > 20) return apiJson({ error: "Select between 1 and 20 packages from this hospital." }, 400);
    const entries: { id: string; auditId: string }[] = [];
    for (const entry of body.packages) {
      if (!entry || !validId(entry.id) || !validId(entry.auditId) || entries.some((item) => item.id === entry.id)) return apiJson({ error: "Select unique packages with their current review revisions." }, 400);
      entries.push({ id: entry.id, auditId: entry.auditId });
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length > 1000 || (body.action === "request_changes" && !reason)) return apiJson({ error: "Enter a reason for the requested changes (up to 1,000 characters)." }, 400);
    const refs = entries.map((item) => firestore.collection("services").doc(item.id));
    const recipients = await packageReviewRecipients(firestore, hospitalId);
    const result = await firestore.runTransaction(async (transaction) => {
      const [hospital, ...snapshots] = await transaction.getAll(firestore.collection("hospitals").doc(hospitalId), ...refs);
      if (!hospital.exists || hospital.data()?.status !== "active") throw new ReviewError("Only an active hospital's packages can be reviewed.", 409);
      const now = Timestamp.now();
      const updates: Record<string, Record<string, unknown>> = {};
      // Complete validation of every selected record before staging any writes.
      const reviews = snapshots.map((snapshot, index) => {
        const service = snapshot.data();
        const expected = entries[index];
        if (!snapshot.exists || !service || service.hospitalId !== hospitalId) throw new ReviewError("A selected package does not belong to this hospital.", 404);
        if (service.status === "archived") throw new ReviewError("An archived package cannot be reviewed.", 409);
        const target = body.action === "approve" ? "approved" : "changes_requested";
        if (service.reviewStatus === target && service.reviewedRequestAuditId === expected.auditId) {
          updates[snapshot.id] = service;
          return null;
        }
        if (service.reviewStatus !== "pending" || service.lastAuditId !== expected.auditId || !service.draftPackage) throw new ReviewError("A package changed since you opened it. Refresh and review the latest request.", 409);
        let draft;
        try { draft = validatePackagePayload(service.draftPackage); } catch { throw new ReviewError("A package draft is invalid. Ask the hospital to correct and resubmit it.", 400); }
        const audit = firestore.collection("auditLogs").doc();
        const changes = {
          ...(body.action === "approve" ? { ...draft, draftPackage: null, status: "active", publishedAt: now } : {}),
          reviewStatus: target, reviewedAt: now, reviewedBy: uid, reviewNote: body.action === "approve" ? "" : reason,
          reviewedRequestAuditId: expected.auditId, updatedAt: now, updatedBy: uid, lastAuditId: audit.id,
        };
        return { snapshot, service, audit, changes };
      });
      reviews.forEach((review) => {
        if (!review) return;
        const { snapshot, service, audit, changes } = review;
        transaction.update(snapshot.ref, changes);
        transaction.set(audit, { action: "update", module: "services", recordId: snapshot.id, actorId: uid, actorRole: "admin", previousValues: service, updatedValues: { ...service, ...changes }, timestamp: now, source: "server", device: requestAuditDevice(request) });
        addPackageReviewNotifications(transaction, firestore, {
          recipients, role: "hospital", hospitalId, packageId: snapshot.id, actorId: uid, auditId: audit.id, now,
          title: body.action === "approve" ? "Package approved" : "Package changes requested",
          message: body.action === "approve" ? `${service.draftPackage.name} has been approved and published.` : `${service.draftPackage.name}: ${reason}`,
        });
        updates[snapshot.id] = changes;
      });
      return updates;
    });
    return mutationJson({ packages: result });
  } catch (error) {
    if (error instanceof RequestBodyError || error instanceof AdminAuthorizationError || error instanceof ReviewError || error instanceof PackageNotificationError) return apiJson({ error: error.message }, error.status);
    logApiError("POST /api/admin/hospitals/:hospitalId/packages", error);
    return apiJson({ error: "We could not save the review. Refresh and try again." }, 503);
  }
}
