import { Timestamp } from "firebase-admin/firestore";
import { validatePackagePayload } from "@/features/hospitals/packages";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { apiHealth, apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { requestAuditDevice } from "@/services/api/audit";

export const runtime = "nodejs";

type ServiceAction = "update" | "status" | "archive";

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
    const hospitalSnapshot = await firestore.collection("hospitals").doc(hospitalId).get();
    if (!hospitalSnapshot.exists || hospitalSnapshot.data()?.status !== "active") {
      return apiJson({ error: "Only an active hospital can update packages." }, 403);
    }
    const { serviceId } = await context.params;
    if (!serviceId || serviceId.length > 160 || serviceId.includes("/")) return apiJson({ error: "The package could not be found." }, 404);
    const value = await readJsonBody(request, 16_000);
    if (!value || typeof value !== "object" || Array.isArray(value)) return apiJson({ error: "Package update details are required." }, 400);
    const body = value as { action?: ServiceAction; data?: Record<string, unknown> };
    if (!body.action || !["update", "status", "archive"].includes(body.action)) return apiJson({ error: "Select a valid package action." }, 400);

    const serviceReference = firestore.collection("services").doc(serviceId);
    const serviceSnapshot = await serviceReference.get();
    const service = serviceSnapshot.data();
    if (!serviceSnapshot.exists || !service || service.hospitalId !== hospitalId) return apiJson({ error: "The package could not be found." }, 404);
    if (service.status === "archived") return apiJson({ error: "An archived package cannot be changed." }, 409);

    let action: "update" | "status_change" | "archive";
    let changes: Record<string, unknown>;
    if (body.action === "update") {
      try {
        changes = validatePackagePayload(body.data ?? {});
      } catch (error) {
        return apiJson({ error: error instanceof Error ? error.message : "Check the package details." }, 400);
      }
      action = "update";
    } else if (body.action === "status") {
      const status = body.data?.status;
      if ((status !== "active" && status !== "inactive") || status === service.status) {
        return apiJson({ error: "Choose a different valid package status." }, 400);
      }
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
    const batch = firestore.batch();
    batch.update(serviceReference, { ...changes, ...metadata });
    batch.set(auditReference, {
      action, module: "services", recordId: serviceId,
      actorId: uid, actorRole: "hospital", previousValues: service, updatedValues,
      timestamp: now, source: "server", device: requestAuditDevice(request),
    });
    await batch.commit();
    return apiJson({ ok: true });
  } catch (error) {
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("PATCH /api/hospital/services/[serviceId]", error);
    return apiJson({ error: "We could not update the package. Please try again." }, 503);
  }
}
