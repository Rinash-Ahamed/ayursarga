import { withApiTiming } from "@/services/api/timing";
import { Timestamp } from "firebase-admin/firestore";
import { mutationJson } from "@/services/api/mutation";
import { validateHospitalImageUrls, hasMinimumHospitalImages, MIN_PUBLIC_HOSPITAL_IMAGES } from "@/features/hospitals/images";
import { validateHospitalLocationUrl } from "@/features/hospitals/location";
import { explicitHospitalParticulars, validateHospitalFields } from "@/features/hospitals/validation";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { apiHealth, apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { validateHospitalContractDetails } from "@/features/hospitals/contractDetails";
import { hospitalContractContent, hospitalContractRevision, validContractUrl } from "@/features/hospitals/contractApproval";
import { assertUniqueCreationEmail, DuplicateCreationEmailError } from "@/services/admin/uniqueCreationEmail";
import { assertHospitalLoginEmailAvailable, ProvisioningError, syncPortalAccountAccess } from "@/services/auth/provisioning";

export const runtime = "nodejs";

const EDITABLE_FIELDS = new Set([
  "legalName", "name", "description", "email", "phone", "hospitalPhone1", "hospitalPhone2",
  "registeredAddress", "address", "city", "district", "state", "imageUrls", "locationUrl",
  "commissionPercentage", "ayursargaRating", "ayursargaReviewNote",
  "registrationNumber", "cinNumber", "panNumber", "gstin",
  "contractEffectiveDate", "contractExpiryDate", "emergencyContact", "emergencyReferralHospital",
]);

type HospitalAdminAction = "update" | "contract_generated" | "contract_signed" | "deactivate" | "archive" | "approve_email" | "reject_email";
const HOSPITAL_ADMIN_ACTIONS: readonly HospitalAdminAction[] = ["update", "contract_generated", "contract_signed", "deactivate", "archive", "approve_email", "reject_email"];

function handleGET() {
  return apiHealth("/api/admin/hospitals/[hospitalId]", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

async function handlePATCH(request: Request, context: { params: Promise<{ hospitalId: string }> }) {
  try {
    const { uid: adminUid, auth, firestore } = await requireActiveAdmin(request);
    const body = await readJsonBody(request, 32_000) as { action?: HospitalAdminAction; data?: Record<string, unknown> } | null;
    if (!body?.action || !HOSPITAL_ADMIN_ACTIONS.includes(body.action)) {
      return apiJson({ error: "Select a valid hospital action." }, 400);
    }

    const { hospitalId } = await context.params;
    if (!hospitalId || hospitalId.length > 160 || hospitalId.includes("/")) return apiJson({ error: "The hospital could not be found." }, 404);
    const hospitalReference = firestore.collection("hospitals").doc(hospitalId);
    const hospitalSnapshot = await hospitalReference.get();
    const hospital = hospitalSnapshot.data();
    if (!hospitalSnapshot.exists || !hospital) return apiJson({ error: "The hospital could not be found." }, 404);

    const now = Timestamp.now();
    let auditAction = body.action as string;
    let changes: Record<string, unknown>;

    if (body.action === "update") {
      const input = body.data ?? {};
      const unknownField = Object.keys(input).find((key) => !EDITABLE_FIELDS.has(key));
      if (unknownField) return apiJson({ error: "The hospital update contains an unsupported field." }, 400);

      changes = Object.fromEntries(Object.entries(input).filter(([key]) => EDITABLE_FIELDS.has(key)));
      if (!Object.keys(changes).length) return apiJson({ error: "No hospital changes were provided." }, 400);

      const contractFields = [
        "registrationNumber", "cinNumber", "panNumber", "gstin",
        "contractEffectiveDate", "contractExpiryDate", "emergencyContact", "emergencyReferralHospital",
      ];
      const assessmentOnly = Object.keys(changes).every((key) => key === "ayursargaRating" || key === "ayursargaReviewNote");
      const contractOnly = Object.keys(changes).every((key) => contractFields.includes(key));
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
      } else if (contractOnly) {
        const contractValidation = validateHospitalContractDetails({ ...hospital, ...changes });
        if (!contractValidation.isValid) {
          return apiJson({ error: Object.values(contractValidation.errors)[0] ?? "Contract particulars are invalid." }, 400);
        }
        Object.assign(changes, contractValidation.data);
      } else {
        const merged = { ...hospital, ...explicitHospitalParticulars(changes) };
        const profileValidation = validateHospitalFields(merged);
        if (!profileValidation.isValid) {
          return apiJson({ error: Object.values(profileValidation.errors)[0] ?? "Hospital details are invalid." }, 400);
        }
        if (Object.hasOwn(changes, "email")) changes.email = profileValidation.data.email;
        if ("imageUrls" in changes) {
          if (!Array.isArray(changes.imageUrls)) return apiJson({ error: "Hospital images are invalid." }, 400);
          const images = validateHospitalImageUrls(changes.imageUrls);
          if (images.error) return apiJson({ error: images.error }, 400);
          changes.imageUrls = images.imageUrls;
          if (hospital.status === "active" && hospital.isPublic === true && !hasMinimumHospitalImages({ imageUrls: images.imageUrls })) return apiJson({ error: `A public hospital must keep at least ${MIN_PUBLIC_HOSPITAL_IMAGES} different images.` }, 409);
        }
        if ("locationUrl" in changes) {
          const location = validateHospitalLocationUrl(changes.locationUrl);
          if (location.error) return apiJson({ error: location.error }, 400);
          changes.locationUrl = location.locationUrl;
        }
        if (contractFields.some((field) => Object.hasOwn(changes, field))) {
          const contractValidation = validateHospitalContractDetails(merged);
          if (!contractValidation.isValid) {
            return apiJson({ error: Object.values(contractValidation.errors)[0] ?? "Contract particulars are invalid." }, 400);
          }
          Object.assign(changes, contractValidation.data);
        }
      }
      if (hospital.status === "pending" && ["generated", "signed"].includes(String(hospital.contractStatus))
        && hospitalContractContent(hospital) !== hospitalContractContent({ ...hospital, ...changes })) {
        // Retain the earlier document and dates, but never reuse their approval
        // for changed legal/commercial particulars.
        changes.contractNeedsRegeneration = true;
      }
    } else if (body.action === "approve_email" || body.action === "reject_email") {
      if (hospital.status === "archived" || !hospital.pendingOfficialEmail
        || body.data?.expectedEmail !== hospital.pendingOfficialEmail || body.data?.expectedAuditId !== hospital.lastAuditId) {
        return apiJson({ error: "This email request changed. Refresh the hospital before reviewing it." }, 409);
      }
      auditAction = "update";
      changes = { pendingOfficialEmail: null, pendingOfficialEmailRequestedAt: null, pendingOfficialEmailRequestedBy: null };
      if (body.action === "approve_email") {
        const validation = validateHospitalFields({ ...hospital, email: hospital.pendingOfficialEmail });
        if (!validation.isValid) return apiJson({ error: "Check the hospital details before approving its email." }, 400);
        changes.email = validation.data.email;
      }
    } else if (body.action === "contract_generated") {
      if (hospital.status !== "pending") return apiJson({ error: "Contracts can be generated only while the hospital is Pending." }, 409);
      if (body.data?.expectedContent !== hospitalContractContent(hospital)) return apiJson({ error: "Hospital details changed. Close the preview and preview the latest contract before downloading." }, 409);
      const particulars = validateHospitalContractDetails(hospital);
      const profile = validateHospitalFields(hospital);
      if (!particulars.isValid || !profile.isValid) return apiJson({ error: "Complete and save the hospital and contract particulars before generating the agreement." }, 409);
      const content = hospitalContractContent(hospital);
      changes = {
        contractStatus: hospital.contractStatus === "signed" && hospital.contractSignedContent === content ? "signed" : "generated",
        contractGeneratedAt: now,
        contractGeneratedBy: adminUid,
        contractGeneratedContent: content,
        contractNeedsRegeneration: false,
      };
    } else if (body.action === "contract_signed") {
      const contractUrl = String(body.data?.contractUrl ?? "").trim();
      if (hospital.status !== "pending" || !["generated", "signed"].includes(String(hospital.contractStatus))) {
        return apiJson({ error: "Download the contract before confirming that it has been signed." }, 409);
      }
      if (!validContractUrl(contractUrl)) {
        return apiJson({ error: "Add a valid HTTPS link for the signed contract." }, 400);
      }
      const content = hospitalContractContent(hospital);
      if (hospital.contractNeedsRegeneration === true || body.data?.expectedContent !== content
        || (hospital.contractGeneratedContent != null && hospital.contractGeneratedContent !== content)) {
        return apiJson({ error: "The contract particulars changed. Generate the latest agreement and obtain its signature before continuing." }, 409);
      }
      const sameSignedRevision = hospital.contractStatus === "signed"
        && (hospital.contractSignedContent === content || hospital.contractSignedContent == null && hospital.contractGeneratedContent == null);
      changes = {
        contractStatus: "signed",
        contractSignedAt: sameSignedRevision ? hospital.contractSignedAt ?? now : now,
        contractSignedBy: sameSignedRevision ? hospital.contractSignedBy ?? adminUid : adminUid,
        contractUrl,
        contractGeneratedContent: content,
        contractSignedContent: content,
        contractNeedsRegeneration: false,
      };
    } else if (body.action === "deactivate") {
      if (hospital.status !== "active") return apiJson({ error: "Only an Active hospital can be deactivated." }, 409);
      auditAction = "status_change";
      changes = { status: "inactive", isPublic: false };
    } else {
      if (hospital.status === "archived") return apiJson({ error: "This hospital is already archived." }, 409);
      changes = { status: "archived", isPublic: false, archivedAt: now, archivedBy: adminUid };
    }

    const officialEmailChanged = Object.hasOwn(changes, "email")
      && String(changes.email).trim().toLowerCase() !== String(hospital.email ?? "").trim().toLowerCase();
    if (officialEmailChanged) Object.assign(changes, { pendingOfficialEmail: null, pendingOfficialEmailRequestedAt: null, pendingOfficialEmailRequestedBy: null });
    if (officialEmailChanged) await assertHospitalLoginEmailAvailable(auth, firestore, hospitalId, String(changes.email));
    const auditReference = firestore.collection("auditLogs").doc();
    const auditedChanges = {
      ...changes,
      updatedAt: now,
      updatedBy: adminUid,
      lastAuditId: auditReference.id,
    };
    const affectedAuthUids = await firestore.runTransaction(async batch => {
    const current = (await batch.get(hospitalReference)).data();
    if (!current || current.lastAuditId !== hospital.lastAuditId) throw new ProvisioningError("Hospital details changed. Refresh before saving again.");
    const counterReference = firestore.collection("systemSettings").doc("hospitalCreationSequence");
    const counter = officialEmailChanged ? await batch.get(counterReference) : null;
    if (officialEmailChanged) await assertUniqueCreationEmail(batch, firestore, "hospitals", String(changes.email), hospitalId);
    const closesHospitalAccess = body.action === "deactivate" || body.action === "archive" || officialEmailChanged;
    const linkedUsers = closesHospitalAccess ? await batch.get(firestore.collection("users").where("hospitalId", "==", hospitalId).limit(21)) : null;
    if (linkedUsers && linkedUsers.docs.length > 20) throw new ProvisioningError("This hospital's login accounts need a project-owner review before changing access.");
    if (counter) batch.set(counterReference, { value: Number(counter.data()?.value ?? 0) + 1, updatedAt: now, updatedBy: adminUid, lastAuditId: auditReference.id }, { merge: true });
    batch.update(hospitalReference, auditedChanges, { lastUpdateTime: hospitalSnapshot.updateTime! });
    batch.set(auditReference, {
      action: auditAction,
      module: "hospitals",
      recordId: hospitalId,
      actorId: adminUid,
      actorRole: "admin",
      previousValues: hospital,
      updatedValues: { ...hospital, ...auditedChanges },
      timestamp: now,
      source: "server",
      device: {
        userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
        platform: null,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      },
    });
    if (body.action === "contract_generated" || body.action === "contract_signed" || changes.contractNeedsRegeneration === true) {
      batch.set(firestore.collection("hospitalContractRevisions").doc(auditReference.id), {
        hospitalId, action: body.action, previousValues: hospitalContractRevision(hospital),
        updatedValues: hospitalContractRevision({ ...hospital, ...changes }),
        createdAt: now, createdBy: adminUid, updatedAt: now, updatedBy: adminUid,
        archivedAt: null, archivedBy: null, lastAuditId: auditReference.id,
      });
    }
    const affectedAuthUids: string[] = [];
    linkedUsers?.docs.forEach((userDocument) => {
      const user = userDocument.data();
      if (user.role !== "hospital" || user.status === "archived"
        || (body.action !== "archive" && user.status === "inactive")) return;
      const userAudit = firestore.collection("auditLogs").doc();
      const userChanges = body.action === "archive"
        ? { status: "archived", archivedAt: now, archivedBy: adminUid, updatedAt: now, updatedBy: adminUid, lastAuditId: userAudit.id }
        : { status: "inactive", updatedAt: now, updatedBy: adminUid, lastAuditId: userAudit.id };
      batch.update(userDocument.ref, userChanges);
      batch.set(userAudit, {
        action: body.action === "archive" ? "archive" : "status_change",
        module: "users",
        recordId: userDocument.id,
        actorId: adminUid,
        actorRole: "admin",
        previousValues: user,
        updatedValues: { ...user, ...userChanges },
        timestamp: now,
        source: "server",
        device: {
          userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
          platform: null,
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        },
      });
      affectedAuthUids.push(userDocument.id);
    });
    return affectedAuthUids;
    });

    if (affectedAuthUids.length) {
      const synchronized = await syncPortalAccountAccess(auth, affectedAuthUids.map(uid => ({ uid, disabled: true })));
      if (!synchronized) {
        logApiError("/api/admin/hospitals/[hospitalId] auth-sync", new Error("auth-sync-incomplete"));
        return apiJson({ saved: true, error: "The hospital changes were saved and its previous login access was removed from the portal, but the account security update could not be confirmed. Ask the project owner to check the login before sharing new access." }, 503);
      }
    }

    return mutationJson(auditedChanges);
  } catch (error) {
    if (error instanceof ProvisioningError) return apiJson({ error: error.message }, error.status);
    if (error instanceof DuplicateCreationEmailError) return apiJson({ error: error.message, field: "email" }, error.status);
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("/api/admin/hospitals/[hospitalId]", error);
    return apiJson({ error: "We could not update the hospital. Check the server Firebase configuration and try again." }, 503);
  }
}

export const GET = withApiTiming("GET /api/admin/hospitals/[hospitalId]", handleGET);
export const PATCH = withApiTiming("PATCH /api/admin/hospitals/[hospitalId]", handlePATCH);
