import { withApiTiming } from "@/services/api/timing";
import { FieldValue } from "firebase-admin/firestore";
import { validateHospitalFields } from "@/features/hospitals/validation";
import { hasMinimumHospitalImages, MIN_PUBLIC_HOSPITAL_IMAGES } from "@/features/hospitals/images";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { apiHealth, apiJson, logApiError } from "@/services/api/server";
import { hasCurrentHospitalContract, validContractUrl } from "@/features/hospitals/contractApproval";
import { assertHospitalLoginEmailAvailable, ProvisioningError, syncPortalAccountAccess } from "@/services/auth/provisioning";

export const runtime = "nodejs";

function handleGET() {
  return apiHealth("/api/admin/hospitals/[hospitalId]/activate", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }]);
}

async function handlePOST(request: Request, context: { params: Promise<{ hospitalId: string }> }) {
  try {
    const { uid: adminUid, auth, firestore } = await requireActiveAdmin(request);
    const { hospitalId } = await context.params;
    if (!hospitalId || hospitalId.length > 160 || hospitalId.includes("/")) return apiJson({ error: "The hospital could not be found." }, 404);
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
      || !validContractUrl(hospital.contractUrl)) {
      return apiJson({ error: "Confirm the signed contract, URL, and signing date before activation." }, 409);
    }
    if (hospital.contractNeedsRegeneration === true || hospital.status === "pending" && !hasCurrentHospitalContract(hospital)) {
      return apiJson({ error: "The hospital particulars changed. Generate and sign the latest contract before activation." }, 409);
    }

    const auditReference = firestore.collection("auditLogs").doc();
    if (!hasMinimumHospitalImages(hospital)) return apiJson({ error: `Upload at least ${MIN_PUBLIC_HOSPITAL_IMAGES} different hospital images before making this hospital public.` }, 409);
    // Reject identity conflicts before publishing, rather than discovering them
    // in the subsequent explicit login-setup request.
    await assertHospitalLoginEmailAvailable(auth, firestore, hospitalId, String(hospital.email).trim().toLowerCase());
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
    batch.update(hospitalReference, changes, { lastUpdateTime: hospitalSnapshot.updateTime! });
    batch.set(auditReference, {
      action: "hospital_activated",
      module: "hospitals",
      recordId: hospitalId,
      actorId: adminUid,
      actorRole: "admin",
      previousValues: hospital,
      updatedValues: { ...hospital, ...changes },
      timestamp: now,
      source: "server",
      device: {
        userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
        platform: null,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      },
    });
    const linkedUsers = await firestore.collection("users").where("hospitalId", "==", hospitalId).limit(21).get();
    if (linkedUsers.docs.length > 20) throw new ProvisioningError("This hospital's login accounts need a project-owner review before changing access.");
    const reactivatedAuthUids: string[] = [];
    const revokedAuthUids: string[] = [];
    const officialEmail = String(hospital.email ?? "").trim().toLowerCase();
    linkedUsers.docs.forEach((userDocument) => {
      const user = userDocument.data();
      if (user.role !== "hospital") return;
      const matchesOfficialEmail = String(user.email ?? "").trim().toLowerCase() === officialEmail;
      if ((!matchesOfficialEmail && user.status !== "active") || (matchesOfficialEmail && user.status === "active")) return;
      const userAudit = firestore.collection("auditLogs").doc();
      const userChanges = matchesOfficialEmail
        ? {
          status: "active", archivedAt: null, archivedBy: null,
          updatedAt: now, updatedBy: adminUid, lastAuditId: userAudit.id,
        }
        : {
          status: "inactive", updatedAt: now, updatedBy: adminUid, lastAuditId: userAudit.id,
        };
      batch.update(userDocument.ref, userChanges);
      batch.set(userAudit, {
        action: matchesOfficialEmail && user.status === "archived" ? "restore" : "status_change",
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
      if (matchesOfficialEmail) reactivatedAuthUids.push(userDocument.id);
      else revokedAuthUids.push(userDocument.id);
    });
    await batch.commit();

    if (reactivatedAuthUids.length || revokedAuthUids.length) {
      const synchronized = await syncPortalAccountAccess(auth, [
        ...reactivatedAuthUids.map(uid => ({ uid, disabled: false })),
        ...revokedAuthUids.map(uid => ({ uid, disabled: true })),
      ]);
      if (!synchronized) {
        logApiError("/api/admin/hospitals/[hospitalId]/activate auth-sync", new Error("auth-sync-incomplete"));
        return apiJson({ saved: true, error: "The hospital is active, but its login access update could not be confirmed. Use Send login setup / reset to check and complete access before sharing the login." }, 503);
      }
    }

    return apiJson({ ok: true });
  } catch (error) {
    if (error instanceof ProvisioningError) return apiJson({ error: error.message }, error.status);
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("/api/admin/hospitals/[hospitalId]/activate", error);
    return apiJson({ error: "We could not activate the hospital. Check the server Firebase configuration and try again." }, 503);
  }
}

export const GET = withApiTiming("GET /api/admin/hospitals/[hospitalId]/activate", handleGET);
export const POST = withApiTiming("POST /api/admin/hospitals/[hospitalId]/activate", handlePOST);
