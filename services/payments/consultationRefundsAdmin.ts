import "server-only";
import { Timestamp, type Firestore, type DocumentData } from "firebase-admin/firestore";
import { bookingChangeReason } from "@/features/bookings/changeReason";
import { consultationCancellationEligibility, validCancellationSnapshot } from "@/features/consultations/cancellationPolicy";
import type { ConsultationRefundQuote, ConsultationRefundSummary } from "@/features/payments/refunds";
import { auditPayment, hashPaymentValue, ConsultationPaymentError } from "@/services/payments/consultationPaymentsAdmin";
import { createRazorpayRefund, fetchRazorpayPayment, fetchRazorpayRefund, listRazorpayRefunds, getRazorpayReadiness, type RazorpayPayment, type RazorpayRefund } from "@/services/payments/razorpay";
import { queueConsultationEmail } from "@/services/email/consultationEmailService";
import { consultationFinancialTotals } from "@/features/payments/consultationFinance";
import { RazorpayError } from "@/services/payments/razorpay";

const COLLECTION = "consultationRefunds";
type Data = DocumentData;
const integer = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
function checkFinancial(bookingId: string, booking: Data | undefined, financial: Data | undefined) {
  if (!booking || booking.archivedAt != null || !financial || financial.archivedAt != null
    || booking.paymentIntentId !== bookingId || financial.bookingId !== bookingId || booking.paymentReference !== financial.paymentId
    || financial.mode !== getRazorpayReadiness().mode || !integer(financial.grossPaise) || !integer(financial.refundedPaise)
    || financial.refundedPaise > financial.grossPaise || !["paid", "partially_refunded", "refunded"].includes(financial.paymentStatus)) {
    throw new ConsultationPaymentError("This booking needs payment verification before a refund can be issued.", 409);
  }
}
function quote(bookingId: string, booking: Data, financial: Data): ConsultationRefundQuote {
  const maximumPaise = financial.grossPaise - financial.refundedPaise;
  const reference = booking.status === "cancelled" ? booking.cancelledAt?.toMillis?.() ?? NaN : Date.now();
  const valid = validCancellationSnapshot(booking.cancellationPolicy);
  const eligibility = valid ? consultationCancellationEligibility(booking.cancellationPolicy, "confirmed",
    { paidPaise: financial.grossPaise, refundedPaise: financial.refundedPaise }, reference) : null;
  const exceptionRequired = !valid || !Number.isFinite(reference) || reference > Date.parse(booking.cancellationPolicy.refundDeadlineAt);
  return { bookingId, lastAuditId: booking.lastAuditId, maximumPaise,
    suggestedPaise: Math.min(maximumPaise, eligibility?.remainingRefundPaise ?? maximumPaise), exceptionRequired,
    blocked: !["requested", "confirmed", "cancelled"].includes(booking.status) ? "This appointment cannot be cancelled here."
      : ["processed", "paid", "closed"].includes(financial.settlementStatus) || financial.settlementReference ? "A consultant transfer has already been recorded. Contact Finance for reconciliation."
      : financial.refundPendingId ? "A refund is already being checked or processed. Check its status before another refund."
      : maximumPaise === 0 ? "The verified payment has already been fully refunded." : null };
}
export async function consultationRefundQuote(firestore: Firestore, bookingId: string) {
  const [b, f] = await firestore.getAll(firestore.collection("consultationBookings").doc(bookingId), firestore.collection("consultationFinancials").doc(bookingId));
  checkFinancial(bookingId, b.data(), f.data());
  return quote(bookingId, b.data()!, f.data()!);
}
function checkPayment(financial: Data, payment: RazorpayPayment) {
  if (payment.id !== financial.paymentId || payment.order_id !== financial.orderId || payment.currency !== "INR"
    || !payment.captured || !["captured", "refunded"].includes(payment.status) || payment.amount !== financial.grossPaise
    || !integer(payment.amount_refunded) || payment.amount_refunded > payment.amount) throw new ConsultationPaymentError("Razorpay could not verify this booking's payment.", 409);
}

/** One claim blocks concurrent refunds and payouts before the external request.
 * Cancellation is already durable; provider failure never restores an appointment.
 */
export async function initiateConsultationRefund(firestore: Firestore, bookingId: string, actorId: string, input: {
  requestId: string; expectedAuditId: string; reason: string; amountPaise: number; exceptionApproved: boolean;
}) {
  const id = `ar_${hashPaymentValue(`${bookingId}:${actorId}:${input.requestId}`).slice(0, 32)}`;
  const hash = hashPaymentValue(JSON.stringify([bookingId, input.reason, input.amountPaise, input.exceptionApproved, input.expectedAuditId]));
  const prior = (await firestore.collection(COLLECTION).doc(id).get()).data();
  if (prior) {
    if (prior.payloadHash !== hash) throw new ConsultationPaymentError("This refund request belongs to different details. Refresh the booking.", 409);
    return checkConsultationRefund(firestore, bookingId, actorId);
  }
  const initial = (await firestore.collection("consultationFinancials").doc(bookingId).get()).data();
  if (!initial || initial.mode !== getRazorpayReadiness().mode) throw new ConsultationPaymentError("Select the configured payment mode before refunding.", 409);
  const [payment, refunds] = await Promise.all([fetchRazorpayPayment(initial.paymentId), listRazorpayRefunds(initial.paymentId)]);
  checkPayment(initial, payment);
  const reserved = refunds.filter(r => r.status !== "failed").reduce((sum, r) => sum + r.amount, 0);
  if (!Number.isSafeInteger(reserved) || reserved > payment.amount) throw new ConsultationPaymentError("Razorpay refund history needs reconciliation.");
  const claimed = await firestore.runTransaction(async transaction => {
    const ref = firestore.collection(COLLECTION).doc(id);
    const financeRef = firestore.collection("consultationFinancials").doc(bookingId);
    const bookingRef = firestore.collection("consultationBookings").doc(bookingId);
    const [previous, b, f] = await transaction.getAll(ref, bookingRef, financeRef);
    if (previous.exists) {
      if (previous.data()!.payloadHash !== hash) throw new ConsultationPaymentError("Refund request conflict.");
      return false;
    }
    const booking = b.data(); const financial = f.data();
    checkFinancial(bookingId, booking, financial); checkPayment(financial!, payment);
    if (booking!.status !== "cancelled" || booking!.lastAuditId !== input.expectedAuditId) throw new ConsultationPaymentError("Refresh the cancelled appointment before refunding.");
    const q = quote(bookingId, booking!, financial!);
    if (q.blocked) throw new ConsultationPaymentError(q.blocked);
    if ((q.exceptionRequired || input.amountPaise > q.suggestedPaise) && !input.exceptionApproved) throw new ConsultationPaymentError("Confirm the exceptional refund approval before continuing.", 400);
    const maximum = payment.amount - Math.max(payment.amount_refunded, financial!.refundedPaise, reserved);
    if (!bookingChangeReason(input.reason) || !integer(input.amountPaise) || input.amountPaise <= 0 || input.amountPaise > maximum) throw new ConsultationPaymentError("Enter a refund within the verified remaining payment amount.", 400);
    const consultant = (await transaction.get(firestore.collection("consultants").doc(booking!.consultantId))).data() ?? {};
    const now = Timestamp.now();
    const value = { bookingId, bookingReference: booking!.bookingReference, paymentId: payment.id, orderId: payment.order_id, mode: financial!.mode,
      amountPaise: input.amountPaise, refundedBeforePaise: Math.max(financial!.refundedPaise, payment.amount_refunded),
      reason: input.reason, exceptionApproved: input.exceptionApproved, policyVersion: booking!.cancellationPolicy?.policy?.version ?? null,
      cancelledAt: booking!.cancelledAt ?? null, cancelledByRole: booking!.cancelledByRole ?? null, cancelledBy: booking!.cancelledBy ?? null,
      payloadHash: hash, status: "checking", providerId: null, bankReference: null, errorCode: null,
      createdAt: now, createdBy: actorId, archivedAt: null, archivedBy: null };
    transaction.create(ref, { ...value, ...auditPayment(transaction, firestore, COLLECTION, id, null, value, actorId, "admin") });
    // Safe summary only: no commission, private request identity or payout data.
    const summary: ConsultationRefundSummary = { status: "checking", amountPaise: input.amountPaise, reference: null, bankReference: null,
      requestedAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString() };
    const changes = { refundPendingId: id, latestRefundId: id, refundSummary: summary, settlementHold: true, reviewReason: "refund_requested", netRevenuePaise: null };
    transaction.update(financeRef, { ...changes, ...auditPayment(transaction, firestore, "consultationFinancials", bookingId,
      { refundPendingId: financial!.refundPendingId ?? null, refundSummary: financial!.refundSummary ?? null }, changes, actorId, "admin") });
    const changesForBooking = { refundSummary: summary };
    const bookingMeta = auditPayment(transaction, firestore, "consultationBookings", bookingId, { refundSummary: booking!.refundSummary ?? null }, changesForBooking, actorId, "admin");
    transaction.update(bookingRef, { ...changesForBooking, ...bookingMeta });
    queueConsultationEmail(transaction, firestore, { eventId: `refund-claim-${id}`, bookingId, event: "refund_updated", booking: { ...booking, ...changesForBooking },
      consultant, consultantFee: financial!.consultantPayablePaise / 100, actorId, actorRole: "admin", auditId: bookingMeta.lastAuditId, now });
    return true;
  });
  if (!claimed) return checkConsultationRefund(firestore, bookingId, actorId);
  return submitClaimedRefund(firestore, id, actorId, payment.id, input.amountPaise);
}

/** Initial submission and explicit recovery share the exact same provider contract. */
async function submitClaimedRefund(firestore: Firestore, id: string, actorId: string, paymentId: string, amountPaise: number) {
  let refund: RazorpayRefund;
  try { refund = await createRazorpayRefund(paymentId, amountPaise, id); }
  catch (error) {
    const rejected = error instanceof RazorpayError && error.code === "API" && !error.outcomeUnknown && error.httpStatus !== 409;
    return recordRefundOutcome(firestore, id, actorId, undefined, rejected ? "provider_rejected" : "provider_outcome_unconfirmed");
  }
  return recordRefundOutcome(firestore, id, actorId, refund);
}

/** Explicit Admin recovery: locate the existing receipt first. If the POST outcome
 * is unknown, reuse ONLY its immutable provider idempotency key/body, never a new key. */
export async function checkConsultationRefund(firestore: Firestore, bookingId: string, actorId: string) {
  const financial = (await firestore.collection("consultationFinancials").doc(bookingId).get()).data();
  const id = financial?.refundPendingId ?? financial?.latestRefundId;
  if (typeof id !== "string" || !/^ar_[a-f0-9]{32}$/.test(id)) throw new ConsultationPaymentError("No refund request is recorded for this booking.", 404);
  const saved = (await firestore.collection(COLLECTION).doc(id).get()).data();
  if (!saved || saved.bookingId !== bookingId || saved.mode !== getRazorpayReadiness().mode) throw new ConsultationPaymentError("Refund details need manual verification.");
  const refund = saved.providerId ? await fetchRazorpayRefund(saved.paymentId, saved.providerId)
    : (await listRazorpayRefunds(saved.paymentId)).find(r => r.receipt === id);
  if (!refund && ["checking", "unknown"].includes(saved.status)) {
    const booking = (await firestore.collection("consultationBookings").doc(bookingId).get()).data();
    checkFinancial(bookingId, booking, financial);
    if (booking!.status !== "cancelled" || financial!.refundPendingId !== id || !financial!.settlementHold
      || financial!.settlementStatus !== "pending" || financial!.settlementReference) throw new ConsultationPaymentError("This refund needs Finance reconciliation.");
    return submitClaimedRefund(firestore, id, actorId, saved.paymentId, saved.amountPaise);
  }
  return recordRefundOutcome(firestore, id, actorId, refund, refund ? undefined : "provider_outcome_unconfirmed");
}

/** Webhook caller must first verify its signature and fetch this refund from Razorpay. */
export async function reconcileConsultationRefund(firestore: Firestore, refund: RazorpayRefund) {
  if (!refund.receipt || !/^ar_[a-f0-9]{32}$/.test(refund.receipt)) return null;
  const existing = (await firestore.collection(COLLECTION).doc(refund.receipt).get()).data();
  if (!existing) return null; // External dashboard refunds retain normal ledger reconciliation.
  return recordRefundOutcome(firestore, refund.receipt, existing.createdBy, refund);
}
/** Refreshes only an already-authorized request. Webhooks never create refunds. */
export async function refreshKnownConsultationRefund(firestore: Firestore, bookingId: string) {
  const financial = (await firestore.collection("consultationFinancials").doc(bookingId).get()).data();
  if (!financial?.latestRefundId) return null;
  const saved = (await firestore.collection(COLLECTION).doc(financial.latestRefundId).get()).data();
  if (!saved || saved.bookingId !== bookingId) throw new ConsultationPaymentError("Refund request needs reconciliation.");
  const refund = saved.providerId ? await fetchRazorpayRefund(saved.paymentId, saved.providerId)
    : (await listRazorpayRefunds(saved.paymentId)).find(r => r.receipt === financial.latestRefundId);
  return refund ? reconcileConsultationRefund(firestore, refund) : null;
}
async function recordRefundOutcome(firestore: Firestore, id: string, actorId: string, refund?: RazorpayRefund, errorCode?: string) {
  const initial = (await firestore.collection(COLLECTION).doc(id).get()).data();
  let payment: RazorpayPayment | undefined;
  if (initial && refund) {
    // Refresh actual gateway fee/tax and provider refund totals. An unavailable
    // refresh never fabricates zero charges or erases already verified amounts.
    try { payment = await fetchRazorpayPayment(initial.paymentId); } catch { /* Reconcile via webhook/status check. */ }
  }
  return firestore.runTransaction(async transaction => {
    const ref = firestore.collection(COLLECTION).doc(id);
    const saved = (await transaction.get(ref)).data();
    if (!saved) throw new ConsultationPaymentError("Refund request not found.", 404);
    const bookingId = saved.bookingId as string;
    const bookingRef = firestore.collection("consultationBookings").doc(bookingId);
    const financeRef = firestore.collection("consultationFinancials").doc(bookingId);
    const [b, f] = await transaction.getAll(bookingRef, financeRef);
    const booking = b.data(); const financial = f.data();
    checkFinancial(bookingId, booking, financial);
    if (booking!.status !== "cancelled" || saved.paymentId !== financial!.paymentId) throw new ConsultationPaymentError("The cancelled booking and payment need reconciliation.");
    if (refund && (refund.receipt !== id || refund.payment_id !== saved.paymentId || refund.amount !== saved.amountPaise
      || refund.currency !== "INR" || (saved.providerId && saved.providerId !== refund.id))) throw new ConsultationPaymentError("Refund does not match the saved request.");
    const previousSummary = financial!.refundSummary as ConsultationRefundSummary | undefined;
    const totalsChanged = payment && (payment.amount_refunded > financial!.refundedPaise
      || payment.fee != null && payment.fee !== financial!.gatewayFeePaise || payment.tax != null && payment.tax !== financial!.gatewayTaxPaise);
    // Terminal states cannot be downgraded by a delayed API response/webhook.
    if (saved.status === "processed" && refund?.status !== "processed" || saved.status === "failed" && refund?.status !== "processed" || !totalsChanged && (
      (saved.status === "processed" && saved.bankReference === refund?.bankReference) || (saved.status === "failed" && refund?.status !== "processed")
      || (!refund && saved.status === "pending") || (refund && saved.status === refund.status && saved.providerId === refund.id && saved.bankReference === refund.bankReference))) {
      return { changes: { refundSummary: booking!.refundSummary ?? previousSummary }, emailEventId: null };
    }
    if (!refund && saved.status === "unknown" && saved.errorCode === errorCode) return { changes: { refundSummary: booking!.refundSummary ?? previousSummary }, emailEventId: null };
    const consultant = (await transaction.get(firestore.collection("consultants").doc(booking!.consultantId))).data() ?? {};
    if (payment) checkPayment(financial!, payment);
    const now = Timestamp.now(); const status = refund?.status ?? (errorCode === "provider_rejected" ? "failed" : "unknown");
    const summary: ConsultationRefundSummary = { status: status === "processed" ? "refunded" : status === "pending" ? "initiated" : status,
      amountPaise: saved.amountPaise, reference: refund?.id ?? saved.providerId ?? null, bankReference: refund?.bankReference ?? saved.bankReference ?? null,
      requestedAt: saved.createdAt.toDate().toISOString(), updatedAt: now.toDate().toISOString() };
    const journalChanges = { status, providerId: summary.reference, bankReference: summary.bankReference, errorCode: errorCode ?? null };
    transaction.update(ref, { ...journalChanges, ...auditPayment(transaction, firestore, COLLECTION, id,
      { status: saved.status }, journalChanges, actorId, "admin") });
    const verifiedProcessed = refund?.status === "processed" && integer(saved.refundedBeforePaise) ? saved.refundedBeforePaise + refund.amount : 0;
    if (!integer(verifiedProcessed) || verifiedProcessed > financial!.grossPaise) throw new ConsultationPaymentError("Processed refund totals need reconciliation.");
    const refundedPaise = Math.max(financial!.refundedPaise, payment?.amount_refunded ?? 0, verifiedProcessed);
    const gatewayFeePaise = payment?.fee ?? financial!.gatewayFeePaise ?? null;
    const gatewayTaxPaise = payment?.tax ?? financial!.gatewayTaxPaise ?? null;
    const paymentStatus = refundedPaise === financial!.grossPaise ? "refunded" : refundedPaise > 0 ? "partially_refunded" : "paid";
    const totals = consultationFinancialTotals({ grossPaise: financial!.grossPaise, commissionPaise: financial!.commissionPaise,
      consultantPayablePaise: financial!.consultantPayablePaise, refundedPaise, gatewayFeePaise });
    const financeChanges = { refundSummary: summary, refundPendingId: ["processed", "failed"].includes(status) && financial!.refundPendingId === id ? null : financial!.refundPendingId ?? null,
      refundedPaise, paymentStatus, gatewayFeePaise, gatewayTaxPaise, netSettlementPaise: totals.netSettlementPaise,
      settlementHold: financial!.settlementStatus === "closed" && financial!.reviewResolution === "full_refund_verified" ? false : true,
      reviewReason: financial!.reviewReason ?? "refund_review", netRevenuePaise: null };
    transaction.update(financeRef, { ...financeChanges, ...auditPayment(transaction, firestore, "consultationFinancials", bookingId,
      { refundSummary: previousSummary ?? null, gatewayFeePaise: financial!.gatewayFeePaise ?? null, gatewayTaxPaise: financial!.gatewayTaxPaise ?? null,
        refundedPaise: financial!.refundedPaise }, financeChanges, actorId, "admin") });
    const changes = { refundSummary: summary, paymentStatus, paymentTotals: { paidPaise: financial!.grossPaise, refundedPaise } };
    const meta = auditPayment(transaction, firestore, "consultationBookings", bookingId, { refundSummary: booking!.refundSummary ?? null }, changes, actorId, "admin");
    transaction.update(bookingRef, { ...changes, ...meta });
    const emailEventId = `refund-${id}-${status}-${meta.lastAuditId}`;
    queueConsultationEmail(transaction, firestore, { eventId: emailEventId, bookingId, event: "refund_updated", booking: { ...booking, ...changes },
      consultant, consultantFee: financial!.consultantPayablePaise / 100, actorId, actorRole: "admin", auditId: meta.lastAuditId, now });
    return { changes: { ...changes, ...meta }, emailEventId };
  });
}
