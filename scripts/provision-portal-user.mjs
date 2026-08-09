import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const [role, email, name, hospitalIdArgument] = process.argv.slice(2);
if (!['admin', 'hospital'].includes(role) || !email || !name) {
  throw new Error("Usage: npm run firebase:provision-user -- <admin|hospital> <email> <name> [hospitalId]");
}
if (role === "hospital" && !hospitalIdArgument) throw new Error("Hospital accounts require a hospitalId.");

const app = initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GCLOUD_PROJECT,
});
const auth = getAuth(app);
const firestore = getFirestore(app);
const hospitalId = role === "hospital" ? hospitalIdArgument : null;

if (hospitalId) {
  const hospital = await firestore.collection("hospitals").doc(hospitalId).get();
  if (!hospital.exists) throw new Error(`Hospital ${hospitalId} does not exist.`);
}

const authUser = await auth.createUser({ email, displayName: name });
try {
  const passwordSetupLink = await auth.generatePasswordResetLink(email);
  const userReference = firestore.collection("users").doc(authUser.uid);
  const auditReference = firestore.collection("auditLogs").doc();
  const userData = {
    uid: authUser.uid, name, email: authUser.email, phone: null, role,
    status: "active", hospitalId,
    createdAt: FieldValue.serverTimestamp(), createdBy: authUser.uid,
    updatedAt: FieldValue.serverTimestamp(), updatedBy: authUser.uid,
    archivedAt: null, archivedBy: null, lastAuditId: auditReference.id,
  };
  const batch = firestore.batch();
  batch.set(userReference, userData);
  batch.set(auditReference, {
    action: "create", module: "users", recordId: authUser.uid,
    actorId: authUser.uid, actorRole: role, previousValues: null,
    updatedValues: userData, timestamp: FieldValue.serverTimestamp(), source: "server",
    device: { userAgent: null, platform: null, ipAddress: null },
  });
  await batch.commit();
  console.log(`${role} account created: ${authUser.uid}`);
  console.log(`One-time password setup link: ${passwordSetupLink}`);
} catch (error) {
  await auth.deleteUser(authUser.uid).catch(() => undefined);
  throw error;
}
