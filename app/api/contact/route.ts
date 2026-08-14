import type { ContactEmailData } from "@/lib/contactEmail";
import { apiHealth, apiJson } from "@/services/api/server";
import { isContactEmailReady, sendContactEmail } from "@/services/contact/contactEmailService";
import { isValidEmail, toTrimmedString } from "@/utils/text";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16_000;

export function GET() {
  return apiHealth("/api/contact", [{ name: "email", ready: isContactEmailReady() }]);
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_REQUEST_BYTES) return apiJson({ error: "Request is too large." }, 413);
    const input: unknown = await request.json();
    const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
    if (body.website) return apiJson({ ok: true });

    const data: ContactEmailData = {
      name: toTrimmedString(body.name, 100), email: toTrimmedString(body.email, 160),
      phone: toTrimmedString(body.phone, 50), interest: toTrimmedString(body.interest, 100),
      message: toTrimmedString(body.message, 3000), matchProfile: toTrimmedString(body.matchProfile, 2000),
    };
    if (!data.name || !data.phone || !data.interest || !isValidEmail(data.email)) {
      return apiJson({ error: "Please complete all required fields." }, 400);
    }

    if (!isContactEmailReady()) {
      return apiJson({ error: "Email service is not configured." }, 503);
    }

    await sendContactEmail(data);
    return apiJson({ ok: true });
  } catch (error) {
    console.error("Contact email failed", error instanceof Error ? error.message : error);
    return apiJson({ error: "We could not send your request. Please try again." }, 502);
  }
}
