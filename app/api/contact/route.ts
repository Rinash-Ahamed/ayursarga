import { randomUUID } from "node:crypto";
import { apiHealth, apiJson, logApiError } from "@/services/api/server";
import { isContactEmailReady, sendContactEmail } from "@/services/contact/contactEmailService";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { validateContactEnquiry, type ContactSource } from "@/features/contact/validation";
import { isContactRequestOriginAllowed } from "@/services/contact/contactRequestSecurity";
import { isTurnstileReady, verifyEnquiryTurnstile } from "@/services/contact/turnstile";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16_000;
export function GET() {
  return apiHealth("/api/contact", [{ name: "email", ready: isContactEmailReady() }, { name: "turnstile", ready: isTurnstileReady() }]);
}

export async function POST(request: Request) {
  const requestId = `ENQ-${randomUUID()}`;
  const receivedAt = new Date().toISOString();
  let source: ContactSource = "contact";
  const fingerprint = requestFingerprint(request, "contact", { includeUserAgent: false });
  // References join email to private hosting logs; never log contacts/messages,
  // raw IPs, authentication headers or secrets. This does not identify a person.
  const trace = (outcome: string, reason?: string) => console.info(JSON.stringify({ event: "contact_enquiry", requestId, receivedAt, source, outcome, reason, fingerprint }));
  const reply = (body: Record<string, unknown>, status = 200) => apiJson({ ...body, requestId }, status);
  try {
    if (!allowRequest(fingerprint, 5, 10 * 60 * 1000)) {
      trace("rejected", "rate_limited");
      return reply({ error: "Too many requests were sent. Please wait a few minutes and try again." }, 429);
    }
    if (!isContactRequestOriginAllowed(request)) { trace("rejected", "origin"); return reply({ error: "Please send your enquiry from the Ayursarga website." }, 403); }
    const input = await readJsonBody(request, MAX_REQUEST_BYTES);
    const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
    source = body.source === "ayu" ? "ayu" : "contact";
    if (body.website) { trace("ignored", "honeypot"); return reply({ ok: true }); }
    if (body.source != null && body.source !== "ayu" && body.source !== "contact") { trace("rejected", "source"); return reply({ error: "Please reopen the enquiry form and try again." }, 400); }
    const validation = validateContactEnquiry(body, source);
    if (validation.error) { trace("rejected", validation.reason ?? "validation"); return reply({ error: validation.error }, 400); }

    if (!isContactEmailReady()) {
      trace("unavailable", "email_configuration");
      return reply({ error: "Email service is not configured." }, 503);
    }

    const verification = await verifyEnquiryTurnstile(body.turnstileToken, source, new URL(request.headers.get("origin")!).hostname);
    if (verification !== "valid") {
      trace(verification === "invalid" ? "rejected" : "unavailable", "verification");
      return reply({ error: verification === "invalid" ? "Please complete the security verification again before sending." : "Security verification is unavailable. Please retry or email info@ayursarga.com." }, verification === "invalid" ? 400 : 503);
    }
    await sendContactEmail(validation.data, { reference: requestId, receivedAt, source });
    trace("smtp_accepted");
    return reply({ ok: true });
  } catch (error) {
    if (error instanceof RequestBodyError) { trace("rejected", "body"); return reply({ error: error.message }, error.status); }
    trace("smtp_unconfirmed");
    logApiError("POST /api/contact", error, { requestId });
    return reply({ error: "We could not confirm your enquiry was sent. Please contact info@ayursarga.com before sending again." }, 502);
  }
}
