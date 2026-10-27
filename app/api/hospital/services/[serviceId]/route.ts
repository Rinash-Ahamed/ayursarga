import { Timestamp } from "firebase-admin/firestore";
import { mutationJson } from "@/services/api/mutation";
import { validatePackagePayload } from "@/features/hospitals/packages";
import { hasPublishedPackage } from "@/features/hospitals/packageReview";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { apiHealth, apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { requestAuditDevice } from "@/services/api/audit";
import { addPackageReviewNotifications, packageReviewRecipients, PackageNotificationError } from "@/services/notifications/packageNotificationsAdmin";

export const runtime = "nodejs";

type ServiceAction = "update" | "status" | "archive" | "submit";

export function GET() {
  return apiHealth("/api/hospital/services/[serviceId]", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

export async function PATCH(request: Request, context: { params: Promise<{ serviceId: string }> }) {
  try {
    if (!allowRequest(requestFingerprint(request, "hospital-service-update"), 50, 10 * 60 * 1000)) {
      return apiJson({ error: "Too many package updates were sent. Please wait and try again." }, 429);
    }
    const { uid, profile, firestore } = await requireActiveUser(request, ["hospital"]);
    const hospitalId = String(profile.hospitalId ?? "").trim();
    if (!hospitalId) return apiJson({ error: "Your hospital account is not connected correctly." }, 403);
    const { serviceId } = await context.params;
    if (!serviceId || serviceId.length > 160 || serviceId.includes("/")) return apiJson({ error: "The package could not be found." }, 404);
    const value = await readJsonBody(request, 16_000);
    if (!value || typeof value !== "object" || Array.isArray(value)) return apiJson({ error: "Package update details are required." }, 400);
    const body = value as { action?: ServiceAction; data?: Record<string, unknown>; expectedAuditId?: string };
    if (!body.action || !["update", "status", "archive", "submit"].includes(body.action)) return apiJson({ error: "Select a valid package action." }, 400);

    const serviceReference = firestore.collection("services").doc(serviceId);
    const [hospitalSnapshot, serviceSnapshot] = await firestore.getAll(
      firestore.collection("hospitals").doc(hospitalId), serviceReference,
    );
    if (!hospitalSnapshot.exists || hospitalSnapshot.data()?.status !== "active") {
      return apiJson({ error: "Only an active hospital can update packages." }, 403);
    }
    const service = serviceSnapshot.data();
    if (!serviceSnapshot.exists || !service || service.hospitalId !== hospitalId) return apiJson({ error: "The package could not be found." }, 404);
    if (service.status === "archived") return apiJson({ error: "An archived package cannot be changed." }, 409);

    if (body.action === "submit" && service.reviewStatus === "pending" && (!body.expectedAuditId || body.expectedAuditId === service.lastAuditId || body.expectedAuditId === service.submittedFromAuditId)) return mutationJson({ reviewStatus: "pending", lastAuditId: service.lastAuditId, submittedAt: service.submittedAt, submittedBy: service.submittedBy });
    if (body.expectedAuditId && body.expectedAuditId !== service.lastAuditId) return apiJson({ error: "This package changed. Refresh and review it before trying again." }, 409);
    let action: "update" | "status_change" | "archive";
    let changes: Record<string, unknown>;
    if (body.action === "update") {
      try {
        changes = {
          draftPackage: validatePackagePayload(body.data ?? {}), reviewStatus: "draft", reviewNote: "",
          // Retain an existing published version while its replacement is reviewed.
          publishedAt: hasPublishedPackage(service) ? service.publishedAt ?? service.createdAt ?? Timestamp.now() : null,
        };
      } catch (error) {
        return apiJson({ error: error instanceof Error ? error.message : "Check the package details." }, 400);
      }
      action = "update";
    } else if (body.action === "submit") {
      if (!service.draftPackage || !["draft", "changes_requested"].includes(service.reviewStatus)) return apiJson({ error: "Save a package draft before submitting it for review." }, 409);
      try { validatePackagePayload(service.draftPackage); } catch (error) { return apiJson({ error: error instanceof Error ? error.message : "Check the package draft." }, 400); }
      changes = { reviewStatus: "pending", submittedAt: Timestamp.now(), submittedBy: uid, submittedFromAuditId: service.lastAuditId, reviewNote: "" };
      action = "update";
    } else if (body.action === "status") {
      const status = body.data?.status;
      if ((status !== "active" && status !== "inactive") || status === service.status) {
        return apiJson({ error: "Choose a different valid package status." }, 400);
      }
      if (status === "active" && !hasPublishedPackage(service)) return apiJson({ error: "Admin must approve this package before it can be published." }, 409);
      changes = { status };
      action = "status_change";
    } else {
      changes = { status: "archived", archivedAt: Timestamp.now(), archivedBy: uid };
      action = "archive";
    }
    const auditReference = firestore.collection("auditLogs").doc();
    const now = Timestamp.now();
    const metadata = { updatedAt: now, updatedBy: uid, lastAuditId: auditReference.id };
    const updatedValues = { ...service, ...changes, ...metadata };
    const recipients = body.action === "submit" ? await packageReviewRecipients(firestore) : [];
    const batch = firestore.batch();
    batch.update(serviceReference, { ...changes, ...metadata }, { lastUpdateTime: serviceSnapshot.updateTime! });
    batch.set(auditReference, {
      action, module: "services", recordId: serviceId,
      actorId: uid, actorRole: "hospital", previousValues: service, updatedValues,
      timestamp: now, source: "server", device: requestAuditDevice(request),
    });
    if (body.action === "submit") addPackageReviewNotifications(batch, firestore, {
      recipients, role: "admin", hospitalId, packageId: serviceId, actorId: uid, auditId: auditReference.id, now,
      title: "Package approval requested", message: `${hospitalSnapshot.data()?.name ?? "Hospital"} submitted ${service.draftPackage.name} for your review.`,
    });
    await batch.commit();
    return mutationJson({ ...changes, ...metadata });
  } catch (error) {
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    if (error instanceof PackageNotificationError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("PATCH /api/hospital/services/[serviceId]", error);
    return apiJson({ error: "We could not update the package. Please try again." }, 503);
  }
}
