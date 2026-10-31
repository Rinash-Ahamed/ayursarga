import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { requireActiveAdmin, AdminAuthorizationError } from "@/services/firebase/adminAuthorization";
import { getFirebaseAdminStorageBucket } from "@/services/firebase/admin";
import { apiJson, logApiError } from "@/services/api/server";
import { requestAuditDevice } from "@/services/api/audit";
import { allowRequest } from "@/services/api/rateLimit";
import { RequestBodyError } from "@/services/api/request";
import { readImageUpload } from "@/services/images/readImageUpload";

export const runtime = "nodejs";
class PhotoError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
export async function POST(request: Request, context: { params: Promise<{ consultantId: string }> }) {
  try {
    const { uid, firestore } = await requireActiveAdmin(request);
    const { consultantId } = await context.params;
    if (consultantId.length > 160 || !/^AS\d{3,}$/.test(consultantId)) throw new PhotoError("Invalid consultant.", 400);
    if (!allowRequest(`consultant-photo:${uid}`, 20, 10 * 60 * 1000)) throw new PhotoError("Please wait before uploading another photo.", 429);
    const expected = request.headers.get("x-expected-image-url");
    if (expected === null || expected.length > 1000) throw new PhotoError("Refresh the consultant before uploading a photo.", 400);
    const ref = firestore.collection("consultants").doc(consultantId);
    const assertCurrent = (data: FirebaseFirestore.DocumentData | undefined) => {
      if (!data || data.archivedAt != null) throw new PhotoError("This consultant is unavailable.", 404);
      if ((data.imageUrl ?? "") !== expected) throw new PhotoError("The consultant photo changed. Refresh before replacing it.", 409);
    };
    assertCurrent((await ref.get()).data());
    let bucket;
    try { bucket = getFirebaseAdminStorageBucket(); }
    catch { throw new PhotoError("Photo uploads are unavailable. Check the Storage configuration.", 503); }
    const image = await readImageUpload(request, 384, 384, 8 * 1024 * 1024);
    const storagePath = `consultants/${consultantId}/images/${randomUUID()}.webp`;
    const token = randomUUID();
    await bucket.file(storagePath).save(image, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: "image/webp", cacheControl: "public,max-age=31536000,immutable", metadata: { firebaseStorageDownloadTokens: token, uploadedBy: uid } } });
    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
    await firestore.runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data();
      assertCurrent(current);
      const audit = firestore.collection("auditLogs").doc();
      const now = Timestamp.now();
      const changes = { imageUrl, updatedAt: now, updatedBy: uid, lastAuditId: audit.id };
      transaction.update(ref, changes);
      transaction.set(audit, { action: "update", module: "consultants", recordId: consultantId, actorId: uid, actorRole: "admin",
        previousValues: { imageUrl: current?.imageUrl ?? null }, updatedValues: changes, timestamp: now, source: "server", device: requestAuditDevice(request), storagePath });
    });
    return apiJson({ imageUrl }, 201);
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError || error instanceof PhotoError) return apiJson({ error: error.message }, error.status);
    logApiError("POST /api/admin/consultants/[consultantId]/image", error);
    return apiJson({ error: "We could not save the consultant photo. Refresh to check the current photo before trying again." }, 503);
  }
}
