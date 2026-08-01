import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const [role, email, password, name, hospitalIdArgument] = process.argv.slice(2);
if (!['admin', 'hospital'].includes(role) || !email || !password || !name) {
  throw new Error("Usage: npm run firebase:provision-user -- <admin|hospital> <email> <password> <name> [hospitalId]");
}
if (role === "hospital" && !hospitalIdArgument) throw new Error("Hospital accounts require a hospitalId.");
if (password.length < 8) throw new Error("Use a password of at least eight characters.");

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

const authUser = await auth.createUser({ email, password, displayName: name });
try {
  await auth.setCustomUserClaims(authUser.uid, { role });
  await firestore.collection("users").doc(authUser.uid).set({
    uid: authUser.uid, name, email: authUser.email, phone: null, role,
    status: "active", hospitalId,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`${role} account created: ${authUser.uid}`);
} catch (error) {
  await auth.deleteUser(authUser.uid).catch(() => undefined);
  throw error;
}
