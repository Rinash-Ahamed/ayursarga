import { withApiTiming } from "@/services/api/timing";
import { FieldValue } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { apiHealth, apiJson } from "@/services/api/server";
import { isFirebaseAdminReady } from "@/services/firebase/admin";
import { authEmailSiteUrl, isAuthEmailReady, sendAuthEmail } from "@/services/auth/authEmailService";
import { isEmailReady } from "@/services/email/emailService";
import { allowRequest } from "@/services/api/rateLimit";
import { preparePortalAccount, recordProvisioningReady, ProvisioningError, syncPortalAccountAccess } from "@/services/auth/provisioning";
import { requestAuditDevice } from "@/services/api/audit";

export const runtime = "nodejs";

function handleGET() {
  return apiHealth("/api/admin/hospitals/[hospitalId]/login-setup", [{ name: "firebaseAdmin", ready: isFirebaseAdminReady() }, { name: "email", ready: isAuthEmailReady() }]);
}

async function handlePOST(request: Request, context: { params: Promise<{ hospitalId: string }> }) {
  let deliveringEmail = false;
  try {
    const { uid: adminUid, auth, firestore } = await requireActiveAdmin(request);

    const { hospitalId } = await context.params;
    if (!hospitalId || hospitalId.length > 160 || hospitalId.includes("/")) return apiJson({ error: "The hospital could not be found." }, 404);
    if (!allowRequest(`hospital-invite:${adminUid}:${hospitalId}`, 3, 10 * 60 * 1000)) return apiJson({ error: "Please wait before sending another Hospital invitation." }, 429);
    if (!isEmailReady()) return apiJson({ error: "Invitation email is not configured. Ask Admin to check the server email settings." }, 503);
    authEmailSiteUrl();
    const hospitalReference = firestore.collection("hospitals").doc(hospitalId);
    const hospitalSnapshot = await hospitalReference.get();
    const hospital = hospitalSnapshot.data();
    if (!hospitalSnapshot.exists || hospital?.status !== "active" || hospital.archivedAt != null) {
      return apiJson({ error: "Activate the hospital before preparing its login." }, 409);
    }

    const email = String(hospital.email ?? "").trim().toLowerCase();
    const name = String(hospital.name ?? "").trim();
    if (!email || !name) return apiJson({ error: "The hospital name and official email are required." }, 409);

    const prepared = await preparePortalAccount(auth, firestore, {
      role: "hospital", email, hospitalId, actorId: adminUid, device: requestAuditDevice(request),
    });
    const { authUser } = prepared;

    const userReference = firestore.collection("users").doc(authUser.uid);
    const replacedAuthUids = await firestore.runTransaction(async batch => {
    const currentHospital = (await batch.get(hospitalReference)).data();
    if (!currentHospital || currentHospital.status !== "active" || currentHospital.archivedAt != null
      || currentHospital.lastAuditId !== hospital.lastAuditId
      || String(currentHospital.email ?? "").trim().toLowerCase() !== email) {
      throw new ProvisioningError("The hospital details or access changed. Refresh the hospital before sending login setup again.");
    }
    const userSnapshot = await batch.get(userReference);
    const previous = userSnapshot.data() ?? null;
    if (!prepared.canRecoverMissingProfile && !previous) {
      throw new ProvisioningError("This email already has an unrecognized account. Ask the project owner to review it before preparing this Hospital login.");
    }
    if (previous && (previous.role !== "hospital" || previous.hospitalId !== hospitalId)) {
      throw new ProvisioningError("This email already belongs to a different Ayursarga account.");
    }

    const linkedUsers = await batch.get(firestore.collection("users").where("hospitalId", "==", hospitalId).limit(21));
    if (linkedUsers.docs.length > 20) throw new ProvisioningError("This hospital's login accounts need a project-owner review before changing access.");
    const replacedUsers = linkedUsers.docs.filter((document) => document.id !== authUser.uid && document.data().role === "hospital" && document.data().status === "active");
    const currentClaim = (await batch.get(prepared.claimRef)).data();
    if (prepared.canRecoverMissingProfile && (!currentClaim || currentClaim.authUid !== authUser.uid
      || currentClaim.role !== "hospital" || currentClaim.hospitalId !== hospitalId || currentClaim.email !== email)) {
      throw new ProvisioningError("The reserved account changed. Ask the project owner to review its login setup.");
    }

    const auditReference = firestore.collection("auditLogs").doc();
    const now = FieldValue.serverTimestamp();
    const userData = previous ? {
      name,
      email,
      role: "hospital",
      status: "active",
      hospitalId,
      updatedAt: now,
      updatedBy: adminUid,
      archivedAt: null,
      archivedBy: null,
      lastAuditId: auditReference.id,
    } : {
      uid: authUser.uid,
      name,
      email,
      phone: null,
      address: null,
      role: "hospital",
      status: "active",
      hospitalId,
      createdAt: now,
      createdBy: adminUid,
      updatedAt: now,
      updatedBy: adminUid,
      archivedAt: null,
      archivedBy: null,
      lastAuditId: auditReference.id,
    };
    const action = previous ? (previous.status === "archived" ? "restore" : "update") : "create";
    batch.set(userReference, userData, { merge: Boolean(previous) });
    batch.set(auditReference, {
      action,
      module: "users",
      recordId: authUser.uid,
      actorId: adminUid,
      actorRole: "admin",
      previousValues: previous,
      updatedValues: previous ? { ...previous, ...userData } : userData,
      timestamp: now,
      source: "server",
      device: {
        userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
        platform: null,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      },
    });
    for (const replacedUser of replacedUsers) {
      const replacedAudit = firestore.collection("auditLogs").doc();
      const replacedData = replacedUser.data();
      const replacedChanges = {
        status: "inactive",
        updatedAt: now,
        updatedBy: adminUid,
        lastAuditId: replacedAudit.id,
      };
      batch.update(replacedUser.ref, replacedChanges);
      batch.set(replacedAudit, {
        action: "status_change",
        module: "users",
        recordId: replacedUser.id,
        actorId: adminUid,
        actorRole: "admin",
        previousValues: replacedData,
        updatedValues: { ...replacedData, ...replacedChanges },
        timestamp: now,
        source: "server",
        device: {
          userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
          platform: null,
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        },
      });
    }
    recordProvisioningReady(batch, firestore, { ...prepared, claim: currentClaim }, adminUid, requestAuditDevice(request));
    // A failed acknowledgement does not prove the commit failed. Preserve Auth
    // and its reservation; retries inspect this same identity instead.
    // Also finish revoking historical inactive logins after a previous partial
    // Auth failure, without rewriting their preserved profile/audit history.
    return linkedUsers.docs.filter(user => user.id !== authUser.uid && user.data().role === "hospital").map(user => user.id);
    });

    const synchronized = await syncPortalAccountAccess(auth, [
      { uid: authUser.uid, disabled: false, displayName: name },
      ...replacedAuthUids.map(uid => ({ uid, disabled: true })),
    ]);
    if (!synchronized) return apiJson({ saved: true, error: "The hospital login was saved, but its access update could not be confirmed. No invitation was sent. Use Send login setup / reset again to check and complete access." }, 503);

    deliveringEmail = true;
    await sendAuthEmail(auth, { email, name, role: "hospital", invitation: true });
    return apiJson({ ok: true, email, emailSent: true });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    if (error instanceof ProvisioningError) return apiJson({ error: error.message }, error.status);
    console.error("Hospital login setup or invitation delivery failed.");
    return apiJson({ error: deliveringEmail
      ? "The Hospital account is ready, but its invitation email could not be sent. Retry sending the login setup link."
      : "Hospital login setup is unavailable. Check the server Firebase Admin and email configuration and try again." }, 503);
  }
}

export const GET = withApiTiming("GET /api/admin/hospitals/[hospitalId]/login-setup", handleGET);
export const POST = withApiTiming("POST /api/admin/hospitals/[hospitalId]/login-setup", handlePOST);
