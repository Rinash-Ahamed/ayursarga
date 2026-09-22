import { FieldValue } from "firebase-admin/firestore";
import { validateHospitalFields } from "@/features/hospitals/validation";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { apiHealth, apiJson } from "@/services/api/server";

export const runtime = "nodejs";

export function GET() {
  return apiHealth("/api/admin/hospitals/[hospitalId]/activate", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

function validContractUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request, context: { params: Promise<{ hospitalId: string }> }) {
  try {
    const { uid: adminUid, firestore } = await requireActiveAdmin(request);
    const { hospitalId } = await context.params;
    const hospitalReference = firestore.collection("hospitals").doc(hospitalId);
    const hospitalSnapshot = await hospitalReference.get();
    const hospital = hospitalSnapshot.data();

    if (!hospitalSnapshot.exists || !hospital) return apiJson({ error: "The hospital could not be found." }, 404);
    if (hospital.status !== "pending" && hospital.status !== "inactive") {
      return apiJson({ error: "Only a Pending or Inactive hospital can be activated." }, 409);
    }

    const profileValidation = validateHospitalFields(hospital);
    if (!profileValidation.isValid) {
      return apiJson({
        error: `Complete the hospital profile before activation: ${Object.values(profileValidation.errors)[0] ?? "required details are missing."}`,
      }, 409);
    }
    if (hospital.contractStatus !== "signed"
      || !hospital.contractSignedAt
      || !hospital.contractSignedAt2
      || !validContractUrl(hospital.contractUrl)
      || !validContractUrl(hospital.contractUrl2)) {
      return apiJson({ error: "Confirm both signed contracts, URLs, and signing dates before activation." }, 409);
    }

    const auditReference = firestore.collection("auditLogs").doc();
    const now = FieldValue.serverTimestamp();
    const changes = {
      status: "active",
      isPublic: true,
      activatedAt: now,
      activatedBy: adminUid,
      updatedAt: now,
      updatedBy: adminUid,
      lastAuditId: auditReference.id,
    };
    const batch = firestore.batch();
    batch.update(hospitalReference, changes);
    batch.set(auditReference, {
      action: "hospital_activated",
      module: "hospitals",
      recordId: hospitalId,
      actorId: adminUid,
      actorRole: "admin",
      previousValues: hospital,
      updatedValues: changes,
      timestamp: now,
      source: "server",
      device: {
        userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
        platform: null,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      },
    });
    await batch.commit();

    return apiJson({ ok: true });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    console.error("Hospital activation failed", error instanceof Error ? error.message : error);
    return apiJson({ error: "We could not activate the hospital. Check the server Firebase configuration and try again." }, 503);
  }
}
