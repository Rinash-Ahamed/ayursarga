// Explicit maintenance operation: unlink existing gallery images, never delete files.
// Default is read-only. Run with --apply only when the owner authorizes a reset.
import nextEnv from "@next/env";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldPath, getFirestore, Timestamp } from "firebase-admin/firestore";

nextEnv.loadEnvConfig(process.cwd());
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (projectId !== "ayursarga-connect") throw new Error("Unexpected Firebase project; no changes made.");
const app = initializeApp({ credential: cert({
  projectId,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim(),
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n").trim(),
}), projectId });
const firestore = getFirestore(app);
try {
  const admins = await firestore.collection("users").where("email", "==", "info@ayursarga.com").limit(2).get();
  if (admins.size !== 1 || admins.docs[0].data().role !== "admin" || admins.docs[0].data().status !== "active") {
    throw new Error("One active owner Admin profile is required; no changes made.");
  }
  const actorId = admins.docs[0].id;
  const apply = process.argv.includes("--apply");
  let cursor;
  let affected = 0;
  let images = 0;
  let conflicts = 0;
  while (true) {
    let query = firestore.collection("hospitals").orderBy(FieldPath.documentId()).limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (const document of page.docs) {
      const data = document.data();
      if (!(Array.isArray(data.imageUrls) && data.imageUrls.length) && !data.imageUrl) continue;
      const previousValues = { imageUrls: data.imageUrls ?? [], imageUrl: data.imageUrl ?? null };
      if (apply) {
        const changed = await firestore.runTransaction(async (transaction) => {
          const current = (await transaction.get(document.ref)).data();
          if (!current || JSON.stringify({ imageUrls: current.imageUrls ?? [], imageUrl: current.imageUrl ?? null }) !== JSON.stringify(previousValues)) return false;
          const audit = firestore.collection("auditLogs").doc();
          const timestamp = Timestamp.now();
          const changes = { imageUrls: [], imageUrl: null, updatedAt: timestamp, updatedBy: actorId, lastAuditId: audit.id };
          transaction.update(document.ref, changes);
          transaction.set(audit, {
            action: "update", module: "hospitals", recordId: document.id,
            actorId, actorRole: "admin", previousValues, updatedValues: changes,
            timestamp, source: "server", imageAction: "remove",
            reason: "Owner-requested reset of existing hospital galleries for direct uploads; files retained.",
            device: { userAgent: "clear-hospital-galleries maintenance", platform: "node", ipAddress: null },
          });
          return true;
        });
        if (!changed) { conflicts++; continue; }
      }
      affected++;
      images += new Set([...previousValues.imageUrls, previousValues.imageUrl].filter(Boolean)).size;
    }
    cursor = page.docs.at(-1);
  }
  console.log(JSON.stringify({ mode: apply ? "applied" : "preview", projectId, hospitals: affected, imageReferences: images, concurrentChangesSkipped: conflicts, storageFilesDeleted: 0 }));
} finally {
  await firestore.terminate();
}
