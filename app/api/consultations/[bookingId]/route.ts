import { withApiTiming, timeApiStep } from "@/services/api/timing";
import { after } from "next/server";
import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { mutationJson } from "@/services/api/mutation";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { requestAuditDevice } from "@/services/api/audit";
import { consultationAdminRecipients, addConsultationNotification } from "@/services/consultations/consultationNotificationsAdmin";
import { publicConsultantProjection } from "@/features/consultations/publicProjection";
import { validConsultationSchedule } from "@/features/consultations/schedule";
import { isConsultantDateAvailable } from "@/features/consultations/availability";
import { queueConsultationEmail, deliverConsultationEmails, consultationEmailStatuses } from "@/services/email/consultationEmailService";
import { auditPayment } from "@/services/payments/consultationPaymentsAdmin";
import { consultationCancellationEligibility, validCancellationSnapshot, snapshotConsultationCancellation } from "@/features/consultations/cancellationPolicy";
import { generateConsultationSlots } from "@/features/consultations/slots";
import { consumerRescheduleEligibility } from "@/features/consultations/rescheduling";
import { readScheduleDay, requireFreeSlot, releaseSlot, saveSlotEntry, SlotReservationError } from "@/services/consultations/slotReservationsAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;
class ConsultationError extends Error { constructor(message: string, public status: number) { super(message); } }

async function handlePATCH(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const { uid, role, firestore } = await requireActiveUser(request, ["admin", "consumer"]);
    const { bookingId } = await context.params;
    if (!/^consultation-[a-f0-9]{64}$/.test(bookingId)) return apiJson({ error: "Invalid consultation." }, 400);
    if (!allowRequest(requestFingerprint(request, `consultation-update:${uid}`), 40, 10 * 60 * 1000)) return apiJson({ error: "Please wait before trying again." }, 429);
    const input = await readJsonBody(request, 4_000) as Record<string, unknown> | null;
    if (!input || typeof input !== "object" || Array.isArray(input)) return apiJson({ error: "An appointment action is required." }, 400);
    const action = input.action ?? input.status;
    if (!["reschedule", "completed", "cancelled"].includes(String(action))) return apiJson({ error: "Invalid appointment action." }, 400);
    if (role === "consumer" && action !== "cancelled" && action !== "reschedule") return apiJson({ error: "You can only cancel or reschedule your own appointment." }, 403);
    if (input.adminNotes !== undefined && (typeof input.adminNotes !== "string" || input.adminNotes.length > 1000)) return apiJson({ error: "Keep notes within 1,000 characters." }, 400);
    const requestId = typeof input.requestId === "string" && /^[a-zA-Z0-9-]{16,100}$/.test(input.requestId) ? input.requestId : null;
    if (role === "admin" && action !== "completed" && !requestId) return apiJson({ error: "A valid action reference is required. Refresh and try again." }, 400);
    if (role === "consumer" && action === "reschedule" && (!requestId || typeof input.expectedAuditId !== "string" || !input.expectedAuditId || input.expectedAuditId.length > 160)) return apiJson({ error: "Refresh the appointment before rescheduling." }, 400);
    const actionReference = requestId ?? (role === "consumer" && action === "cancelled" ? "consumer-cancellation" : null);
    const eventId = actionReference ? `action-${createHash("sha256").update(`${uid}:${bookingId}:${actionReference}`).digest("hex")}` : null;
    const payloadHash = createHash("sha256").update(JSON.stringify([action, input.confirmedDate ?? null, input.confirmedTime ?? null,
      role === "admin" ? String(input.adminNotes ?? "").trim() : null, input.expectedAuditId ?? null])).digest("hex");
    const result = await timeApiStep("database", () => firestore.runTransaction(async (transaction) => {
      const reference = firestore.collection("consultationBookings").doc(bookingId);
      const snapshot = await transaction.get(reference);
      const booking = snapshot.data();
      if (!snapshot.exists || !booking || booking.archivedAt != null) throw new ConsultationError("Consultation not found.", 404);
      if (role === "consumer" && booking.consumerId !== uid) throw new ConsultationError("You cannot update this appointment.", 403);
      if (eventId) {
        const prior = await transaction.get(firestore.collection("consultationEmailEvents").doc(eventId));
        if (prior.exists) {
          if (prior.data()?.payloadHash !== payloadHash) throw new ConsultationError("This action reference belongs to different appointment details.", 409);
          return { changes: booking, emailEventId: eventId };
        }
      }
      // Repeated status requests never create a second audit, notification or email.
      if (action !== "reschedule" && booking.status === action) return { changes: booking, emailEventId: null };
      if (input.expectedAuditId !== undefined && input.expectedAuditId !== booking.lastAuditId) throw new ConsultationError("This appointment has changed. Refresh before trying again.", 409);
      const allowed = action === "reschedule" || action === "cancelled"
        ? ["requested", "confirmed"].includes(booking.status) : booking.status === "confirmed";
      if (!allowed) throw new ConsultationError("This appointment has changed. Refresh before trying again.", 409);
      const now = Timestamp.now();
      const update: Record<string, unknown> = { status: action === "reschedule" ? "confirmed" : action, updatedAt: now, updatedBy: uid };
      let consultantContact: Record<string, unknown> | undefined;
      let previousDay: Awaited<ReturnType<typeof readScheduleDay>> | undefined;
      let nextDay: Awaited<ReturnType<typeof readScheduleDay>> | undefined;
      if (role === "admin" && typeof input.adminNotes === "string") update.adminNotes = input.adminNotes.trim() || null;
      if (action === "reschedule") {
        if (role === "consumer") {
          const eligibility = consumerRescheduleEligibility(booking, now.toMillis());
          if (!eligibility.allowed) throw new ConsultationError(eligibility.used
            ? "Your one-time reschedule has already been used. Contact Ayursarga for help."
            : "You can reschedule only at least 24 hours before your confirmed appointment. Contact Ayursarga for help.", 409);
          update.consumerRescheduleCount = 1;
          update.consumerRescheduledAt = now;
        }
        const date = typeof input.confirmedDate === "string" ? input.confirmedDate : "";
        const time = typeof input.confirmedTime === "string" ? input.confirmedTime : "";
        if (!validConsultationSchedule(date, "00:00", "23:59", time)) throw new ConsultationError("Choose a future date and appointment time.", 400);
        if (booking.status === "confirmed" && date === booking.confirmedDate && time === booking.confirmedTime) throw new ConsultationError("Choose a different appointment date or time.", 400);
        const consultant = await transaction.get(firestore.collection("consultants").doc(booking.consultantId));
        consultantContact = consultant.data() ?? {};
        const provider = consultant.exists ? publicConsultantProjection(consultant.id, consultant.data()!, booking.serviceId) : null;
        const appointment = provider ? generateConsultationSlots(date, booking.serviceId, provider, now.toDate()).find(slot => slot.startTime === time) : null;
        if (provider && !isConsultantDateAvailable(date, provider)) throw new ConsultationError("The consultant is not available on this date. Choose a configured available day.", 409);
        if (!provider || !appointment) throw new ConsultationError("Choose one of this consultant's available appointment times.", 409);
        const previousDate = booking.confirmedDate ?? booking.preferredDate;
        previousDay = await readScheduleDay(transaction, firestore, booking.consultantId, previousDate);
        nextDay = date === previousDate ? previousDay : await readScheduleDay(transaction, firestore, booking.consultantId, date);
        requireFreeSlot(nextDay, appointment, now.toMillis(), bookingId);
        update.confirmedDate = date; update.confirmedTime = time;
        update.confirmedEndTime = appointment.endTime;
        update.slotStartTime = appointment.startTime; update.slotEndTime = appointment.endTime;
        update.preferredTimeSlot = appointment.window; update.scheduleVersion = 2;
        update.confirmedAt = booking.confirmedAt ?? now;
        if (validCancellationSnapshot(booking.cancellationPolicy)) update.cancellationPolicy = snapshotConsultationCancellation(booking.cancellationPolicy.policy, date, time, true);
      }
      if (action === "cancelled") {
        const consultant = await transaction.get(firestore.collection("consultants").doc(booking.consultantId));
        consultantContact = consultant.data() ?? {};
      }
      if (action === "completed") update.completedAt = now;
      const admins = role === "consumer" ? await consultationAdminRecipients(transaction, firestore) : [];
      const financialRef = booking.paymentIntentId === bookingId ? firestore.collection("consultationFinancials").doc(bookingId) : null;
      const financial = financialRef ? (await transaction.get(financialRef)).data() : null;
      if (action === "cancelled") {
        const hasPolicy = booking.cancellationPolicy != null;
        if (hasPolicy && !validCancellationSnapshot(booking.cancellationPolicy)) throw new ConsultationError("The agreed cancellation terms need support review.", 409);
        const totals = financial ? { paidPaise: financial.grossPaise, refundedPaise: financial.refundedPaise } : null;
        const eligibility = hasPolicy ? consultationCancellationEligibility(booking.cancellationPolicy, booking.status, totals, now.toMillis()) : null;
        if (role === "consumer" && eligibility && !eligibility.allowed) throw new ConsultationError("Online cancellation is no longer available under your agreed policy. Contact Ayursarga for exceptional circumstances.", 409);
        update.cancellationOutcome = { requestedAt: now.toDate().toISOString(), policyVersion: hasPolicy ? booking.cancellationPolicy.policy.version : null,
          eligibleRefundPaise: role === "consumer" ? eligibility?.eligibleRefundPaise ?? null : null,
          remainingRefundPaise: role === "consumer" ? eligibility?.remainingRefundPaise ?? null : null };
        previousDay = await readScheduleDay(transaction, firestore, booking.consultantId, booking.confirmedDate ?? booking.preferredDate);
      }
      // The old slot is released only in the same successful commit as the
      // booking change; failed cancellation/rescheduling leaves it untouched.
      if (previousDay) releaseSlot(transaction, firestore, previousDay, bookingId, uid, role === "admin" ? "admin" : "consumer", now);
      if (nextDay) saveSlotEntry(transaction, firestore, nextDay, { ownerId: bookingId, startTime: String(update.confirmedTime), endTime: String(update.confirmedEndTime), state: "booked", expiresAt: null }, uid, role === "admin" ? "admin" : "consumer", now);
      const audit = firestore.collection("auditLogs").doc();
      update.lastAuditId = audit.id;
      transaction.update(reference, update);
      if (action === "cancelled" && financialRef && financial) {
        const changes = { settlementHold: true, reviewReason: "booking_cancelled", netRevenuePaise: null };
        transaction.update(financialRef, { ...changes, ...auditPayment(transaction, firestore, "consultationFinancials", bookingId,
          { settlementHold: financial.settlementHold, reviewReason: financial.reviewReason }, changes, uid, role === "admin" ? "admin" : "consumer") });
      }
      transaction.create(audit, { action: action === "reschedule" ? "update" : "status_change", module: "consultationBookings", recordId: bookingId,
        actorId: uid, actorRole: role,
        previousValues: { status: booking.status, confirmedDate: booking.confirmedDate ?? null, confirmedTime: booking.confirmedTime ?? null,
          ...(role === "consumer" && action === "reschedule" ? { consumerRescheduleCount: booking.consumerRescheduleCount ?? 0 } : {}) },
        updatedValues: update, timestamp: now, source: "server", device: requestAuditDevice(request) });
      const recipients = role === "admin" ? [{ id: booking.consumerId as string, role: "consumer" as const }]
        : admins.map((id) => ({ id, role: "admin" as const }));
      for (const recipient of recipients) addConsultationNotification(transaction, firestore, {
        recipientId: recipient.id, recipientRole: recipient.role, bookingId, bookingReference: booking.bookingReference,
        message: `${booking.serviceName}: appointment ${action === "reschedule" ? "rescheduled" : action}.`,
        event: `consultation_${action}_${audit.id}`, actorId: uid, auditId: audit.id, now,
      });
      const emailEventId = action !== "completed" ? eventId : null;
      if (emailEventId) queueConsultationEmail(transaction, firestore, { eventId: emailEventId, bookingId,
        event: action === "reschedule" ? "rescheduled" : "cancelled", booking: { ...booking, ...update }, previous: booking,
        consultant: consultantContact, consultantFee: financial ? Number(financial.consultantPayablePaise) / 100 : undefined,
        actorId: uid, actorRole: role === "admin" ? "admin" : "consumer", auditId: audit.id, now, payloadHash });
      return { changes: update, emailEventId };
    }));
    const delivery = result.emailEventId ? await timeApiStep("database", () => consultationEmailStatuses(firestore, result.emailEventId!, bookingId)) : undefined;
    if (result.emailEventId) {
      const emailEventId = result.emailEventId;
      after(() => deliverConsultationEmails(firestore, emailEventId).then(() => undefined));
    }
    return mutationJson(result.changes, delivery);
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError || error instanceof ConsultationError || error instanceof SlotReservationError) return apiJson({ error: error.message }, error.status);
    logApiError("PATCH /api/consultations/[bookingId]", error);
    return apiJson({ error: "We could not update this consultation. Try again." }, 503);
  }
}

export const PATCH = withApiTiming("PATCH /api/consultations/[bookingId]", handlePATCH);
