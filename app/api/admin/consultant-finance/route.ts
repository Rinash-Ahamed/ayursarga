import { withApiTiming, timeApiStep } from "@/services/api/timing";
import { AggregateField, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { apiJson } from "@/services/api/server";
import { allowRequest } from "@/services/api/rateLimit";
import { auditPayment, ConsultationPaymentError, isConsultationIntentId } from "@/services/payments/consultationPaymentsAdmin";
import { fetchRazorpayPayment, getRazorpayReadiness } from "@/services/payments/razorpay";
import { isIsoDate, toDateInputValue } from "@/utils/date";

export const runtime = "nodejs";
function record(id: string, data: DocumentData) {
  // Admin API still uses a whitelist: no draft contacts, provider payloads or credentials.
  const fields = ["bookingId", "bookingReference", "consultantId", "consultantName", "consumerName", "serviceName", "paymentId", "orderId", "mode",
    "grossPaise", "commissionPaise", "consultantPayablePaise", "commissionPercentage", "gatewayFeePaise", "gatewayTaxPaise", "refundedPaise", "netSettlementPaise", "netRevenuePaise",
    "paymentStatus", "settlementStatus", "settlementHold", "reviewReason", "reviewResolution", "reviewResolvedAt", "reviewResolutionNotes", "settlementReference", "settlementDate", "settlementNotes", "lastAuditId", "refundSummary"];
  return { id, ...Object.fromEntries(fields.map(key => [key, data[key] ?? null])),
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null, updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null };
}
async function handleGET(request: Request) {
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
    const [page, aggregates, setupIssues, pending, paid, review, feeUnknown] = await timeApiStep("database", () => Promise.all([query.get(), scope.aggregate({
      // Aggregations stay bounded server-side, not full-collection downloads.
      count: AggregateField.count(), grossPaise: AggregateField.sum("grossPaise"), commissionPaise: AggregateField.sum("commissionPaise"),
      gatewayFeePaise: AggregateField.sum("gatewayFeePaise"), refundedPaise: AggregateField.sum("refundedPaise"),
    }).get(), firestore.collection("consultationPaymentIntents").where("mode", "==", mode)
      .where("state", "in", ["creating", "order_unknown"]).orderBy("createdAt", "desc").limit(10).get(),
      scope.where("settlementStatus", "in", ["pending", "processed"]).where("settlementHold", "==", false).aggregate({ payable: AggregateField.sum("consultantPayablePaise") }).get(),
      scope.where("settlementStatus", "==", "paid").aggregate({ payable: AggregateField.sum("consultantPayablePaise") }).get(),
      scope.where("settlementHold", "==", true).count().get(),
      scope.where("gatewayFeePaise", "==", null).count().get(),
    ]));
    const docs = page.docs.slice(0, 20);
    return apiJson({ documents: docs.map(doc => record(doc.id, doc.data())), cursor: docs.at(-1)?.id ?? null, hasMore: page.size > 20, mode,
      setupIssues: setupIssues.docs.map(doc => ({ id: doc.id, receipt: doc.data().receipt, state: doc.data().state,
        consultantName: doc.data().draft?.consultantName ?? "Consultant", totalPaise: doc.data().amountPaise })),
      summary: { ...aggregates.data(), pendingPayablePaise: pending.data().payable, paidPayablePaise: paid.data().payable, reviewCount: review.data().count, unknownFeeCount: feeUnknown.data().count } });
  } catch (error) { return failure(error); }
}
async function handlePATCH(request: Request) {
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
      if (financial.lastAuditId !== values.expectedAuditId || ["paid", "closed"].includes(financial.settlementStatus)) throw new ConsultationPaymentError("This settlement changed. Refresh before continuing.");
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
/** Closes only verified full refunds; never allocates partial refunds or moves money. */
async function handlePOST(request: Request) {
  try {
    const { uid, firestore } = await requireActiveAdmin(request);
    if (!allowRequest(`consultant-review:${uid}`, 20, 10 * 60 * 1000)) return apiJson({ error: "Please wait before checking more refunds." }, 429);
    const body = await readJsonBody(request, 1500) as Record<string, unknown> | null;
    if (!body || typeof body.id !== "string" || !isConsultationIntentId(body.id) || typeof body.expectedAuditId !== "string"
      || typeof body.notes !== "string" || body.notes.trim().length < 3 || body.notes.length > 500
      || Object.keys(body).some(key => !["id", "expectedAuditId", "notes"].includes(key))) return apiJson({ error: "Add a short review note before checking the refund." }, 400);
    const ref = firestore.collection("consultationFinancials").doc(body.id);
    const reviewNotes = body.notes.trim();
    const initial = (await ref.get()).data();
    if (!initial) throw new ConsultationPaymentError("Financial record not found.", 404);
    if (initial.reviewResolution === "full_refund_verified" && initial.settlementStatus === "closed") return apiJson({ record: record(body.id, initial) });
    if (initial.lastAuditId !== body.expectedAuditId) throw new ConsultationPaymentError("This record changed. Refresh before continuing.");
    if (initial.mode !== getRazorpayReadiness().mode) throw new ConsultationPaymentError("Select the payment mode currently configured for Razorpay.", 409);
    const payment = await fetchRazorpayPayment(initial.paymentId);
    if (payment.id !== initial.paymentId || payment.order_id !== initial.orderId || payment.currency !== "INR" || !payment.captured
      || payment.status !== "refunded" || payment.amount !== initial.grossPaise || payment.amount <= 0 || payment.amount_refunded !== payment.amount) {
      throw new ConsultationPaymentError("Razorpay has not verified a full refund. Keep this payment on hold for reconciliation.", 409);
    }
    const updated = await firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.data();
      if (!current) throw new ConsultationPaymentError("Financial record not found.", 404);
      if (current.reviewResolution === "full_refund_verified" && current.settlementStatus === "closed") return record(snapshot.id, current);
      if (current.lastAuditId !== body.expectedAuditId || current.paymentId !== payment.id || current.orderId !== payment.order_id
        || current.grossPaise !== payment.amount) throw new ConsultationPaymentError("This record changed. Refresh before continuing.");
      if (!current.settlementHold || current.settlementStatus !== "pending" || current.settlementReference || current.refundPendingId) throw new ConsultationPaymentError("A pending refund, recorded transfer or another settlement status needs reconciliation. This case cannot be closed here.");
      if (current.refundedPaise !== current.grossPaise || current.paymentStatus !== "refunded") throw new ConsultationPaymentError("The refund is not reflected in Ayursarga yet. Refresh after Razorpay updates the payment, then try again.");
      const booking = current.bookingId ? (await transaction.get(firestore.collection("consultationBookings").doc(current.bookingId))).data() : null;
      if (booking && booking.status !== "cancelled") throw new ConsultationPaymentError("Cancel the appointment before closing its refund review. This action does not cancel appointments.");
      const changes = { settlementStatus: "closed", settlementHold: false, reviewResolution: "full_refund_verified",
        reviewResolvedAt: new Date().toISOString(), reviewResolvedBy: uid, reviewResolutionNotes: reviewNotes, netRevenuePaise: null };
      const meta = auditPayment(transaction, firestore, "consultationFinancials", snapshot.id,
        { settlementStatus: current.settlementStatus, settlementHold: current.settlementHold, reviewReason: current.reviewReason }, changes, uid, "admin");
      transaction.update(ref, { ...changes, ...meta });
      return record(snapshot.id, { ...current, ...changes, ...meta });
    });
    return apiJson({ record: updated });
  } catch (error) { return failure(error); }
}
function failure(error: unknown) {
  if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError || error instanceof ConsultationPaymentError) return apiJson({ error: error.message }, error.status);
  return apiJson({ error: "Finance is unavailable right now. Refresh to try again, or contact Ayursarga support if this continues." }, 503);
}

export const GET = withApiTiming("GET /api/admin/consultant-finance", handleGET);
export const PATCH = withApiTiming("PATCH /api/admin/consultant-finance", handlePATCH);
export const POST = withApiTiming("POST /api/admin/consultant-finance", handlePOST);
