import { initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";

const projectId = "demo-ayursarga";
const password = "Ayursarga-Test-2026";
const adminApp = initializeAdminApp({ projectId });
const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp);

const identities = {
  admin: ["rules-admin@example.test", "admin", null],
  hospitalA: ["rules-hospital-a@example.test", "hospital", "hospital-a"],
  hospitalB: ["rules-hospital-b@example.test", "hospital", "hospital-b"],
  consumerA: ["rules-consumer-a@example.test", "consumer", null],
  consumerB: ["rules-consumer-b@example.test", "consumer", null],
};

for (const [key, [email, role, hospitalId]] of Object.entries(identities)) {
  const uid = `rules-${key}`;
  await adminAuth.createUser({ uid, email, password });
  if (role !== "consumer") await adminAuth.setCustomUserClaims(uid, { role });
  await adminDb.collection("users").doc(uid).set({
    uid, name: key, email, phone: null, role, status: "active", hospitalId,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
}

const hospitalBase = {
  description: "Test", email: "hospital@example.test", phone: "1", address: "A",
  city: "Kochi", state: "Kerala", imageUrl: null, status: "active",
  commissionPercentage: 10, createdBy: "rules-admin",
  createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
};
await adminDb.collection("hospitals").doc("hospital-a").set({ ...hospitalBase, name: "Public A", isPublic: true });
await adminDb.collection("hospitals").doc("hospital-b").set({ ...hospitalBase, name: "Private B", isPublic: false });
await adminDb.collection("services").doc("service-a").set({ hospitalId: "hospital-a", name: "Care", description: "Test", price: 1000, durationMinutes: 60, status: "active", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
await adminDb.collection("services").doc("service-b").set({ hospitalId: "hospital-b", name: "Private", description: "Test", price: 500, durationMinutes: null, status: "active", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

function client(name) {
  const app = initializeApp({ apiKey: "demo", authDomain: `${projectId}.firebaseapp.com`, projectId, appId: `demo-${name}` }, name);
  const auth = getAuth(app); const firestore = getFirestore(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  return { app, auth, firestore };
}

async function signedClient(name, identityKey) {
  const instance = client(name); const [email] = identities[identityKey];
  await signInWithEmailAndPassword(instance.auth, email, password); return instance;
}

async function succeeds(label, operation) {
  await operation(); console.log(`PASS allow: ${label}`);
}
async function fails(label, operation) {
  try { await operation(); throw new Error(`Expected denial: ${label}`); }
  catch (error) { if (error instanceof Error && error.message === `Expected denial: ${label}`) throw error; console.log(`PASS deny: ${label}`); }
}

const publicClient = client("public");
const consumerA = await signedClient("consumer-a", "consumerA");
const consumerB = await signedClient("consumer-b", "consumerB");
const hospitalA = await signedClient("hospital-a", "hospitalA");
const hospitalB = await signedClient("hospital-b", "hospitalB");
const admin = await signedClient("admin", "admin");

await succeeds("public active hospital", () => getDoc(doc(publicClient.firestore, "hospitals/hospital-a")));
await fails("public private hospital", () => getDoc(doc(publicClient.firestore, "hospitals/hospital-b")));
await succeeds("public active service at public hospital", () => getDoc(doc(publicClient.firestore, "services/service-a")));
await fails("public service at private hospital", () => getDoc(doc(publicClient.firestore, "services/service-b")));
await succeeds("consumer own profile", () => getDoc(doc(consumerA.firestore, "users/rules-consumerA")));
await fails("consumer other profile", () => getDoc(doc(consumerA.firestore, "users/rules-consumerB")));
await succeeds("consumer permitted profile update", () => updateDoc(doc(consumerA.firestore, "users/rules-consumerA"), { name: "Consumer A", updatedAt: serverTimestamp() }));
await fails("consumer role escalation", () => updateDoc(doc(consumerA.firestore, "users/rules-consumerA"), { role: "admin", updatedAt: serverTimestamp() }));

const booking = {
  consumerId: "rules-consumerA", hospitalId: "hospital-a", serviceId: "service-a",
  preferredDate: Timestamp.fromDate(new Date("2030-01-01T00:00:00Z")), preferredTime: "10:00",
  confirmedDate: null, confirmedTime: null, status: "requested", servicePrice: 1000,
  commissionPercentage: 10, estimatedCommission: 100, consumerNotes: null,
  hospitalNotes: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  confirmedAt: null, completedAt: null,
};
await succeeds("consumer creates own valid booking", () => setDoc(doc(consumerA.firestore, "bookings/booking-a"), booking));
await fails("consumer creates booking for another user", () => setDoc(doc(consumerA.firestore, "bookings/booking-invalid"), { ...booking, consumerId: "rules-consumerB" }));
await succeeds("consumer reads own booking", () => getDoc(doc(consumerA.firestore, "bookings/booking-a")));
await fails("other consumer reads booking", () => getDoc(doc(consumerB.firestore, "bookings/booking-a")));
await succeeds("assigned hospital reads booking", () => getDoc(doc(hospitalA.firestore, "bookings/booking-a")));
await fails("other hospital reads booking", () => getDoc(doc(hospitalB.firestore, "bookings/booking-a")));
await succeeds("assigned hospital confirms booking", () => updateDoc(doc(hospitalA.firestore, "bookings/booking-a"), { status: "confirmed", confirmedDate: Timestamp.fromDate(new Date("2030-01-02T00:00:00Z")), confirmedTime: "11:00", confirmedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
await fails("hospital changes commission", () => updateDoc(doc(hospitalA.firestore, "hospitals/hospital-a"), { commissionPercentage: 1, updatedAt: serverTimestamp() }));
await fails("hospital edits another hospital service", () => updateDoc(doc(hospitalA.firestore, "services/service-b"), { name: "Changed", updatedAt: serverTimestamp() }));
await succeeds("admin reads a consumer", () => getDoc(doc(admin.firestore, "users/rules-consumerA")));
await succeeds("admin changes hospital commission", () => updateDoc(doc(admin.firestore, "hospitals/hospital-a"), { commissionPercentage: 12, updatedAt: serverTimestamp() }));

await Promise.all([publicClient, consumerA, consumerB, hospitalA, hospitalB, admin].map(({ app }) => deleteApp(app)));
console.log("Firestore rules isolation suite passed.");
