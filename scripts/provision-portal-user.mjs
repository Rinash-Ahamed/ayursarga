import "./server-services.mjs";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const { preparePortalAccount, recordProvisioningReady } = await import("../services/auth/provisioning.ts");
const { sendAuthEmail, isAuthEmailReady } = await import("../services/auth/authEmailService.ts");
const { closeEmailTransport } = await import("../services/email/emailService.ts");
const { isValidEmail } = await import("../utils/text.ts");
const [role, rawEmail, rawName, hospitalIdArgument] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase(), name = rawName?.trim();
if (!['admin', 'hospital'].includes(role) || !isValidEmail(email ?? "") || !name || name.length > 120) {
  throw new Error("Usage: npm run firebase:provision-user -- <admin|hospital> <email> <name> [hospitalId]");
}
if (role === "hospital" && (!hospitalIdArgument || hospitalIdArgument.includes("/"))) throw new Error("Hospital accounts require a valid hospitalId.");
if (!isAuthEmailReady()) throw new Error("Configure the application email service and APP_SITE_URL before provisioning.");
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GCLOUD_PROJECT;
if (projectId !== "ayursarga-connect") throw new Error("Explicitly select FIREBASE_ADMIN_PROJECT_ID=ayursarga-connect before provisioning.");

const app = initializeApp({
  credential: applicationDefault(),
  projectId,
});
const auth = getAuth(app);
const firestore = getFirestore(app);
const hospitalId = role === "hospital" ? hospitalIdArgument : null;

const actorId = "trusted-project-operator";
const device = { userAgent: "provision-portal-user", platform: null, ipAddress: null };
let profileSaved = false;
try {
  if (hospitalId) {
    const hospital = (await firestore.collection("hospitals").doc(hospitalId).get()).data();
    if (!hospital || hospital.status !== "active" || hospital.archivedAt != null || hospital.email?.trim().toLowerCase() !== email) throw new Error("Hospital eligibility needs Admin review.");
  }
  const prepared = await preparePortalAccount(auth, firestore, { role, email, hospitalId, actorId, device });
  const { authUser } = prepared;
  const userReference = firestore.collection("users").doc(authUser.uid);
  await firestore.runTransaction(async batch => {
  if (hospitalId) {
    const currentHospital = (await batch.get(firestore.collection("hospitals").doc(hospitalId))).data();
    if (!currentHospital || currentHospital.status !== "active" || currentHospital.archivedAt != null || currentHospital.email?.trim().toLowerCase() !== email) throw new Error("Hospital eligibility changed.");
  }
  const previous = (await batch.get(userReference)).data();
  if (previous && (previous.role !== role || previous.hospitalId !== hospitalId || previous.email?.trim().toLowerCase() !== email || previous.status !== "active")) throw new Error("Existing account needs an explicit Admin review.");
  if (!previous && !prepared.canRecoverMissingProfile) throw new Error("Unrecognized Auth account needs project-owner review.");
  const auditReference = firestore.collection("auditLogs").doc();
  const userData = {
    ...(previous ?? {}), uid: authUser.uid, name, email, phone: previous?.phone ?? null, address: previous?.address ?? null, role,
    status: "active", hospitalId,
    createdAt: previous?.createdAt ?? FieldValue.serverTimestamp(), createdBy: previous?.createdBy ?? actorId,
    updatedAt: FieldValue.serverTimestamp(), updatedBy: actorId,
    archivedAt: null, archivedBy: null, lastAuditId: auditReference.id,
  };
  batch.set(userReference, userData);
  batch.set(auditReference, {
    action: previous ? "update" : "create", module: "users", recordId: authUser.uid,
    actorId, actorRole: "admin", previousValues: previous ?? null,
    updatedValues: userData, timestamp: FieldValue.serverTimestamp(), source: "server",
    device,
  });
  recordProvisioningReady(batch, firestore, prepared, actorId, device);
  });
  profileSaved = true;
  await auth.updateUser(authUser.uid, { disabled: false, displayName: name });
  await auth.revokeRefreshTokens(authUser.uid);
  await sendAuthEmail(auth, { email, name, role, invitation: role === "hospital" });
  console.log("Account saved. The branded setup email was accepted by the email service. Inbox delivery is not guaranteed.");
} catch {
  // Provider errors may contain personal action links. Never print them.
  console.error(profileSaved
    ? "Account saved, but setup or email delivery could not be confirmed. Check the account and inbox before explicitly retrying. No account was deleted."
    : "Provisioning could not be confirmed. Existing accounts and any reserved identity were kept. Check the saved state before retrying.");
  process.exitCode = 1;
} finally { closeEmailTransport(); }
