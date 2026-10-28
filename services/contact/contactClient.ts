import { validateContactEnquiry, type ContactSource } from "@/features/contact/validation";

/** Shared transport for the website enquiry form and Ayu. Never auto-retry email. */
export async function sendContactEnquiry(fields: Record<string, unknown>, source: ContactSource = "contact") {
  const validation = validateContactEnquiry(fields, source);
  if (validation.error) throw new Error(validation.error);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch("/api/contact", {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, source }),
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; error?: string; requestId?: string } | null;
    if (!response.ok || result?.ok !== true) {
      const reference = typeof result?.requestId === "string" && /^ENQ-[a-f0-9-]{36}$/.test(result.requestId) ? ` Reference: ${result.requestId}` : "";
      throw new Error(`${result?.error || "We could not confirm your message was sent. Please contact info@ayursarga.com."}${reference}`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Sending took longer than expected, so delivery could not be confirmed. Please contact info@ayursarga.com before sending again.");
    }
    if (error instanceof TypeError) throw new Error("The connection was interrupted, so delivery could not be confirmed. Please email info@ayursarga.com before sending again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
