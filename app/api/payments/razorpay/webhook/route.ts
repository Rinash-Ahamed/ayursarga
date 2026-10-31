import { after } from "next/server";
import { readRawJsonBody, RequestBodyError } from "@/services/api/request";
import { apiJson } from "@/services/api/server";
import { getFirebaseAdminFirestore } from "@/services/firebase/admin";
import { fetchRazorpayOrder, fetchRazorpayPayment, verifyRazorpayWebhookSignature } from "@/services/payments/razorpay";
import { hashPaymentValue, reconcileConsultationPayment, ConsultationPaymentError } from "@/services/payments/consultationPaymentsAdmin";
import { deliverConsultationEmails } from "@/services/email/consultationEmailService";

export const runtime = "nodejs";
export const maxDuration = 60;
const EVENTS = new Set(["payment.captured", "payment.failed", "refund.created", "refund.processed", "refund.failed"]);

export async function POST(request: Request) {
  try {
    const raw = await readRawJsonBody(request, 64_000);
    if (!verifyRazorpayWebhookSignature(raw, request.headers.get("x-razorpay-signature"))) return apiJson({ error: "Invalid signature." }, 400);
    const eventId = request.headers.get("x-razorpay-event-id");
    if (!eventId || !/^[A-Za-z0-9_-]{1,150}$/.test(eventId)) return apiJson({ error: "Invalid event reference." }, 400);
    let body;
    try { body = JSON.parse(new TextDecoder().decode(raw)); } catch { return apiJson({ error: "Invalid JSON." }, 400); }
    if (body?.entity !== "event" || typeof body.event !== "string") return apiJson({ error: "Invalid event." }, 400);
    if (!EVENTS.has(body.event)) return apiJson({ ok: true, ignored: true });
    const paymentId = body.payload?.payment?.entity?.id ?? body.payload?.refund?.entity?.payment_id;
    if (typeof paymentId !== "string" || !/^pay_[A-Za-z0-9]{1,64}$/.test(paymentId)) return apiJson({ error: "Missing payment reference." }, 400);
    const firestore = getFirebaseAdminFirestore();
    const digest = hashPaymentValue(raw);
    const prior = (await firestore.collection("razorpayWebhookEvents").doc(hashPaymentValue(eventId)).get()).data();
    if (prior) return prior.digest === digest ? apiJson({ ok: true, duplicate: true }) : apiJson({ error: "Event reference conflict." }, 409);
    const payment = await fetchRazorpayPayment(paymentId);
    if (!payment.order_id) return apiJson({ ok: true, ignored: true });
    const order = await fetchRazorpayOrder(payment.order_id);
    if (!order.receipt?.startsWith("cp_")) return apiJson({ ok: true, ignored: true });
    const receipt = (await firestore.collection("consultationPaymentReceipts").doc(order.receipt).get()).data();
    if (!receipt) return apiJson({ error: "Payment intent is not available yet." }, 503);
    const checkout = await reconcileConsultationPayment(firestore, String(receipt.intentId), paymentId, { id: eventId, digest, type: body.event }, { payment, order });
    if (checkout.bookingId) after(() => deliverConsultationEmails(firestore, `confirmation-${checkout.intentId}`).then(() => undefined));
    return apiJson({ ok: true });
  } catch (error) {
    if (error instanceof RequestBodyError) return apiJson({ error: error.message }, error.status);
    if (error instanceof ConsultationPaymentError) return apiJson({ error: "Payment event requires reconciliation." }, error.status >= 500 ? error.status : 409);
    return apiJson({ error: "Payment event could not be recorded. Retry later." }, 503);
  }
}
