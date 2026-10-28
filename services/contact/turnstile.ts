import "server-only";
import type { ContactSource } from "@/features/contact/validation";

export const isTurnstileReady = () => Boolean(process.env.TURNSTILE_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());

/** Fail closed. Never log tokens/provider payloads or retry an email operation. */
export async function verifyEnquiryTurnstile(token: unknown, source: ContactSource, hostname: string) {
  if (!isTurnstileReady()) return "unavailable";
  if (typeof token !== "string" || !token.trim() || token.length > 2048) return "invalid";
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY!.trim(), response: token }),
    });
    if (!response.ok) return "unavailable";
    const result: unknown = await response.json();
    if (!result || typeof result !== "object") return "unavailable";
    const verified = result as Record<string, unknown>;
    return verified.success === true && verified.hostname === hostname && verified.action === `${source}_enquiry` ? "valid" : "invalid";
  } catch { return "unavailable"; }
}
