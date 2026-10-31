import "server-only";
import sharp from "sharp";
import { RequestBodyError } from "@/services/api/request";

/** Bounded decoding, EXIF orientation and metadata-free WebP for public photos. */
export async function readImageUpload(request: Request, width: number, height: number, maximumBytes = 15 * 1024 * 1024) {
  if (!["image/webp", "image/jpeg", "image/png"].includes(request.headers.get("content-type") ?? "")) throw new RequestBodyError("Choose a JPG, PNG or WebP image.", 415);
  if (Number(request.headers.get("content-length") ?? 0) > maximumBytes) throw new RequestBodyError("This image is too large to upload.", 413);
  if (!request.body) throw new RequestBodyError("Choose an image to upload.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) {
      await reader.cancel().catch(() => undefined);
      throw new RequestBodyError("This image is too large to upload.", 413);
    }
    chunks.push(value);
  }
  try {
    const processor = sharp(Buffer.concat(chunks), { limitInputPixels: 25_000_000, animated: false });
    const metadata = await processor.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error("Invalid format");
    return await processor.rotate().resize(width, height, { fit: "cover", position: "attention" }).webp({ quality: 84 }).toBuffer();
  } catch {
    throw new RequestBodyError("This image could not be processed. Choose another JPG, PNG or WebP image.", 400);
  }
}
