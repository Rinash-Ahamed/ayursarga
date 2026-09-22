import { FieldValue } from "firebase-admin/firestore";
import { validateHospitalImageUrls } from "@/features/hospitals/images";
import { validateHospitalLocationUrl } from "@/features/hospitals/location";
import { validateHospitalFields } from "@/features/hospitals/validation";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { apiHealth, apiJson } from "@/services/api/server";

export const runtime = "nodejs";

const EDITABLE_FIELDS = new Set([
  "name", "description", "email", "phone", "hospitalPhone1", "hospitalPhone2",
  "address", "city", "district", "state", "imageUrls", "locationUrl",
  "commissionPercentage", "ayursargaRating", "ayursargaReviewNote",
]);

type HospitalAdminAction = "update" | "contract_generated" | "contract_signed" | "deactivate" | "archive";
const HOSPITAL_ADMIN_ACTIONS: readonly HospitalAdminAction[] = ["update", "contract_generated", "contract_signed", "deactivate", "archive"];

export function GET() {
  return apiHealth("/api/admin/hospitals/[hospitalId]", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
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

export async function PATCH(request: Request, context: { params: Promise<{ hospitalId: string }> }) {
  try {
    const { uid: adminUid, firestore } = await requireActiveAdmin(request);
    const body = await request.json().catch(() => null) as { action?: HospitalAdminAction; data?: Record<string, unknown> } | null;
    if (!body?.action || !HOSPITAL_ADMIN_ACTIONS.includes(body.action)) {
      return apiJson({ error: "Select a valid hospital action." }, 400);
    }

    const { hospitalId } = await context.params;
    const hospitalReference = firestore.collection("hospitals").doc(hospitalId);
    const hospitalSnapshot = await hospitalReference.get();
    const hospital = hospitalSnapshot.data();
    if (!hospitalSnapshot.exists || !hospital) return apiJson({ error: "The hospital could not be found." }, 404);

    const now = FieldValue.serverTimestamp();
    let auditAction: HospitalAdminAction | "status_change" = body.action;
    let changes: Record<string, unknown>;

    if (body.action === "update") {
      const input = body.data ?? {};
      const unknownField = Object.keys(input).find((key) => !EDITABLE_FIELDS.has(key));
      if (unknownField) return apiJson({ error: "The hospital update contains an unsupported field." }, 400);

      changes = Object.fromEntries(Object.entries(input).filter(([key]) => EDITABLE_FIELDS.has(key)));
      if (!Object.keys(changes).length) return apiJson({ error: "No hospital changes were provided." }, 400);

      const assessmentOnly = Object.keys(changes).every((key) => key === "ayursargaRating" || key === "ayursargaReviewNote");
      if (assessmentOnly) {
        if (hospital.status !== "active") return apiJson({ error: "Public assessments can be updated only for an Active hospital." }, 409);
        const rating = changes.ayursargaRating;
        const note = changes.ayursargaReviewNote;
        if (rating !== null && (typeof rating !== "number" || !Number.isFinite(rating) || rating < 1 || rating > 5)) {
          return apiJson({ error: "Select an Ayursarga rating between 1 and 5." }, 400);
        }
        if (note !== null && (typeof note !== "string" || note.length > 400)) {
          return apiJson({ error: "The assessment note must be 400 characters or fewer." }, 400);
        }
      } else {
        const merged = { ...hospital, ...changes };
        const profileValidation = validateHospitalFields(merged);
        if (!profileValidation.isValid) {
          return apiJson({ error: Object.values(profileValidation.errors)[0] ?? "Hospital details are invalid." }, 400);
        }
        if ("imageUrls" in changes) {
          if (!Array.isArray(changes.imageUrls)) return apiJson({ error: "Hospital images are invalid." }, 400);
          const images = validateHospitalImageUrls(changes.imageUrls);
          if (images.error) return apiJson({ error: images.error }, 400);
          changes.imageUrls = images.imageUrls;
        }
        if ("locationUrl" in changes) {
          const location = validateHospitalLocationUrl(changes.locationUrl);
          if (location.error) return apiJson({ error: location.error }, 400);
          changes.locationUrl = location.locationUrl;
        }
      }
    } else if (body.action === "contract_generated") {
      if (hospital.status !== "pending") return apiJson({ error: "Contracts can be generated only while the hospital is Pending." }, 409);
      changes = {
        contractStatus: hospital.contractStatus === "signed" ? "signed" : "generated",
        contractGeneratedAt: now,
        contractGeneratedBy: adminUid,
      };
    } else if (body.action === "contract_signed") {
      const contractUrl = String(body.data?.contractUrl ?? "").trim();
      const contractUrl2 = String(body.data?.contractUrl2 ?? "").trim();
      if (hospital.status !== "pending" || !["generated", "signed"].includes(String(hospital.contractStatus))) {
        return apiJson({ error: "Download the contract before confirming that it has been signed." }, 409);
      }
      if (!validContractUrl(contractUrl) || !validContractUrl(contractUrl2)) {
        return apiJson({ error: "Add valid HTTPS links for both signed contracts." }, 400);
      }
      changes = {
        contractStatus: "signed",
        contractSignedAt: hospital.contractSignedAt ?? now,
        contractSignedBy: hospital.contractSignedBy ?? adminUid,
        contractUrl,
        contractSignedAt2: hospital.contractSignedAt2 ?? now,
        contractSignedBy2: hospital.contractSignedBy2 ?? adminUid,
        contractUrl2,
      };
    } else if (body.action === "deactivate") {
      if (hospital.status !== "active") return apiJson({ error: "Only an Active hospital can be deactivated." }, 409);
      auditAction = "status_change";
      changes = { status: "inactive", isPublic: false };
    } else {
      if (hospital.status === "archived") return apiJson({ error: "This hospital is already archived." }, 409);
      changes = { status: "archived", isPublic: false, archivedAt: now, archivedBy: adminUid };
    }

    const auditReference = firestore.collection("auditLogs").doc();
    const auditedChanges = {
      ...changes,
      updatedAt: now,
      updatedBy: adminUid,
      lastAuditId: auditReference.id,
    };
    const batch = firestore.batch();
    batch.update(hospitalReference, auditedChanges);
    batch.set(auditReference, {
      action: auditAction,
      module: "hospitals",
      recordId: hospitalId,
      actorId: adminUid,
      actorRole: "admin",
      previousValues: hospital,
      updatedValues: auditedChanges,
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
    console.error("Admin hospital update failed", error instanceof Error ? error.message : error);
    return apiJson({ error: "We could not update the hospital. Check the server Firebase configuration and try again." }, 503);
  }
}
