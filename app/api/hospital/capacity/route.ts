import { Timestamp } from "firebase-admin/firestore";
import { mutationJson } from "@/services/api/mutation";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { apiHealth, apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { requestAuditDevice } from "@/services/api/audit";

export const runtime = "nodejs";

export function GET() {
  return apiHealth("/api/hospital/capacity", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

export async function PATCH(request: Request) {
  try {
    if (!allowRequest(requestFingerprint(request, "hospital-capacity"), 30, 10 * 60 * 1000)) {
      return apiJson({ error: "Too many room updates were sent. Please wait and try again." }, 429);
    }
    const { uid, profile, firestore } = await requireActiveUser(request, ["hospital"]);
    const hospitalId = String(profile.hospitalId ?? "").trim();
    if (!hospitalId) return apiJson({ error: "Your hospital account is not connected correctly." }, 403);
    const value = await readJsonBody(request, 2_000);
    if (!value || typeof value !== "object" || Array.isArray(value)) return apiJson({ error: "Room details are required." }, 400);
    const body = value as Record<string, unknown>;
    const totalRooms = Number(body.totalRooms);
    const occupiedRooms = Number(body.occupiedRooms);
    if (!Number.isInteger(totalRooms) || totalRooms < 0 || totalRooms > 10_000) return apiJson({ error: "Enter a valid total number of rooms." }, 400);
    if (!Number.isInteger(occupiedRooms) || occupiedRooms < 0 || occupiedRooms > totalRooms) {
      return apiJson({ error: "Occupied rooms must be between zero and the total room count." }, 400);
    }
    const capacityReference = firestore.collection("hospitalCapacity").doc(hospitalId);
    const [hospitalSnapshot, capacitySnapshot] = await firestore.getAll(
      firestore.collection("hospitals").doc(hospitalId), capacityReference,
    );
    if (!hospitalSnapshot.exists || hospitalSnapshot.data()?.status !== "active") {
      return apiJson({ error: "Only an active hospital can update room availability." }, 403);
    }
    const previousValues = capacitySnapshot.data() ?? null;
    const auditReference = firestore.collection("auditLogs").doc();
    const now = Timestamp.now();
    const changes = { totalRooms, occupiedRooms };
    const capacity = previousValues
      ? { ...previousValues, ...changes, updatedAt: now, updatedBy: uid, lastAuditId: auditReference.id }
      : {
          hospitalId, ...changes, status: "active", createdAt: now, createdBy: uid,
          updatedAt: now, updatedBy: uid, archivedAt: null, archivedBy: null,
          lastAuditId: auditReference.id,
        };
    const batch = firestore.batch();
    if (previousValues) batch.update(capacityReference, { ...changes, updatedAt: now, updatedBy: uid, lastAuditId: auditReference.id }, { lastUpdateTime: capacitySnapshot.updateTime! });
    else batch.create(capacityReference, capacity);
    batch.set(auditReference, {
      action: previousValues ? "update" : "create",
      module: "hospitalCapacity",
      recordId: hospitalId,
      actorId: uid,
      actorRole: "hospital",
      previousValues,
      updatedValues: capacity,
      timestamp: now,
      source: "server",
      device: requestAuditDevice(request),
    });
    await batch.commit();
    return mutationJson(capacity);
  } catch (error) {
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("PATCH /api/hospital/capacity", error);
    return apiJson({ error: "We could not update room availability. Please try again." }, 503);
  }
}
