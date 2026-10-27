/** Shared transport for the website enquiry form and Ayu. Never auto-retry email. */
export async function sendContactEnquiry(fields: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch("/api/contact", {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields),
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    if (!response.ok || result?.ok !== true) throw new Error(result?.error || "We could not confirm your message was sent. Please contact info@ayursarga.com.");
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
