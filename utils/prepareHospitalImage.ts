"use client";

/** Bound the request size before sending to the authenticated upload endpoint. */
export async function prepareHospitalImage(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG or WebP image.");
  }
  if (file.size > 15 * 1024 * 1024) throw new Error("Choose an image smaller than 15 MB.");
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode().catch(() => { throw new Error("This image could not be opened. Choose another JPG, PNG or WebP image."); });
    const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    if (!blob || blob.size > 3 * 1024 * 1024) throw new Error("This image is too large to upload. Choose a smaller image.");
    return blob;
  } finally {
    URL.revokeObjectURL(source);
  }
}
