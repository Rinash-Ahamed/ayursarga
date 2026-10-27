import { Timestamp } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { validatePackagePayload } from "@/features/hospitals/packages";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { apiHealth, apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { requestAuditDevice } from "@/services/api/audit";

export const runtime = "nodejs";

export function GET() {
  return apiHealth("/api/hospital/services", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

export async function POST(request: Request) {
  try {
    if (!allowRequest(requestFingerprint(request, "hospital-service-create"), 30, 10 * 60 * 1000)) {
      return apiJson({ error: "Too many package updates were sent. Please wait and try again." }, 429);
    }
    const { uid, profile, firestore } = await requireActiveUser(request, ["hospital"]);
    const hospitalId = String(profile.hospitalId ?? "").trim();
    if (!hospitalId) return apiJson({ error: "Your hospital account is not connected correctly." }, 403);
    const value = await readJsonBody(request, 16_000);
    if (!value || typeof value !== "object" || Array.isArray(value)) return apiJson({ error: "Package details are required." }, 400);
    let packageData;
    try {
      packageData = validatePackagePayload(value as Record<string, unknown>);
    } catch (error) {
      return apiJson({ error: error instanceof Error ? error.message : "Check the package details." }, 400);
    }
    const input = value as Record<string, unknown>;
    if (input.requestId !== undefined && (typeof input.requestId !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(input.requestId))) return apiJson({ error: "Refresh the package form before saving this draft." }, 400);
    const serviceReference = input.requestId === undefined
      ? firestore.collection("services").doc()
      : firestore.collection("services").doc(createHash("sha256").update(`${uid}:${hospitalId}:${input.requestId}`).digest("hex"));
    const auditReference = firestore.collection("auditLogs").doc();
    const now = Timestamp.now();
    const service = {
      hospitalId,
      ...packageData,
      status: "inactive",
      reviewStatus: "draft",
      draftPackage: packageData,
      publishedAt: null,
      reviewNote: "",
      createdAt: now,
      createdBy: uid,
      updatedAt: now,
      updatedBy: uid,
      archivedAt: null,
      archivedBy: null,
      lastAuditId: auditReference.id,
    };
    const duplicate = await firestore.runTransaction(async (transaction) => {
      const [hospitalSnapshot, existing] = await transaction.getAll(firestore.collection("hospitals").doc(hospitalId), serviceReference);
      if (!hospitalSnapshot.exists || hospitalSnapshot.data()?.status !== "active") throw new AdminAuthorizationError("Only an active hospital can add packages.", 403);
      if (existing.exists) {
        if (existing.data()?.hospitalId !== hospitalId || existing.data()?.createdBy !== uid) throw new AdminAuthorizationError("This package request is unavailable.", 403);
        return true;
      }
      transaction.create(serviceReference, service);
      transaction.set(auditReference, {
        action: "create", module: "services", recordId: serviceReference.id,
        actorId: uid, actorRole: "hospital", previousValues: null, updatedValues: service,
        timestamp: now, source: "server", device: requestAuditDevice(request),
      });
      return false;
    });
    return apiJson({ ok: true, serviceId: serviceReference.id, duplicate }, duplicate ? 200 : 201);
  } catch (error) {
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("POST /api/hospital/services", error);
    return apiJson({ error: "We could not add the package. Please try again." }, 503);
  }
}
