import { after } from "next/server";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { apiJson } from "@/services/api/server";
import { allowRequest } from "@/services/api/rateLimit";
import { ownedConsultationIntent, consumerCheckout, reconcileConsultationPayment, recoverConsultationPayment, ConsultationPaymentError } from "@/services/payments/consultationPaymentsAdmin";
import { verifyRazorpayCheckoutSignature } from "@/services/payments/razorpay";
import { deliverConsultationEmails } from "@/services/email/consultationEmailService";

export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ intentId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { uid, firestore } = await requireActiveUser(request, ["consumer"]);
    const { intentId } = await context.params;
    return apiJson({ checkout: consumerCheckout(intentId, await ownedConsultationIntent(firestore, uid, intentId)) });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const { uid, firestore } = await requireActiveUser(request, ["consumer"]);
    if (!allowRequest(`consultation-verify:${uid}`, 40, 10 * 60 * 1000)) return apiJson({ error: "Please wait before checking payment again." }, 429);
    const { intentId } = await context.params;
    const intent = await ownedConsultationIntent(firestore, uid, intentId);
    const body = await readJsonBody(request, 2000) as Record<string, unknown> | null;
    if (body?.action === "check" && Object.keys(body).length === 1) {
      const checkout = await recoverConsultationPayment(firestore, uid, intentId);
      if (checkout.bookingId) after(() => deliverConsultationEmails(firestore, `confirmation-${intentId}`).then(() => undefined));
      return apiJson({ checkout });
    }
    if (!body || typeof body.paymentId !== "string" || typeof body.signature !== "string" || typeof intent.orderId !== "string"
      || !verifyRazorpayCheckoutSignature({ serverOrderId: intent.orderId, paymentId: body.paymentId, signature: body.signature })) {
      return apiJson({ error: "Payment verification failed. Check your booking status before paying again." }, 400);
    }
    const checkout = await reconcileConsultationPayment(firestore, intentId, body.paymentId);
    if (checkout.bookingId) after(() => deliverConsultationEmails(firestore, `confirmation-${intentId}`).then(() => undefined));
    return apiJson({ checkout });
  } catch (error) { return failure(error); }
}
function failure(error: unknown) {
  if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError || error instanceof ConsultationPaymentError) return apiJson({ error: error.message }, error.status);
  return apiJson({ error: "Payment verification is pending. Check your booking status or contact Ayursarga before paying again." }, 503);
}
