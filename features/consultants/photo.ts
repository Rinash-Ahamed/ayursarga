/** Only individually tokenized, server-uploaded consultant portraits are public. */
export function consultantPhotoUrl(value: unknown, consultantId: string): string | null {
  if (typeof value !== "string" || value.length > 1000) return null;
  try {
    const url = new URL(value);
    const objectPath = decodeURIComponent(url.pathname.split("/o/")[1] ?? "");
    if (url.protocol !== "https:" || url.hostname !== "firebasestorage.googleapis.com"
      || !url.pathname.startsWith("/v0/b/") || url.searchParams.get("alt") !== "media"
      || !url.searchParams.get("token") || !objectPath.startsWith(`consultants/${consultantId}/images/`)
      || !/^[a-f0-9-]{36}\.webp$/.test(objectPath.slice(`consultants/${consultantId}/images/`.length))) return null;
    return url.href;
  } catch { return null; }
}
