import "server-only";

/** Browser origin guard; scripts can forge headers, so this is not bot authentication. */
export function isContactRequestOriginAllowed(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  try {
    const parsed = new URL(origin);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.origin !== origin) return false;
    const allowed = new Set([new URL(request.url).origin]);
    // Supports a canonical domain when a hosting proxy uses an internal request URL.
    if (process.env.APP_SITE_URL) allowed.add(new URL(process.env.APP_SITE_URL).origin);
    return allowed.has(origin);
  } catch { return false; }
}
