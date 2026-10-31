export const MAX_HOSPITAL_IMAGES = 10;
export const MIN_PUBLIC_HOSPITAL_IMAGES = 5;

/** Responsive versions exist only for images written by our upload endpoint. */
export function hospitalImageSrcSet(url: string) {
  try {
    const parsed = new URL(url);
    const objectPath = decodeURIComponent(parsed.pathname.split("/o/")[1] ?? "");
    if (parsed.hostname !== "firebasestorage.googleapis.com"
      || !/^hospitals\/[^/]+\/images\/[a-f0-9-]{36}-1200\.webp$/.test(objectPath)) return undefined;
    return [480, 800, 1200].map((width) => {
      const variant = new URL(parsed);
      variant.pathname = parsed.pathname.replace(/-1200\.webp$/, `-${width}.webp`);
      return `${variant.href} ${width}w`;
    }).join(", ");
  } catch {
    return undefined;
  }
}

type HospitalImageSource = {
  imageUrl?: string | null;
  imageUrls?: string[];
};

function secureImageUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const url = value.trim().slice(0, 500);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;

    if (parsed.hostname === "drive.google.com") {
      const pathMatch = parsed.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)/);
      const fileId = pathMatch?.[1] ?? parsed.searchParams.get("id");
      if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) return null;
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
    }

    return url;
  } catch {
    return null;
  }
}

export function validateHospitalImageUrls(values: unknown[]) {
  const entered = values.map((value) => typeof value === "string" ? value.trim() : "").filter(Boolean);
  if (entered.length > MAX_HOSPITAL_IMAGES) {
    return { imageUrls: [], error: `Add no more than ${MAX_HOSPITAL_IMAGES} hospital images.` };
  }
  const imageUrls = entered.map(secureImageUrl);
  if (imageUrls.some((url) => !url)) {
    return { imageUrls: [], error: "Paste a valid Google Drive sharing link or a complete HTTPS image link." };
  }
  return { imageUrls: [...new Set(imageUrls as string[])], error: null };
}

export function getHospitalImageUrls(hospital: HospitalImageSource) {
  const current = Array.isArray(hospital.imageUrls) ? hospital.imageUrls : [];
  const candidates = current.length ? current : hospital.imageUrl ? [hospital.imageUrl] : [];
  return candidates.map(secureImageUrl).filter((url): url is string => Boolean(url)).slice(0, MAX_HOSPITAL_IMAGES);
}

export function hasMinimumHospitalImages(hospital: HospitalImageSource) {
  return new Set(getHospitalImageUrls(hospital)).size >= MIN_PUBLIC_HOSPITAL_IMAGES;
}
