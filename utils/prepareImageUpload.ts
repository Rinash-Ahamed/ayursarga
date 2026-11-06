"use client";

/** Bound upload requests; server validation and re-encoding remain authoritative. */
export async function prepareImageUpload(file: File, maximumSourceBytes: number): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size <= 0) throw new Error("Choose a JPG, PNG or WebP photo.");
  if (file.size > maximumSourceBytes) throw new Error(`Choose a photo up to ${maximumSourceBytes / (1024 * 1024)} MB.`);
  const source = URL.createObjectURL(file);
  let canvas: HTMLCanvasElement | undefined;
  try {
    const image = new Image();
    image.src = source;
    await image.decode().catch(() => { throw new Error("This photo could not be opened. Choose another JPG, PNG or WebP photo."); });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 25_000_000) throw new Error("This photo is too large to process. Choose a photo with smaller dimensions.");
    const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo preparation is unavailable in this browser. Try another browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Safari may fall back to PNG; preserve its actual MIME type and check size.
    const blob = await new Promise<Blob | null>((resolve) => canvas!.toBlob(resolve, "image/webp", 0.86));
    if (!blob || blob.size <= 0 || blob.size > 3 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(blob.type)) throw new Error("This photo could not be prepared for upload. Choose a smaller photo.");
    return blob;
  } finally {
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    URL.revokeObjectURL(source);
  }
}
