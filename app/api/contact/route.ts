import type { ContactEmailData } from "@/lib/contactEmail";
import { apiHealth, apiJson, logApiError } from "@/services/api/server";
import { isContactEmailReady, sendContactEmail } from "@/services/contact/contactEmailService";
import { isValidEmail, toTrimmedString } from "@/utils/text";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16_000;
const CONTACT_INTERESTS = new Set([
  "Ayurvedic hospital partnership",
  "Postnatal recovery",
  "Rejuvenation",
  "Stress management",
  "Women's wellness",
  "Prenatal and maternity care",
  "Baby care and lactation support",
  "I need personal guidance",
]);
const CONTACT_PHONE = /^[+()\d\s-]{7,25}$/;

export function GET() {
  return apiHealth("/api/contact", [{ name: "email", ready: isContactEmailReady() }]);
}

export async function POST(request: Request) {
  try {
    if (!allowRequest(requestFingerprint(request, "contact"), 5, 10 * 60 * 1000)) {
      return apiJson({ error: "Too many requests were sent. Please wait a few minutes and try again." }, 429);
    }
    const input = await readJsonBody(request, MAX_REQUEST_BYTES);
    const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
    if (body.website) return apiJson({ ok: true });

    const data: ContactEmailData = {
      name: toTrimmedString(body.name, 100), email: toTrimmedString(body.email, 160),
      phone: toTrimmedString(body.phone, 50), interest: toTrimmedString(body.interest, 100),
      message: toTrimmedString(body.message, 3000),
      guidanceProfile: toTrimmedString(body.guidanceProfile, 1200),
    };
    if (!data.name || !CONTACT_PHONE.test(data.phone) || !CONTACT_INTERESTS.has(data.interest) || !isValidEmail(data.email)) {
      return apiJson({ error: "Please complete all required fields." }, 400);
    }

    if (!isContactEmailReady()) {
      return apiJson({ error: "Email service is not configured." }, 503);
    }

    await sendContactEmail(data);
    return apiJson({ ok: true });
  } catch (error) {
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    logApiError("POST /api/contact", error);
    return apiJson({ error: "We could not send your request. Please try again." }, 502);
  }
}
