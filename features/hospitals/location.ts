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

const MAX_LOCATION_URL_LENGTH = 2000;

function extractLocationUrl(value: unknown) {
  const input = String(value ?? "").trim();
  if (!input) return "";
  if (!/<iframe\b/i.test(input)) return input;
  const source = input.match(/\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  return (source?.[1] ?? source?.[2] ?? source?.[3] ?? "").replaceAll("&amp;", "&").trim();
}

function isSupportedMapUrl(parsed: URL) {
  const hostname = parsed.hostname.toLowerCase();
  const isSupportedHost = SUPPORTED_MAP_HOSTS.has(hostname);
  const requiresMapsPath = hostname === "www.google.com" || hostname === "www.google.co.in" || hostname === "goo.gl";
  return parsed.protocol === "https:" && isSupportedHost && (!requiresMapsPath || parsed.pathname.startsWith("/maps"));
}

export function validateHospitalLocationUrl(value: unknown) {
  const locationUrl = extractLocationUrl(value);
  if (!locationUrl) return { locationUrl: null, error: null };
  if (locationUrl.length > MAX_LOCATION_URL_LENGTH) return { locationUrl: null, error: `The map link must be ${MAX_LOCATION_URL_LENGTH} characters or fewer.` };

  try {
    const parsed = new URL(locationUrl);
    if (!isSupportedMapUrl(parsed)) throw new Error();
    return { locationUrl: parsed.toString(), error: null };
  } catch {
    return { locationUrl: null, error: "Paste a valid Google Maps or OpenStreetMap embed code or HTTPS link." };
  }
}

export function getHospitalMapEmbedUrl(locationUrl: string, fallbackAddress: string) {
  try {
    const parsed = new URL(locationUrl);
    if (!isSupportedMapUrl(parsed)) return null;
    const hostname = parsed.hostname.toLowerCase();
    const isOpenStreetMap = hostname.includes("openstreetmap.org");
    if (isOpenStreetMap && parsed.pathname === "/export/embed.html") return parsed.toString();
    if (!isOpenStreetMap && (parsed.pathname.startsWith("/maps/embed") || parsed.searchParams.get("output") === "embed")) return parsed.toString();

    const coordinates = decodeURIComponent(parsed.href).match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (coordinates) {
      return `https://www.google.com/maps?q=${encodeURIComponent(`${coordinates[1]},${coordinates[2]}`)}&z=16&output=embed`;
    }
    const query = parsed.searchParams.get("q")?.trim();
    if (query) return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  } catch {
    return null;
  }

  return fallbackAddress.trim()
    ? `https://www.google.com/maps?q=${encodeURIComponent(fallbackAddress.trim())}&output=embed`
    : null;
}
