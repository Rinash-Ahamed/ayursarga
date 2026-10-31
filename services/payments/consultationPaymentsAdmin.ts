import "server-only";
import { createHash } from "node:crypto";
import { Timestamp, type Firestore, type Transaction, type DocumentData } from "firebase-admin/firestore";
import { consultationService } from "@/features/consultations/catalog";
import { publicConsultantProjection } from "@/features/consultations/publicProjection";
import { getConsultantPricing } from "@/features/consultants/pricing";
import { CONSULTANT_TIME_SLOTS, type ConsultantTimeSlot } from "@/features/consultants/validation";
import { BOOKING_TERMS_VERSION, CUSTOMER_TERMS_VERSION, CONSUMER_PRIVACY_NOTICE_VERSION } from "@/features/consumers/privacyConsent";
import { validConsultationSchedule } from "@/features/consultations/schedule";
import { isConsultantDateAvailable } from "@/features/consultations/availability";
import { isIsoDate, toDateInputValue } from "@/utils/date";
import { isValidPhoneNumber } from "@/utils/phone";
import { consultationFinancialTotals } from "@/features/payments/consultationFinance";
import type { ConsultationCheckout } from "@/features/payments/checkout";
import { reserveBookingReference } from "@/services/bookings/bookingReferenceAdmin";
import { consultationAdminRecipients, addConsultationNotification } from "@/services/consultations/consultationNotificationsAdmin";
import { queueConsultationEmail } from "@/services/email/consultationEmailService";
import { readConsultationCancellationPolicy } from "@/services/consultations/cancellationPolicyAdmin";
import { snapshotConsultationCancellation } from "@/features/consultations/cancellationPolicy";
import { createRazorpayOrder, fetchRazorpayOrder, fetchRazorpayPayment, fetchRazorpayOrderPayments, getRazorpayReadiness, razorpayCheckoutKey, rupeesToPaise, type RazorpayPayment, type RazorpayOrder } from "@/services/payments/razorpay";

export class ConsultationPaymentError extends Error { constructor(message: string, public status = 409) { super(message); } }
export const isConsultationIntentId = (id: string) => /^consultation-[a-f0-9]{64}$/.test(id);
export const hashPaymentValue = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
type Data = DocumentData; // Firestore operational documents, never returned wholesale to Consumers.

export function auditPayment(transaction: Transaction, firestore: Firestore, module: string, id: string, before: Data | null, after: Data, actorId: string, actorRole: "admin" | "consumer") {
  const audit = firestore.collection("auditLogs").doc();
  const now = Timestamp.now();
  transaction.create(audit, { action: before ? "update" : "create", module, recordId: id, actorId, actorRole,
    previousValues: before, updatedValues: after, timestamp: now, source: "server" });
  return { lastAuditId: audit.id, updatedAt: now, updatedBy: actorId };
}

function completedProfile(profile: Data | undefined) {
  return profile?.role === "consumer" && profile.status === "active" && profile.archivedAt == null
    && profile.privacyConsentVersion === CONSUMER_PRIVACY_NOTICE_VERSION && profile.customerTermsVersion === CUSTOMER_TERMS_VERSION
    && profile.privacyConsentAt && profile.customerTermsAcceptedAt && typeof profile.phone === "string" && isValidPhoneNumber(profile.phone.trim());
}

/** The only Consumer projection of an intent. No commission, payout or settlement data. */
export function consumerCheckout(id: string, value: Data): ConsultationCheckout {
  const ready = value.state === "ready" && typeof value.orderId === "string" && value.mode === getRazorpayReadiness().mode;
  return { intentId: id, state: String(value.state), bookingId: typeof value.bookingId === "string" ? value.bookingId : null,
    bookingReference: typeof value.bookingReference === "string" ? value.bookingReference : null,
    totalPaise: Number(value.amountPaise), currency: "INR",
    ...(value.draft?.cancellationPolicy ? { cancellationPolicy: value.draft.cancellationPolicy } : {}),
    ...(value.draft ? { consultantName: String(value.draft.consultantName), serviceName: String(value.draft.serviceName),
      date: String(value.draft.preferredDate), timeWindow: `${value.draft.slotStartTime} - ${value.draft.slotEndTime}` } : {}),
    ...(ready ? { keyId: razorpayCheckoutKey(), orderId: value.orderId } : {}) };
}

export async function prepareConsultationPayment(firestore: Firestore, uid: string, body: Data) {
  if (body.bookingTermsAccepted !== true) throw new ConsultationPaymentError("Accept the booking terms and policies.", 400);
  const service = consultationService(body.serviceId);
  const { consultantId, preferredDate: date, preferredTimeSlot: slot, requestId, expectedCharge } = body;
  const notes = typeof body.consumerNotes === "string" ? body.consumerNotes.trim() : "";
  if (!service || typeof consultantId !== "string" || !/^AS\d{3,}$/.test(consultantId) || consultantId.length > 40
    || typeof requestId !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(requestId) || !isIsoDate(date) || date < toDateInputValue()
    || !CONSULTANT_TIME_SLOTS.includes(slot) || notes.length > 500 || typeof expectedCharge !== "number" || !Number.isFinite(expectedCharge)) {
    throw new ConsultationPaymentError("Choose a valid consultant, date, time window and fee.", 400);
  }
  const id = `consultation-${hashPaymentValue(`${uid}:${requestId}`)}`;
  const inputHash = hashPaymentValue(JSON.stringify([service.id, consultantId, date, slot, expectedCharge, notes, body.expectedSlotStartTime, body.expectedSlotEndTime, body.expectedCancellationPolicyVersion]));
  const legacyInputHash = hashPaymentValue(JSON.stringify([service.id, consultantId, date, slot, expectedCharge, notes, body.expectedSlotStartTime, body.expectedSlotEndTime]));
  const ref = firestore.collection("consultationPaymentIntents").doc(id);
  const receipt = `cp_${hashPaymentValue(id).slice(0, 32)}`;
  const result = await firestore.runTransaction(async transaction => {
    const [current, priorBooking, consultant, profile] = await transaction.getAll(ref,
      firestore.collection("consultationBookings").doc(id), firestore.collection("consultants").doc(consultantId), firestore.collection("users").doc(uid));
    if (!completedProfile(profile.data())) throw new ConsultationPaymentError("Complete your profile and consent before booking.");
    if (current.exists) {
      const saved = current.data()!;
      if (saved.consumerId !== uid || (saved.inputHash !== inputHash && !(saved.draft?.cancellationPolicy == null && saved.inputHash === legacyInputHash))) throw new ConsultationPaymentError("This payment attempt belongs to different details. Review your original request.");
      return { intent: current.data()!, created: false };
    }
    if (priorBooking.exists) {
      const saved = priorBooking.data()!;
      if (saved.consumerId !== uid || saved.consultantId !== consultantId || saved.serviceId !== service.id || saved.preferredDate !== date
        || saved.preferredTimeSlot !== slot || saved.consultantCharge !== expectedCharge) throw new ConsultationPaymentError("This request already belongs to a different booking.");
      return { intent: { state: "legacy_booking", bookingId: id, bookingReference: saved.bookingReference, amountPaise: rupeesToPaise(saved.consultantCharge) }, created: false };
    }
    const readiness = getRazorpayReadiness();
    if (!readiness.apiConfigured || !readiness.webhookConfigured) throw new ConsultationPaymentError("Consultation payments are temporarily unavailable. Please contact Ayursarga.", 503);
    const provider = consultant.exists ? publicConsultantProjection(consultantId, consultant.data()!, service.id) : null;
    const timing = provider?.preferredSlotTimings[slot as ConsultantTimeSlot];
    // A configured commission is mandatory for new paid appointments; no invented fallback.
    const pricing = consultant.exists ? getConsultantPricing(consultant.data()!.consultantCharge, consultant.data()!.ayursargaCommissionPercentage) : null;
    if (!provider || !pricing || !timing || !provider.preferredTimeSlots.includes(slot)) throw new ConsultationPaymentError("This consultant is not configured for paid booking. Choose another professional or contact Ayursarga.");
    if (provider.consultantCharge !== expectedCharge || timing.startTime !== body.expectedSlotStartTime || timing.endTime !== body.expectedSlotEndTime) throw new ConsultationPaymentError("The fee or time window changed. Refresh consultants and review before paying.");
    if (!isConsultantDateAvailable(date, provider) || !validConsultationSchedule(date, timing.startTime, timing.endTime)) throw new ConsultationPaymentError("Choose an available date and time window that has not ended.");
    const amountPaise = rupeesToPaise(pricing.totalCharge);
    if (amountPaise < 100) throw new ConsultationPaymentError("This consultation fee is not configured for payment.");
    const consumer = profile.data()!;
    const cancellationPolicy = await readConsultationCancellationPolicy(firestore, transaction);
    if (body.expectedCancellationPolicyVersion !== cancellationPolicy.version) throw new ConsultationPaymentError("Cancellation terms changed. Reload and review them before paying.");
    const now = Timestamp.now();
    const draft = { consumerId: uid, consumerName: String(consumer.name ?? "").trim(), consumerEmail: String(consumer.email ?? "").trim().toLowerCase(),
      consumerPhone: consumer.phone.trim(), consumerAddress: typeof consumer.address === "string" ? consumer.address.trim() || null : null,
      consultantId, consultantName: provider.name, consultantDesignation: provider.designation, serviceId: service.id, serviceName: service.label,
      consultantCharge: pricing.totalCharge, preferredDate: date, preferredTimeSlot: slot, slotStartTime: timing.startTime, slotEndTime: timing.endTime,
      consumerNotes: notes || null, bookingTermsAcceptedAt: now, bookingTermsVersion: BOOKING_TERMS_VERSION,
      cancellationPolicy: snapshotConsultationCancellation(cancellationPolicy, date, timing.startTime) };
    const intent = { consumerId: uid, consultantId, inputHash, receipt, amountPaise, pricing, draft, mode: readiness.mode,
      state: "creating", orderId: null, bookingId: null, bookingReference: null, createdAt: now, createdBy: uid,
      archivedAt: null, archivedBy: null };
    const meta = auditPayment(transaction, firestore, "consultationPaymentIntents", id, null, intent, uid, "consumer");
    transaction.create(ref, { ...intent, ...meta });
    transaction.create(firestore.collection("consultationPaymentReceipts").doc(receipt), { intentId: id, createdAt: now, createdBy: uid, ...meta });
    return { intent, created: true };
  });
  if (!result.created) return consumerCheckout(id, result.intent);
  // Durable claim precedes the non-idempotent provider POST. Never automatically recreate an uncertain order.
  try {
    const order = await createRazorpayOrder({ amountPaise: result.intent.amountPaise, receipt });
    const saved = await firestore.runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data()!;
      if (current.orderId && current.orderId !== order.id) throw new ConsultationPaymentError("Payment order requires Admin review.");
      if (current.state !== "creating") return current;
      const changes = { orderId: order.id, state: "ready" };
      const meta = auditPayment(transaction, firestore, "consultationPaymentIntents", id, { state: current.state }, changes, uid, "consumer");
      transaction.update(ref, { ...changes, ...meta });
      return { ...current, ...changes };
    });
    return consumerCheckout(id, saved);
  } catch {
    // A provider order may exist even if response/storage failed. Owner reconciliation only.
    await firestore.runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data();
      if (!current || current.state !== "creating") return;
      const changes = { state: "order_unknown" };
      transaction.update(ref, { ...changes, ...auditPayment(transaction, firestore, "consultationPaymentIntents", id, { state: current.state }, changes, uid, "consumer") });
    });
    throw new ConsultationPaymentError("Payment setup could not be confirmed. Check your booking status or contact Ayursarga before starting another payment.", 503);
  }
}

export async function ownedConsultationIntent(firestore: Firestore, uid: string, id: string) {
  if (!isConsultationIntentId(id)) throw new ConsultationPaymentError("Invalid payment request.", 400);
  const snapshot = await firestore.collection("consultationPaymentIntents").doc(id).get();
  if (!snapshot.exists || snapshot.data()!.consumerId !== uid) throw new ConsultationPaymentError("Payment request not found.", 404);
  return snapshot.data()!;
}

export async function recoverConsultationPayment(firestore: Firestore, uid: string, id: string) {
  const intent = await ownedConsultationIntent(firestore, uid, id);
  if (!intent.orderId || intent.bookingId || intent.state === "paid_review") return consumerCheckout(id, intent);
  if (intent.mode !== getRazorpayReadiness().mode) throw new ConsultationPaymentError("Payment configuration changed. Contact Ayursarga.", 503);
  const order = await fetchRazorpayOrder(intent.orderId);
  if (order.status !== "paid") return consumerCheckout(id, intent);
  const payments = (await fetchRazorpayOrderPayments(intent.orderId)).filter(payment => payment.captured && ["captured", "refunded"].includes(payment.status));
  if (payments.length !== 1) throw new ConsultationPaymentError("Payment requires manual reconciliation. Contact Ayursarga before paying again.");
  return reconcileConsultationPayment(firestore, id, payments[0].id, undefined, { order, payment: payments[0] });
}

/** Fetch provider truth before transaction; webhook payloads/checkout returns never establish payment success. */
export async function reconcileConsultationPayment(firestore: Firestore, id: string, paymentId: string, event?: { id: string; digest: string; type: string }, verified?: { payment: RazorpayPayment; order: RazorpayOrder }) {
  const ref = firestore.collection("consultationPaymentIntents").doc(id);
  const initial = (await ref.get()).data();
  if (!initial) throw new ConsultationPaymentError("Payment request not found.", 404);
  if (initial.mode !== getRazorpayReadiness().mode) throw new ConsultationPaymentError("Payment configuration changed. Please contact Ayursarga.", 503);
  const payment = verified?.payment ?? await fetchRazorpayPayment(paymentId);
  if (!payment.order_id) throw new ConsultationPaymentError("Payment is not linked to an order.");
  const order = verified?.order ?? await fetchRazorpayOrder(payment.order_id);
  if (payment.id !== paymentId || order.id !== payment.order_id || order.receipt !== initial.receipt || order.amount !== initial.amountPaise || payment.amount !== initial.amountPaise
    || payment.currency !== "INR" || (initial.orderId && initial.orderId !== order.id)) throw new ConsultationPaymentError("Payment does not match this consultation.");
  const captured = payment.captured === true && ["captured", "refunded"].includes(payment.status)
    && order.status === "paid" && order.amount_paid === initial.amountPaise && order.amount_due === 0;
  if (payment.amount_refunded > payment.amount) throw new ConsultationPaymentError("Refund totals require Admin review.");
  return commitPayment(firestore, id, payment, captured, event);
}

async function commitPayment(firestore: Firestore, id: string, payment: RazorpayPayment, captured: boolean, event?: { id: string; digest: string; type: string }) {
  return firestore.runTransaction(async transaction => {
    const ref = firestore.collection("consultationPaymentIntents").doc(id);
    const financeRef = firestore.collection("consultationFinancials").doc(id);
    const bookingRef = firestore.collection("consultationBookings").doc(id);
    const eventRef = event ? firestore.collection("razorpayWebhookEvents").doc(hashPaymentValue(event.id)) : null;
    const [intentSnap, financialSnap, bookingSnap] = await transaction.getAll(ref, financeRef, bookingRef);
    const intent = intentSnap.data()!;
    if (!intent || payment.order_id !== (intent.orderId ?? payment.order_id)) throw new ConsultationPaymentError("Payment request changed.");
    if (eventRef) {
      const previous = await transaction.get(eventRef);
      if (previous.exists) {
        if (previous.data()!.digest !== event!.digest) throw new ConsultationPaymentError("Webhook identity conflict.");
        return consumerCheckout(id, intent);
      }
    }
    const previous = financialSnap.data();
    if (previous && previous.paymentId !== payment.id && captured) throw new ConsultationPaymentError("A different captured payment is already recorded. Contact Ayursarga.");
    const consumer = await transaction.get(firestore.collection("users").doc(intent.consumerId));
    const consultant = await transaction.get(firestore.collection("consultants").doc(intent.consultantId));
    const provider = consultant.exists ? publicConsultantProjection(intent.consultantId, consultant.data()!, intent.draft.serviceId) : null;
    const timing = provider?.preferredSlotTimings[intent.draft.preferredTimeSlot as ConsultantTimeSlot];
    const bookable = !bookingSnap.exists && intent.state !== "paid_review" && captured && payment.amount_refunded === 0 && completedProfile(consumer.data())
      && provider && timing && isConsultantDateAvailable(intent.draft.preferredDate, provider)
      && timing.startTime === intent.draft.slotStartTime && timing.endTime === intent.draft.slotEndTime
      && validConsultationSchedule(intent.draft.preferredDate, timing.startTime, timing.endTime);
    const admins = bookable ? await consultationAdminRecipients(transaction, firestore) : [];
    const bookingReference = bookable ? await reserveBookingReference(transaction, firestore, id) : intent.bookingReference;
    // All transaction reads must precede every write (reserveBookingReference is the last reader).
    const now = Timestamp.now();
    const uid = String(intent.consumerId);
    if (captured) {
      const grossPaise = intent.amountPaise;
      const commissionPaise = rupeesToPaise(intent.pricing.commissionAmount);
      const consultantPayablePaise = rupeesToPaise(intent.pricing.baseCharge);
      const refundedPaise = Math.max(previous?.refundedPaise ?? 0, payment.amount_refunded);
      const gatewayFeePaise = payment.fee ?? previous?.gatewayFeePaise ?? null;
      const needsReview = (!bookingSnap.exists && !bookable) || refundedPaise > 0 || event?.type.startsWith("refund.");
      const totals = consultationFinancialTotals({ grossPaise, commissionPaise, consultantPayablePaise, gatewayFeePaise, refundedPaise });
      const record = { consumerName: intent.draft.consumerName, consultantId: intent.consultantId, consultantName: intent.draft.consultantName,
        serviceName: intent.draft.serviceName, bookingId: bookable || bookingSnap.exists ? id : null, bookingReference: bookingReference ?? null,
        paymentId: payment.id, orderId: payment.order_id, mode: intent.mode, grossPaise, commissionPaise, consultantPayablePaise,
        commissionPercentage: intent.pricing.commissionPercentage, gatewayFeePaise, gatewayTaxPaise: payment.tax ?? previous?.gatewayTaxPaise ?? null,
        refundedPaise, ...totals, netRevenuePaise: needsReview || previous?.settlementHold ? null : totals.netRevenuePaise,
        paymentStatus: refundedPaise === grossPaise ? "refunded" : refundedPaise > 0 ? "partially_refunded" : "paid",
        settlementStatus: previous?.settlementStatus ?? "pending", settlementReference: previous?.settlementReference ?? null,
        settlementDate: previous?.settlementDate ?? null, settlementNotes: previous?.settlementNotes ?? null,
        settlementRecordedAt: previous?.settlementRecordedAt ?? null, settlementRecordedBy: previous?.settlementRecordedBy ?? null,
        settlementHold: Boolean(previous?.settlementHold || needsReview),
        reviewReason: previous?.reviewReason ?? (needsReview ? (refundedPaise > 0 || event?.type.startsWith("refund.") ? "refund_review" : "booking_unavailable") : null),
        createdAt: previous?.createdAt ?? now, createdBy: previous?.createdBy ?? uid, archivedAt: null, archivedBy: null };
      const changed = !previous || ["gatewayFeePaise", "gatewayTaxPaise", "refundedPaise", "paymentStatus", "settlementHold", "reviewReason"].some(key => record[key as keyof typeof record] !== previous[key]);
      if (changed) transaction.set(financeRef, { ...record, ...auditPayment(transaction, firestore, "consultationFinancials", id,
        previous ? { paymentStatus: previous.paymentStatus, refundedPaise: previous.refundedPaise } : null, record, uid, "consumer") });
      if (bookable) {
        const booking = { ...intent.draft, bookingReference, status: "confirmed", confirmedDate: intent.draft.preferredDate, confirmedTime: null,
          confirmedAt: now, completedAt: null, adminNotes: null, paymentStatus: "paid", paymentReference: payment.id, paymentIntentId: id,
          paymentTotals: { paidPaise: grossPaise, refundedPaise },
          createdAt: now, createdBy: uid, archivedAt: null, archivedBy: null };
        const meta = auditPayment(transaction, firestore, "consultationBookings", id, null, booking, uid, "consumer");
        transaction.create(bookingRef, { ...booking, ...meta });
        queueConsultationEmail(transaction, firestore, { eventId: `confirmation-${id}`, bookingId: id, event: "confirmed", booking,
          consultant: consultant.data()!, consultantFee: intent.pricing.baseCharge, actorId: uid, actorRole: "consumer", auditId: meta.lastAuditId, now });
        for (const admin of admins) addConsultationNotification(transaction, firestore, { recipientId: admin, recipientRole: "admin", bookingId: id,
          bookingReference, message: `${intent.draft.consultantName} · ${intent.draft.serviceName} · Payment verified; consultation confirmed.`,
          event: "consultation_created", actorId: uid, auditId: meta.lastAuditId, now });
      }
      // A refund creates a new booking revision, superseding any unsent pre-refund confirmation.
      if (bookingSnap.exists && (bookingSnap.data()!.paymentStatus !== record.paymentStatus
        || (bookingSnap.data()!.paymentTotals != null && bookingSnap.data()!.paymentTotals.refundedPaise !== refundedPaise))) {
        const changes = { paymentStatus: record.paymentStatus, paymentTotals: { paidPaise: grossPaise, refundedPaise } };
        transaction.update(bookingRef, { ...changes, ...auditPayment(transaction, firestore, "consultationBookings", id,
          { paymentStatus: bookingSnap.data()!.paymentStatus }, changes, uid, "consumer") });
      }
      const state = bookable || bookingSnap.exists ? "confirmed" : "paid_review";
      const changes = { state, orderId: payment.order_id, bookingId: record.bookingId, bookingReference: record.bookingReference };
      if (intent.state !== state || intent.orderId !== payment.order_id) transaction.update(ref, { ...changes,
        ...auditPayment(transaction, firestore, "consultationPaymentIntents", id, { state: intent.state }, changes, uid, "consumer") });
      if (eventRef) transaction.create(eventRef, { eventType: event!.type, digest: event!.digest, intentId: id, paymentId: payment.id, createdAt: now,
        ...auditPayment(transaction, firestore, "razorpayWebhookEvents", eventRef.id, null, { eventType: event!.type, paymentId: payment.id }, uid, "consumer") });
      return consumerCheckout(id, { ...intent, ...changes });
    }
    // A failed attempt must never overwrite a captured payment or prevent later successful payment of the same order.
    if (eventRef) transaction.create(eventRef, { eventType: event!.type, digest: event!.digest, intentId: id, paymentId: payment.id, createdAt: now,
      ...auditPayment(transaction, firestore, "razorpayWebhookEvents", eventRef.id, null, { eventType: event!.type, paymentStatus: payment.status }, uid, "consumer") });
    return consumerCheckout(id, intent);
  });
}
