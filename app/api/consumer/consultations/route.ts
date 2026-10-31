import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest } from "@/services/api/rateLimit";
import { apiJson } from "@/services/api/server";
import { prepareConsultationPayment, ConsultationPaymentError } from "@/services/payments/consultationPaymentsAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

/** New WellnessPath requests require verified payment. Hospital booking route is independent. */
export async function POST(request: Request) {
  try {
    const { uid, firestore } = await requireActiveUser(request, ["consumer"]);
    if (!allowRequest(`consultation-payment:${uid}`, 20, 10 * 60 * 1000)) return apiJson({ error: "Please wait before trying again." }, 429);
    const body = await readJsonBody(request, 6000);
    if (!body || typeof body !== "object" || Array.isArray(body)) return apiJson({ error: "Consultation details are required." }, 400);
    if ((body as Record<string, unknown>).checkoutVersion !== 1) return apiJson({ error: "Consultations now require payment. Refresh the page before continuing." }, 409);
    return apiJson({ ok: true, checkout: await prepareConsultationPayment(firestore, uid, body as Record<string, unknown>) });
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError || error instanceof ConsultationPaymentError) return apiJson({ error: error.message }, error.status);
    return apiJson({ error: "Payment setup could not be confirmed. Contact Ayursarga before starting another payment." }, 503);
  }
}
