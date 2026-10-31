import { AggregateField, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { apiJson } from "@/services/api/server";
import { allowRequest } from "@/services/api/rateLimit";
import { auditPayment, ConsultationPaymentError, isConsultationIntentId } from "@/services/payments/consultationPaymentsAdmin";
import { getRazorpayReadiness } from "@/services/payments/razorpay";
import { isIsoDate, toDateInputValue } from "@/utils/date";

export const runtime = "nodejs";
function record(id: string, data: DocumentData) {
  // Admin API still uses a whitelist: no draft contacts, provider payloads or credentials.
  const fields = ["bookingId", "bookingReference", "consultantId", "consultantName", "consumerName", "serviceName", "paymentId", "orderId", "mode",
    "grossPaise", "commissionPaise", "consultantPayablePaise", "commissionPercentage", "gatewayFeePaise", "gatewayTaxPaise", "refundedPaise", "netSettlementPaise", "netRevenuePaise",
    "paymentStatus", "settlementStatus", "settlementHold", "reviewReason", "settlementReference", "settlementDate", "settlementNotes", "lastAuditId"];
  return { id, ...Object.fromEntries(fields.map(key => [key, data[key] ?? null])),
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null, updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null };
}
export async function GET(request: Request) {
  try {
    const { firestore } = await requireActiveAdmin(request);
    const params = new URL(request.url).searchParams;
    const mode = params.get("mode") ?? getRazorpayReadiness().mode ?? "live";
    if (!["test", "live"].includes(mode)) return apiJson({ error: "Choose Test or Live mode." }, 400);
    const collection = firestore.collection("consultationFinancials");
    const scope = collection.where("mode", "==", mode);
    let query = scope.orderBy("createdAt", "desc").limit(21);
    const cursor = params.get("cursor");
    if (cursor) {
      if (!isConsultationIntentId(cursor)) return apiJson({ error: "Invalid finance page." }, 400);
      const previous = await collection.doc(cursor).get();
      if (!previous.exists || previous.data()!.mode !== mode) return apiJson({ error: "Finance page changed. Refresh and try again." }, 409);
      query = query.startAfter(previous);
    }
    const [page, aggregates, setupIssues] = await Promise.all([query.get(), scope.aggregate({
      // Aggregations stay bounded server-side, not full-collection downloads.
      count: AggregateField.count(), grossPaise: AggregateField.sum("grossPaise"), commissionPaise: AggregateField.sum("commissionPaise"),
      gatewayFeePaise: AggregateField.sum("gatewayFeePaise"), refundedPaise: AggregateField.sum("refundedPaise"),
    }).get(), firestore.collection("consultationPaymentIntents").where("mode", "==", mode)
      .where("state", "in", ["creating", "order_unknown"]).orderBy("createdAt", "desc").limit(10).get()]);
    const [pending, paid, review, feeUnknown] = await Promise.all([
      scope.where("settlementStatus", "in", ["pending", "processed"]).where("settlementHold", "==", false).aggregate({ payable: AggregateField.sum("consultantPayablePaise") }).get(),
      scope.where("settlementStatus", "==", "paid").aggregate({ payable: AggregateField.sum("consultantPayablePaise") }).get(),
      scope.where("settlementHold", "==", true).count().get(),
      scope.where("gatewayFeePaise", "==", null).count().get(),
    ]);
    const docs = page.docs.slice(0, 20);
    return apiJson({ documents: docs.map(doc => record(doc.id, doc.data())), cursor: docs.at(-1)?.id ?? null, hasMore: page.size > 20, mode,
      setupIssues: setupIssues.docs.map(doc => ({ id: doc.id, receipt: doc.data().receipt, state: doc.data().state,
        consultantName: doc.data().draft?.consultantName ?? "Consultant", totalPaise: doc.data().amountPaise })),
      summary: { ...aggregates.data(), pendingPayablePaise: pending.data().payable, paidPayablePaise: paid.data().payable, reviewCount: review.data().count, unknownFeeCount: feeUnknown.data().count } });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    const { uid, firestore } = await requireActiveAdmin(request);
    if (!allowRequest(`consultant-settlement:${uid}`, 30, 10 * 60 * 1000)) return apiJson({ error: "Please wait before updating settlements again." }, 429);
    const body = await readJsonBody(request, 3000) as Record<string, unknown> | null;
    if (!body || typeof body.id !== "string" || !isConsultationIntentId(body.id) || typeof body.expectedAuditId !== "string"
      || !["processed", "paid"].includes(String(body.status)) || typeof body.date !== "string" || !isIsoDate(body.date) || body.date > toDateInputValue()
      || typeof body.reference !== "string" || body.reference.trim().length < 3 || body.reference.length > 120
      || typeof body.notes !== "string" || body.notes.length > 500
      || Object.keys(body).some(key => !["id", "expectedAuditId", "status", "date", "reference", "notes"].includes(key))) return apiJson({ error: "Enter a valid settlement date, transfer reference and status." }, 400);
    const values = { id: body.id, expectedAuditId: body.expectedAuditId, status: String(body.status), date: body.date,
      reference: body.reference.trim(), notes: body.notes.trim() };
    const updated = await firestore.runTransaction(async transaction => {
      const ref = firestore.collection("consultationFinancials").doc(values.id);
      const current = await transaction.get(ref);
      const financial = current.data();
      if (!financial) throw new ConsultationPaymentError("Financial record not found.", 404);
      // A lost response retry of the exact transfer is harmless and does not append another audit.
      if (financial.settlementStatus === values.status && financial.settlementReference === values.reference
        && financial.settlementDate === values.date && financial.settlementNotes === values.notes) return record(current.id, financial);
      if (financial.lastAuditId !== values.expectedAuditId || financial.settlementStatus === "paid") throw new ConsultationPaymentError("This settlement changed. Refresh before continuing.");
      const booking = financial.bookingId ? (await transaction.get(firestore.collection("consultationBookings").doc(financial.bookingId))).data() : null;
      if (financial.settlementHold || financial.refundedPaise > 0 || financial.paymentStatus !== "paid" || !booking || !["confirmed", "completed"].includes(booking.status)) {
        throw new ConsultationPaymentError("Settlement is on hold. Resolve cancellation, refund or booking review before recording a payout.");
      }
      const changes = { settlementStatus: values.status, settlementReference: values.reference, settlementDate: values.date, settlementNotes: values.notes,
        settlementRecordedAt: Timestamp.now(), settlementRecordedBy: uid };
      const meta = auditPayment(transaction, firestore, "consultationFinancials", current.id,
        { settlementStatus: financial.settlementStatus, settlementReference: financial.settlementReference }, changes, uid, "admin");
      transaction.update(ref, { ...changes, ...meta });
      return record(current.id, { ...financial, ...changes, ...meta });
    });
    return apiJson({ record: updated });
  } catch (error) { return failure(error); }
}
function failure(error: unknown) {
  if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError || error instanceof ConsultationPaymentError) return apiJson({ error: error.message }, error.status);
  return apiJson({ error: "Finance is temporarily unavailable. Check configuration and required indexes." }, 503);
}
