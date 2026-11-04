import "server-only";
import { Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import { bookingEmail, type BookingEmailData } from "@/lib/bookingEmail";
import { authEmailSiteUrl } from "@/services/auth/authEmailService";
import { sendEmail } from "@/services/email/emailService";
import { isValidEmail } from "@/utils/text";
import type { ConsultationEmailResult } from "@/features/consultations/email";
import { consultationAdminRecipients, addConsultationNotification } from "@/services/consultations/consultationNotificationsAdmin";
import { consultantDisplayName } from "@/features/consultants/name";
import { formatAppointmentRange } from "@/features/consultations/slots";

const COLLECTION = "consultationEmailEvents";
const HOSPITAL_COLLECTION = "hospitalBookingEmailEvents";
type AppointmentEmailEvent = "confirmed" | "rescheduled" | "cancelled";

function currentEmail(event: Record<string, unknown>, appointment?: Record<string, unknown> | null) {
  const revision = event.bookingAuditId ?? event.lastAuditId;
  return Boolean(appointment && appointment.archivedAt == null && ["confirmed", "rescheduled", "cancelled"].includes(String(event.event))
    && typeof revision === "string" && revision === appointment.lastAuditId
    && appointment.status === (event.event === "cancelled" ? "cancelled" : "confirmed"));
}

/** Safe response metadata only; this never claims or sends an email. */
export async function consultationEmailStatuses(firestore: Firestore, eventId: string, bookingId: string) {
  const unknown = { email: { status: "unknown" as const }, consultantEmail: { status: "unknown" as const }, supportEmail: { status: "unknown" as const } };
  try {
    const [consumer, consultant, support, booking] = await firestore.getAll(
      ...[eventId, `${eventId}-consultant`, `${eventId}-support`].map(id => firestore.collection(COLLECTION).doc(id)),
      firestore.collection("consultationBookings").doc(bookingId));
    const state = (snapshot: FirebaseFirestore.DocumentSnapshot): ConsultationEmailResult => {
      const event = snapshot.data();
      if (!event || !["pending", "sending", "accepted", "failed", "unknown", "superseded"].includes(event.status)) return { status: "unknown" };
      return { status: event.status === "pending" && !currentEmail(event, booking.data()) ? "superseded" : event.status };
    };
    return { email: state(consumer), consultantEmail: state(consultant), supportEmail: state(support) };
  } catch { return unknown; }
}

/** Called inside the appointment transaction, after all its reads. No SMTP here. */
export function queueConsultationEmail(transaction: Transaction, firestore: Firestore, input: {
  eventId: string; bookingId: string; event: AppointmentEmailEvent; booking: Record<string, unknown>;
  previous?: Record<string, unknown>; actorId: string; actorRole: "admin" | "consumer"; auditId: string; now: unknown; payloadHash?: string;
  consultant?: Record<string, unknown>;
  consultantFee?: number;
}) {
  const { booking, previous = booking } = input;
  const payload = {
    consumerName: String(booking.consumerName ?? ""), bookingReference: String(booking.bookingReference ?? ""),
    providerName: String(booking.consultantName ?? ""), serviceName: String(booking.serviceName ?? ""),
    date: booking.confirmedDate ?? booking.preferredDate,
    time: typeof booking.confirmedTime === "string" ? (typeof booking.confirmedEndTime === "string" ? formatAppointmentRange(booking.confirmedTime, booking.confirmedEndTime) : booking.confirmedTime) : null,
    timeWindow: `${booking.slotStartTime} - ${booking.slotEndTime}`,
    previousDate: previous.confirmedDate ?? previous.preferredDate,
    previousTime: typeof previous.confirmedTime === "string" ? (typeof previous.confirmedEndTime === "string" ? formatAppointmentRange(previous.confirmedTime, previous.confirmedEndTime) : previous.confirmedTime) : null,
    previousTimeWindow: `${previous.slotStartTime} - ${previous.slotEndTime}`,
    amount: typeof booking.consultantCharge === "number" ? booking.consultantCharge : null,
    ...(input.event === "cancelled" ? { cancellationReason: booking.cancellationReason ?? null, cancelledByRole: booking.cancelledByRole ?? null } : {}),
    ...(input.event === "rescheduled" ? { rescheduleReason: booking.rescheduleReason ?? null, rescheduledByRole: booking.rescheduledByRole ?? null,
      rescheduledAt: booking.rescheduledAt ?? null } : {}),
  };
  transaction.create(firestore.collection(COLLECTION).doc(input.eventId), {
    bookingId: input.bookingId, event: input.event, payloadHash: input.payloadHash ?? null, actorRole: input.actorRole,
    bookingAuditId: input.auditId,
    audience: "consumer", channel: "email",
    recipient: String(booking.consumerEmail ?? "").trim().toLowerCase(), payload,
    status: "pending", createdAt: input.now, createdBy: input.actorId,
    updatedAt: input.now, updatedBy: input.actorId, archivedAt: null, archivedBy: null, lastAuditId: input.auditId,
  });
  transaction.create(firestore.collection(COLLECTION).doc(`${input.eventId}-support`), {
    bookingId: input.bookingId, event: input.event, payloadHash: input.payloadHash ?? null, actorRole: input.actorRole,
    bookingAuditId: input.auditId, audience: "support", channel: "email",
    recipient: "info@ayursarga.com", payload,
    status: "pending", createdAt: input.now, createdBy: input.actorId,
    updatedAt: input.now, updatedBy: input.actorId, archivedAt: null, archivedBy: null, lastAuditId: input.auditId,
  });
  if (input.consultant !== undefined) {
    transaction.create(firestore.collection(COLLECTION).doc(`${input.eventId}-consultant`), {
      bookingId: input.bookingId, consultantId: String(booking.consultantId ?? ""), event: input.event,
      bookingAuditId: input.auditId,
      payloadHash: input.payloadHash ?? null, actorRole: input.actorRole, audience: "consultant", channel: "email",
      recipient: typeof input.consultant.email === "string" ? input.consultant.email.trim().toLowerCase() : "",
      payload: { ...payload, amount: input.consultantFee ?? null, providerName: consultantDisplayName(input.consultant) || String(booking.consultantName ?? "") },
      status: "pending", createdAt: input.now, createdBy: input.actorId, updatedAt: input.now, updatedBy: input.actorId,
      archivedAt: null, archivedBy: null, lastAuditId: input.auditId,
    });
  }
}

/** Separate claims/outcomes: one recipient's failure never blocks the other. */
export async function deliverConsultationEmails(firestore: Firestore, eventId: string) {
  const [email, consultantEmail, supportEmail] = await Promise.all([
    deliverConsultationEmail(firestore, eventId),
    deliverConsultationEmail(firestore, `${eventId}-consultant`),
    deliverConsultationEmail(firestore, `${eventId}-support`),
  ]);
  return { email, consultantEmail, supportEmail };
}

/**
 * A durable, single claim per committed event. Never retry SMTP after an
 * ambiguous result: SMTP has no exactly-once contract. Retries report the
 * recorded outcome instead of sending another copy.
 */
export async function deliverConsultationEmail(firestore: Firestore, eventId: string): Promise<ConsultationEmailResult> {
  return deliverBookingEmail(firestore, eventId, "consultation");
}

/** Search Center cancellations use their own private journal and the same single-claim sender. */
export function queueHospitalCancellationEmail(transaction: Transaction, firestore: Firestore, input: {
  eventId: string; bookingId: string; booking: Record<string, unknown>; actorId: string; actorRole: "admin" | "consumer"; auditId: string; now: unknown;
}) {
  const booking = input.booking;
  transaction.create(firestore.collection(HOSPITAL_COLLECTION).doc(input.eventId), {
    bookingId: input.bookingId, bookingAuditId: input.auditId, event: "cancelled", audience: "consumer", channel: "email",
    actorRole: input.actorRole, recipient: String(booking.consumerEmail ?? "").trim().toLowerCase(),
    payload: { consumerName: String(booking.consumerName ?? ""), bookingReference: String(booking.bookingReference ?? ""),
      providerName: String(booking.hospitalName ?? ""), serviceName: String(booking.serviceName ?? ""),
      location: String(booking.hospitalLocation ?? ""), date: booking.confirmedDate ?? booking.preferredDate,
      time: booking.confirmedTime ?? null, amount: booking.servicePrice ?? null,
      cancellationReason: booking.cancellationReason, cancelledByRole: booking.cancelledByRole },
    status: "pending", createdAt: input.now, createdBy: input.actorId, updatedAt: input.now, updatedBy: input.actorId,
    archivedAt: null, archivedBy: null, lastAuditId: input.auditId,
  });
}

export function deliverHospitalCancellationEmail(firestore: Firestore, eventId: string) {
  return deliverBookingEmail(firestore, eventId, "hospital");
}

async function deliverBookingEmail(firestore: Firestore, eventId: string, kind: "consultation" | "hospital"): Promise<ConsultationEmailResult> {
  const collection = kind === "hospital" ? HOSPITAL_COLLECTION : COLLECTION;
  const reference = firestore.collection(collection).doc(eventId);
  try {
    const claim = await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const event = snapshot.data();
      if (!event) return { status: "unknown" as const, event: null };
      if (event.status !== "pending") return { status: event.status as ConsultationEmailResult["status"], event: null };
      const validId = typeof event.bookingId === "string" && (kind === "consultation" ? /^consultation-[a-f0-9]{64}$/.test(event.bookingId) : Boolean(event.bookingId) && event.bookingId.length <= 160 && !event.bookingId.includes("/"));
      const appointment = validId ? (await transaction.get(firestore.collection(kind === "hospital" ? "bookings" : "consultationBookings").doc(event.bookingId))).data() : null;
      // Legacy pending events retain their originating booking audit in lastAuditId.
      // New events snapshot it separately because delivery updates lastAuditId.
      const current = currentEmail(event, appointment);
      const audit = firestore.collection("auditLogs").doc();
      const now = Timestamp.now();
      if (!current) {
        transaction.update(reference, { status: "superseded", supersededAt: now, failureReason: "appointment_changed",
          updatedAt: now, updatedBy: event.createdBy, lastAuditId: audit.id });
        transaction.create(audit, { action: "update", module: collection, recordId: eventId, actorId: event.createdBy,
          actorRole: event.actorRole, previousValues: { status: "pending" },
          updatedValues: { status: "superseded", failureReason: "appointment_changed" }, timestamp: now, source: "server" });
        return { status: "superseded" as const, event: null };
      }
      transaction.update(reference, { status: "sending", updatedAt: now, updatedBy: event.createdBy, lastAuditId: audit.id });
      transaction.create(audit, { action: "update", module: collection, recordId: eventId, actorId: event.createdBy,
        actorRole: event.actorRole, previousValues: { status: "pending" }, updatedValues: { status: "sending" }, timestamp: now, source: "server" });
      return { status: "sending" as const, event };
    });
    if (!claim.event) return { status: claim.status };
    const event = claim.event;
    let status: "accepted" | "failed" = "failed";
    let failureReason: string | null = null;
    try {
      if (!isValidEmail(event.recipient)) {
        failureReason = event.recipient ? "invalid_email" : "missing_email";
        throw new Error("Invalid saved recipient");
      }
      const url = new URL(kind === "hospital" ? "/app/bookings" : event.audience === "consultant" ? "/contact"
        : event.audience === "support" ? "/admin/bookings/consultations" : "/app/bookings/consultations", authEmailSiteUrl());
      if (event.audience !== "consultant") url.searchParams.set("booking", event.bookingId);
      const template = bookingEmail({ ...event.payload, amount: event.payload.amount ?? undefined,
        kind, audience: event.audience ?? "consumer", event: event.event, bookingUrl: url.href } as BookingEmailData);
      await sendEmail({ to: event.recipient, replyTo: "info@ayursarga.com", ...template });
      status = "accepted";
    } catch {
      // Do not expose SMTP details or automatically repeat a potentially accepted message.
      status = "failed";
      failureReason ??= "email_not_confirmed";
    }
    await firestore.runTransaction(async (transaction) => {
      const current = await transaction.get(reference);
      if (current.data()?.status !== "sending") return;
      const admins = status === "failed"
        ? await consultationAdminRecipients(transaction, firestore) : [];
      const audit = firestore.collection("auditLogs").doc();
      const now = Timestamp.now();
      transaction.update(reference, { status, failureReason, updatedAt: now, updatedBy: event.createdBy, lastAuditId: audit.id });
      transaction.create(audit, { action: "update", module: collection, recordId: eventId, actorId: event.createdBy,
        actorRole: event.actorRole, previousValues: { status: "sending" }, updatedValues: { status, failureReason }, timestamp: now, source: "server" });
      for (const admin of admins) addConsultationNotification(transaction, firestore, {
        recipientId: admin, recipientRole: "admin", bookingId: event.bookingId, bookingReference: event.payload.bookingReference,
        message: event.audience === "support" ? "The support team email could not be confirmed. Review this appointment and coordinate directly."
          : event.audience === "consumer" ? kind === "hospital" ? "The cancellation email could not be confirmed. Contact the customer about this booking." : "The customer email could not be confirmed. Contact the customer about this appointment."
          : failureReason === "missing_email" || failureReason === "invalid_email"
          ? "Consultant email is missing or invalid. Update the consultant contact and coordinate this appointment directly."
          : "Consultant email could not be confirmed. Contact the consultant directly.",
        event: `${event.audience}_email_failed_${eventId}`, actorId: event.createdBy, auditId: audit.id, now,
        ...(kind === "hospital" ? { bookingKind: "hospital" as const } : {}),
      });
    });
    return { status };
  } catch {
    // A lost database acknowledgement may follow successful SMTP acceptance.
    // Record uncertainty, when the database is reachable, without repeating SMTP.
    try {
      await firestore.runTransaction(async transaction => {
        const event = (await transaction.get(reference)).data();
        if (event?.status !== "sending") return;
        const admins = await consultationAdminRecipients(transaction, firestore);
        const audit = firestore.collection("auditLogs").doc();
        const now = Timestamp.now();
        transaction.update(reference, { status: "unknown", failureReason: "delivery_outcome_unknown", updatedAt: now, updatedBy: event.createdBy, lastAuditId: audit.id });
        transaction.create(audit, { action: "update", module: collection, recordId: eventId, actorId: event.createdBy,
          actorRole: event.actorRole, previousValues: { status: "sending" }, updatedValues: { status: "unknown", failureReason: "delivery_outcome_unknown" }, timestamp: now, source: "server" });
        for (const admin of admins) addConsultationNotification(transaction, firestore, { recipientId: admin, recipientRole: "admin", bookingId: event.bookingId,
          bookingReference: event.payload.bookingReference, message: "An appointment email's delivery could not be verified. Check with the recipient before sending another copy.",
          event: `email_unknown_${eventId}`, actorId: event.createdBy, auditId: audit.id, now,
          ...(kind === "hospital" ? { bookingKind: "hospital" as const } : {}) });
      });
    } catch { /* Preserve the durable claim if the database is still unavailable. */ }
    return { status: "unknown" };
  }
}
