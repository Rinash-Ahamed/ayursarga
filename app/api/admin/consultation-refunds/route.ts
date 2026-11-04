import { after } from "next/server";
import { requireActiveAdmin, AdminAuthorizationError } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { mutationJson } from "@/services/api/mutation";
import { withApiTiming } from "@/services/api/timing";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest } from "@/services/api/rateLimit";
import { isConsultationIntentId, ConsultationPaymentError } from "@/services/payments/consultationPaymentsAdmin";
import { consultationRefundQuote, initiateConsultationRefund, checkConsultationRefund } from "@/services/payments/consultationRefundsAdmin";
import { bookingChangeReason } from "@/features/bookings/changeReason";
import { deliverConsultationEmails, consultationEmailStatuses } from "@/services/email/consultationEmailService";

export const runtime = "nodejs";
export const maxDuration = 60;
async function handleGET(request: Request) {
  try {
    const { uid, firestore } = await requireActiveAdmin(request);
    if (!allowRequest(`consultation-refund-read:${uid}`, 40, 600000)) return apiJson({ error: "Please wait before checking more refunds." }, 429);
    const id = new URL(request.url).searchParams.get("bookingId") ?? "";
    if (!isConsultationIntentId(id)) return apiJson({ error: "Choose a valid online consultation." }, 400);
    return apiJson({ quote: await consultationRefundQuote(firestore, id) });
  } catch (error) { return failure(error); }
}
async function handlePOST(request: Request) {
  try {
    const { uid, firestore } = await requireActiveAdmin(request);
    if (!allowRequest(`consultation-refund-write:${uid}`, 20, 600000)) return apiJson({ error: "Please wait before submitting another refund." }, 429);
    const body = await readJsonBody(request, 3000) as Record<string, unknown> | null;
    if (!body || typeof body.bookingId !== "string" || !isConsultationIntentId(body.bookingId)) return apiJson({ error: "Choose a valid online consultation." }, 400);
    let result;
    if (body.action === "check" && Object.keys(body).every(key => ["bookingId", "action"].includes(key))) {
      result = await checkConsultationRefund(firestore, body.bookingId, uid);
    } else {
      const reason = bookingChangeReason(body.reason);
      if (body.action !== "refund" || !reason || typeof body.requestId !== "string" || !/^[A-Za-z0-9-]{16,100}$/.test(body.requestId)
        || typeof body.expectedAuditId !== "string" || !body.expectedAuditId || body.expectedAuditId.length > 160
        || !Number.isSafeInteger(body.amountPaise) || Number(body.amountPaise) <= 0 || typeof body.exceptionApproved !== "boolean"
        || Object.keys(body).some(key => !["bookingId", "action", "requestId", "expectedAuditId", "reason", "amountPaise", "exceptionApproved"].includes(key))) return apiJson({ error: "Enter a reason and valid refund amount, then confirm the request." }, 400);
      result = await initiateConsultationRefund(firestore, body.bookingId, uid, { requestId: body.requestId,
        expectedAuditId: body.expectedAuditId, reason, amountPaise: Number(body.amountPaise), exceptionApproved: body.exceptionApproved });
    }
    const statuses = result.emailEventId ? await consultationEmailStatuses(firestore, result.emailEventId, body.bookingId) : undefined;
    if (result.emailEventId) { const event = result.emailEventId; after(() => deliverConsultationEmails(firestore, event).then(() => undefined)); }
    return mutationJson(result.changes, statuses);
  } catch (error) { return failure(error); }
}
function failure(error: unknown) {
  if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError || error instanceof ConsultationPaymentError) return apiJson({ error: error.message }, error.status);
  logApiError("/api/admin/consultation-refunds", error);
  return apiJson({ error: "Refund could not be confirmed. Check its status before submitting another request. The appointment remains cancelled if cancellation was already saved." }, 503);
}
export const GET = withApiTiming("GET /api/admin/consultation-refunds", handleGET);
export const POST = withApiTiming("POST /api/admin/consultation-refunds", handlePOST);
