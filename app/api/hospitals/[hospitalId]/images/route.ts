import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { Timestamp } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { getFirebaseAdminStorageBucket, isFirebaseAdminStorageReady } from "@/services/firebase/admin";
import { apiHealth, apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest } from "@/services/api/rateLimit";
import { requestAuditDevice } from "@/services/api/audit";
import { getHospitalImageUrls, MAX_HOSPITAL_IMAGES } from "@/features/hospitals/images";

export const runtime = "nodejs";
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

export function GET() {
  return apiHealth("/api/hospitals/[hospitalId]/images", [{ name: "firebaseStorage", ready: isFirebaseAdminStorageReady() }]);
}

class ImageError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function authorize(request: Request, context: { params: Promise<{ hospitalId: string }> }) {
  const actor = await requireActiveUser(request, ["admin", "hospital"]);
  const { hospitalId } = await context.params;
  if (!hospitalId || hospitalId.length > 160 || hospitalId.includes("/")) throw new ImageError("The hospital could not be found.", 404);
  if (actor.role === "hospital" && actor.profile.hospitalId !== hospitalId) throw new ImageError("You can manage images only for your own centre.", 403);
  if (!allowRequest(`hospital-images:${actor.uid}`, 40, 10 * 60 * 1000)) throw new ImageError("Too many image changes. Please wait a few minutes and try again.", 429);
  const reference = actor.firestore.collection("hospitals").doc(hospitalId);
  const snapshot = await reference.get();
  if (!snapshot.exists || snapshot.data()?.status === "archived") throw new ImageError("This hospital is unavailable for image changes.", 404);
  if (actor.role === "hospital" && snapshot.data()?.status !== "active") throw new ImageError("Only an active centre can manage its images.", 403);
  return { ...actor, hospitalId, reference, imageCount: getHospitalImageUrls(snapshot.data() ?? {}).length };
}

async function readImage(request: Request) {
  if (!["image/webp", "image/jpeg", "image/png"].includes(request.headers.get("content-type") ?? "")) throw new ImageError("Choose a JPG, PNG or WebP image.", 415);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) throw new ImageError("This image is too large to upload.", 413);
  if (!request.body) throw new ImageError("Choose an image to upload.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_UPLOAD_BYTES) {
      await reader.cancel();
      throw new ImageError("This image is too large to upload.", 413);
    }
    chunks.push(value);
  }
  try {
    const processor = sharp(Buffer.concat(chunks), { limitInputPixels: 25_000_000, animated: false });
    const metadata = await processor.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error("Invalid format");
    return await processor.rotate().resize(1200, 900, { fit: "cover", position: "attention" }).webp({ quality: 84 }).toBuffer();
  } catch {
    throw new ImageError("This image could not be processed. Choose another JPG, PNG or WebP image.", 400);
  }
}

type Actor = Awaited<ReturnType<typeof authorize>>;
async function changeGallery(actor: Actor, request: Request, url: string, action: "add" | "remove", storagePath: string | null) {
  return actor.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(actor.reference);
    const hospital = snapshot.data();
    if (!hospital || hospital.status === "archived" || (actor.role === "hospital" && hospital.status !== "active")) throw new ImageError("This hospital is unavailable for image changes.", 409);
    const current = getHospitalImageUrls(hospital);
    if (action === "add" && current.length >= MAX_HOSPITAL_IMAGES) throw new ImageError("A centre can have up to 10 images. Remove an image before uploading another.", 409);
    if (action === "remove" && !current.includes(url)) throw new ImageError("This image has already been removed. Refresh the gallery.", 409);
    const imageUrls = action === "add" ? [...current, url] : current.filter((image) => image !== url);
    const audit = actor.firestore.collection("auditLogs").doc();
    const now = Timestamp.now();
    const changes = { imageUrls, imageUrl: null, updatedAt: now, updatedBy: actor.uid, lastAuditId: audit.id };
    transaction.update(actor.reference, changes);
    transaction.set(audit, {
      action: "update", module: "hospitals", recordId: actor.hospitalId,
      actorId: actor.uid, actorRole: actor.role,
      previousValues: { imageUrls: current }, updatedValues: changes,
      timestamp: now, source: "server", device: requestAuditDevice(request),
      imageAction: action, storagePath,
    });
    return imageUrls;
  });
}

function failure(error: unknown) {
  if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError || error instanceof ImageError) return apiJson({ error: error.message }, error.status);
  logApiError("/api/hospitals/[hospitalId]/images", error);
  return apiJson({ error: "We could not save the hospital images. Please try again." }, 503);
}

export async function POST(request: Request, context: { params: Promise<{ hospitalId: string }> }) {
  try {
    const actor = await authorize(request, context);
    if (actor.imageCount >= MAX_HOSPITAL_IMAGES) throw new ImageError("A centre can have up to 10 images.", 409);
    const image = await readImage(request);
    let bucket;
    try { bucket = getFirebaseAdminStorageBucket(); }
    catch { throw new ImageError("Hospital image uploads are unavailable. Ask Admin to check the Storage configuration.", 503); }
    const imageId = randomUUID();
    const path = `hospitals/${actor.hospitalId}/images/${imageId}-1200.webp`;
    const token = randomUUID();
    const variants = await Promise.all([480, 800].map(async (width) => ({
      width,
      buffer: await sharp(image).resize(width, width * 3 / 4).webp({ quality: 82 }).toBuffer(),
    })));
    variants.push({ width: 1200, buffer: image });
    await Promise.all(variants.map(({ width, buffer }) => bucket.file(`hospitals/${actor.hospitalId}/images/${imageId}-${width}.webp`).save(buffer, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: "image/webp", cacheControl: "public,max-age=31536000,immutable", metadata: { firebaseStorageDownloadTokens: token, uploadedBy: actor.uid, hospitalId: actor.hospitalId } },
    })));
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
    const imageUrls = await changeGallery(actor, request, url, "add", path);
    return apiJson({ ok: true, imageUrls }, 201);
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ hospitalId: string }> }) {
  try {
    const actor = await authorize(request, context);
    const body = await readJsonBody(request, 2_000) as { imageUrl?: unknown } | null;
    if (typeof body?.imageUrl !== "string") throw new ImageError("Choose an image to remove.", 400);
    const imageUrls = await changeGallery(actor, request, body.imageUrl, "remove", null);
    return apiJson({ ok: true, imageUrls });
  } catch (error) { return failure(error); }
}
