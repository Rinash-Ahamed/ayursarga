import { Timestamp } from "firebase-admin/firestore";
import { DEFAULT_CENTRE_GUIDELINE_VALUES } from "@/features/hospitals/guidelines";
import { MAX_ADDITIONAL_BYSTANDERS } from "@/features/hospitals/bystanders";
import { validateHospitalFields } from "@/features/hospitals/validation";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { apiHealth, apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { requestAuditDevice } from "@/services/api/audit";

export const runtime = "nodejs";

const PROFILE_FIELDS = [
  "name", "description", "email", "phone", "hospitalPhone1", "hospitalPhone2",
  "registeredAddress", "address", "city", "district", "state", "centreGuidelines",
  "additionalCentreRules", "facilities", "legalPolicies", "additionalBystandersAllowed",
  "maxAdditionalBystanders", "additionalBystanderCharge",
] as const;

const GUIDELINE_IDS = Object.keys(DEFAULT_CENTRE_GUIDELINE_VALUES) as Array<keyof typeof DEFAULT_CENTRE_GUIDELINE_VALUES>;

export function GET() {
  return apiHealth("/api/hospital/profile", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

function limitedText(value: unknown, maximum: number, label: string) {
  if (typeof value !== "string") throw new RequestBodyError(`${label} is invalid.`, 400);
  const normalized = value.trim();
  if (normalized.length > maximum) throw new RequestBodyError(`${label} must be ${maximum.toLocaleString("en-IN")} characters or fewer.`, 400);
  return normalized;
}

function validatedGuidelines(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestBodyError("Centre guidelines are invalid.", 400);
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !GUIDELINE_IDS.includes(key as keyof typeof DEFAULT_CENTRE_GUIDELINE_VALUES))) {
    throw new RequestBodyError("Centre guidelines contain an unsupported field.", 400);
  }
  return Object.fromEntries(GUIDELINE_IDS.map((id) => [
    id,
    limitedText(input[id] ?? DEFAULT_CENTRE_GUIDELINE_VALUES[id], 1_200, "Each centre guideline")
      || DEFAULT_CENTRE_GUIDELINE_VALUES[id],
  ]));
}

function validatedBystanderPolicy(body: Record<string, unknown>) {
  if (body.additionalBystandersAllowed !== true) {
    return {
      additionalBystandersAllowed: false,
      maxAdditionalBystanders: 0,
      additionalBystanderCharge: 0,
    };
  }
  const maximum = Number(body.maxAdditionalBystanders);
  const charge = Number(body.additionalBystanderCharge);
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > MAX_ADDITIONAL_BYSTANDERS) {
    throw new RequestBodyError("Choose a valid number of additional bystanders.", 400);
  }
  if (!Number.isFinite(charge) || charge <= 0 || charge > 1_000_000) {
    throw new RequestBodyError("Enter a valid additional bystander charge.", 400);
  }
  return {
    additionalBystandersAllowed: true,
    maxAdditionalBystanders: maximum,
    additionalBystanderCharge: Math.round(charge * 100) / 100,
  };
}

export async function PATCH(request: Request) {
  try {
    if (!allowRequest(requestFingerprint(request, "hospital-profile"), 30, 10 * 60 * 1000)) {
      return apiJson({ error: "Too many profile updates were sent. Please wait and try again." }, 429);
    }
    const { uid, profile, firestore } = await requireActiveUser(request, ["hospital"]);
    const hospitalId = String(profile.hospitalId ?? "").trim();
    if (!hospitalId) return apiJson({ error: "Your hospital account is not connected correctly." }, 403);

    const value = await readJsonBody(request, 40_000);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return apiJson({ error: "Hospital profile details are required." }, 400);
    }
    const body = value as Record<string, unknown>;
    const unsupportedField = Object.keys(body).find((key) => !PROFILE_FIELDS.includes(key as typeof PROFILE_FIELDS[number]));
    if (unsupportedField) return apiJson({ error: "The profile update contains an unsupported field." }, 400);

    const hospitalReference = firestore.collection("hospitals").doc(hospitalId);
    const hospitalSnapshot = await hospitalReference.get();
    const hospital = hospitalSnapshot.data();
    if (!hospitalSnapshot.exists || !hospital) return apiJson({ error: "Your hospital profile could not be found." }, 404);
    if (hospital.status !== "active") return apiJson({ error: "Only an active hospital can update its profile." }, 403);

    const validation = validateHospitalFields({
      ...body,
      legalName: hospital.legalName ?? hospital.name,
      imageUrl: hospital.imageUrl ?? null,
      commissionPercentage: hospital.commissionPercentage,
    });
    if (!validation.isValid) {
      return apiJson({ error: Object.values(validation.errors)[0] ?? "Check the hospital profile details." }, 400);
    }

    const changes = {
      name: validation.data.name,
      description: validation.data.description,
      email: validation.data.email,
      phone: validation.data.phone,
      hospitalPhone1: validation.data.hospitalPhone1,
      hospitalPhone2: validation.data.hospitalPhone2,
      registeredAddress: validation.data.registeredAddress,
      address: validation.data.address,
      city: validation.data.city,
      district: validation.data.district,
      state: validation.data.state,
      centreGuidelines: validatedGuidelines(body.centreGuidelines),
      additionalCentreRules: limitedText(body.additionalCentreRules, 4_000, "Additional centre rules"),
      facilities: limitedText(body.facilities, 4_000, "Facilities"),
      legalPolicies: limitedText(body.legalPolicies, 4_000, "Legal and policy information"),
      ...validatedBystanderPolicy(body),
    };
    const auditReference = firestore.collection("auditLogs").doc();
    const now = Timestamp.now();
    const metadata = { updatedAt: now, updatedBy: uid, lastAuditId: auditReference.id };
    const updatedValues = { ...hospital, ...changes, ...metadata };
    const batch = firestore.batch();
    batch.update(hospitalReference, { ...changes, ...metadata });
    batch.set(auditReference, {
      action: "update",
      module: "hospitals",
      recordId: hospitalId,
      actorId: uid,
      actorRole: "hospital",
      previousValues: hospital,
      updatedValues,
      timestamp: now,
      source: "server",
      device: requestAuditDevice(request),
    });
    await batch.commit();
    return apiJson({ ok: true });
  } catch (error) {
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("PATCH /api/hospital/profile", error);
    return apiJson({ error: "We could not save the hospital profile. Please try again." }, 503);
  }
}
