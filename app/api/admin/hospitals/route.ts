import { FieldValue } from "firebase-admin/firestore";
import { DEFAULT_CENTRE_GUIDELINE_VALUES } from "@/features/hospitals/guidelines";
import { validateHospitalFields } from "@/features/hospitals/validation";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { apiHealth, apiJson } from "@/services/api/server";

export const runtime = "nodejs";

export function GET() {
  return apiHealth("/api/admin/hospitals", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

export async function POST(request: Request) {
  try {
    const { uid: adminUid, firestore } = await requireActiveAdmin(request);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return apiJson({ error: "Hospital details are required." }, 400);

    const validation = validateHospitalFields(body);
    if (!validation.isValid) {
      return apiJson({ error: Object.values(validation.errors)[0] ?? "Hospital details are invalid." }, 400);
    }

    const hospitalReference = firestore.collection("hospitals").doc();
    const auditReference = firestore.collection("auditLogs").doc();
    const now = FieldValue.serverTimestamp();
    const hospitalData = {
      ...validation.data,
      status: "pending",
      isPublic: false,
      contractStatus: "not_generated",
      contractGeneratedAt: null,
      contractGeneratedBy: null,
      contractSignedAt: null,
      contractSignedBy: null,
      contractUrl: null,
      contractSignedAt2: null,
      contractSignedBy2: null,
      contractUrl2: null,
      imageUrls: [],
      ayursargaRating: null,
      ayursargaReviewNote: null,
      centreGuidelines: DEFAULT_CENTRE_GUIDELINE_VALUES,
      additionalCentreRules: "",
      facilities: "",
      legalPolicies: "",
      locationUrl: null,
      activatedAt: null,
      activatedBy: null,
      createdBy: adminUid,
      createdAt: now,
      updatedAt: now,
      updatedBy: adminUid,
      archivedAt: null,
      archivedBy: null,
      lastAuditId: auditReference.id,
    };

    const batch = firestore.batch();
    batch.set(hospitalReference, hospitalData);
    batch.set(auditReference, {
      action: "create",
      module: "hospitals",
      recordId: hospitalReference.id,
      actorId: adminUid,
      actorRole: "admin",
      previousValues: null,
      updatedValues: hospitalData,
      timestamp: now,
      source: "server",
      device: {
        userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
        platform: null,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      },
    });
    await batch.commit();

    return apiJson({ ok: true, hospitalId: hospitalReference.id }, 201);
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    console.error("Hospital creation failed", error instanceof Error ? error.message : error);
    return apiJson({ error: "We could not create the hospital. Check the server Firebase configuration and try again." }, 503);
  }
}
