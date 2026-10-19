// Read-only lab probe: no credentials, document contents or identifiers are logged.
import nextEnv from "@next/env";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

nextEnv.loadEnvConfig(process.cwd());
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const app = initializeApp({ credential: cert({
  projectId, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim(),
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n").trim(),
}), projectId });
const db = getFirestore(app);
try {
  const sample = await db.collection("hospitals").limit(1).select().get();
  if (sample.empty) throw new Error("No hospital is available for the read-only probe.");
  const hospital = sample.docs[0].ref;
  const capacity = db.collection("hospitalCapacity").doc(hospital.id);
  const results = { sequential: [], batched: [] };
  for (let index = 0; index < 6; index++) {
    for (const mode of index % 2 ? ["batched", "sequential"] : ["sequential", "batched"]) {
      const started = performance.now();
      if (mode === "sequential") { await hospital.get(); await capacity.get(); }
      else await db.getAll(hospital, capacity);
      results[mode].push(Math.round(performance.now() - started));
    }
  }
  console.log(JSON.stringify({ projectId, milliseconds: results, note: "Read-only warm-process direct Firestore lab probe, not browser or hosted API latency" }));
} finally { await db.terminate(); }
