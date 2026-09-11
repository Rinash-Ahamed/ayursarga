const SUPPORTED_MAP_HOSTS = new Set([
  "maps.app.goo.gl",
  "maps.google.com",
  "maps.google.co.in",
  "goo.gl",
  "www.google.com",
  "www.google.co.in",
  "www.openstreetmap.org",
  "openstreetmap.org",
]);

export function validateHospitalLocationUrl(value: unknown) {
  const locationUrl = String(value ?? "").trim();
  if (!locationUrl) return { locationUrl: null, error: null };
  if (locationUrl.length > 500) return { locationUrl: null, error: "The location link must be 500 characters or fewer." };

  try {
    const parsed = new URL(locationUrl);
    const isSupportedHost = SUPPORTED_MAP_HOSTS.has(parsed.hostname.toLowerCase());
    const hostname = parsed.hostname.toLowerCase();
    const requiresMapsPath = hostname === "www.google.com" || hostname === "www.google.co.in" || hostname === "goo.gl";
    const isGooglePath = !requiresMapsPath || parsed.pathname.startsWith("/maps");
    if (parsed.protocol !== "https:" || !isSupportedHost || !isGooglePath) throw new Error();
    return { locationUrl: parsed.toString(), error: null };
  } catch {
    return { locationUrl: null, error: "Paste a valid Google Maps or OpenStreetMap HTTPS location link." };
  }
}
