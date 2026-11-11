import { withApiTiming } from "@/services/api/timing";
import { FieldValue } from "firebase-admin/firestore";
import { DEFAULT_CENTRE_GUIDELINE_VALUES } from "@/features/hospitals/guidelines";
import { explicitHospitalParticulars, validateHospitalFields } from "@/features/hospitals/validation";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { apiHealth, apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { assertUniqueCreationEmail, DuplicateCreationEmailError } from "@/services/admin/uniqueCreationEmail";

export const runtime = "nodejs";

function handleGET() {
  return apiHealth("/api/admin/hospitals", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

async function handlePOST(request: Request) {
  try {
    const { uid: adminUid, firestore } = await requireActiveAdmin(request);
    const body = await readJsonBody(request, 32_000) as Record<string, unknown> | null;
    if (!body) return apiJson({ error: "Hospital details are required." }, 400);

    const validation = validateHospitalFields(explicitHospitalParticulars(body));
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
      imageUrls: [],
      ayursargaRating: null,
      ayursargaReviewNote: null,
      centreGuidelines: DEFAULT_CENTRE_GUIDELINE_VALUES,
      additionalCentreRules: "",
      facilities: "",
      legalPolicies: "",
      locationUrl: null,
      additionalBystandersAllowed: false,
      maxAdditionalBystanders: 0,
      additionalBystanderCharge: 0,
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

    const hospitalCode = await firestore.runTransaction(async (batch) => {
      const counterReference = firestore.collection("systemSettings").doc("hospitalCreationSequence");
      const counter = await batch.get(counterReference);
      await assertUniqueCreationEmail(batch, firestore, "hospitals", validation.data.email);
      const latest = await batch.get(firestore.collection("hospitals").orderBy("hospitalSequence", "desc").limit(1));
      // Email changes also advance value; keep the display-ID sequence separate.
      const previousSequence = Math.max(counter.data()?.hospitalSequence ?? 0, latest.docs[0]?.data().hospitalSequence ?? 0);
      if (!Number.isSafeInteger(previousSequence) || previousSequence < 0 || previousSequence >= Number.MAX_SAFE_INTEGER) throw new Error("Invalid hospital sequence");
      const hospitalSequence = previousSequence + 1;
      const code = `AH${String(hospitalSequence).padStart(3, "0")}`;
      const savedHospital = { ...hospitalData, hospitalCode: code, hospitalSequence };
      batch.set(counterReference, { value: Number(counter.data()?.value ?? 0) + 1, hospitalSequence,
        updatedAt: now, updatedBy: adminUid, lastAuditId: auditReference.id }, { merge: true });
      batch.create(hospitalReference, savedHospital);
      batch.set(auditReference, {
        action: "create",
        module: "hospitals",
        recordId: hospitalReference.id,
        actorId: adminUid,
        actorRole: "admin",
        previousValues: null,
        updatedValues: savedHospital,
        timestamp: now,
        source: "server",
        device: {
          userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
          platform: null,
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        },
      });
      return code;
    });

    return apiJson({ ok: true, hospitalId: hospitalReference.id, hospitalCode }, 201);
  } catch (error) {
    if (error instanceof DuplicateCreationEmailError) return apiJson({ error: error.message, field: "email" }, error.status);
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("/api/admin/hospitals", error);
    return apiJson({ error: "We could not create the hospital. Check the server Firebase configuration and try again." }, 503);
  }
}

export const GET = withApiTiming("GET /api/admin/hospitals", handleGET);
export const POST = withApiTiming("POST /api/admin/hospitals", handlePOST);
