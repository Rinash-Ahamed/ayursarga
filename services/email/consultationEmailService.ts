import "server-only";
import { Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import { bookingEmail, type BookingEmailData } from "@/lib/bookingEmail";
import { authEmailSiteUrl } from "@/services/auth/authEmailService";
import { sendEmail } from "@/services/email/emailService";
import { isValidEmail } from "@/utils/text";
import type { ConsultationEmailResult } from "@/features/consultations/email";
import { consultationAdminRecipients, addConsultationNotification } from "@/services/consultations/consultationNotificationsAdmin";

const COLLECTION = "consultationEmailEvents";
type AppointmentEmailEvent = "confirmed" | "rescheduled" | "cancelled";

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
    time: typeof booking.confirmedTime === "string" ? booking.confirmedTime : null,
    timeWindow: `${booking.slotStartTime} - ${booking.slotEndTime}`,
    previousDate: previous.confirmedDate ?? previous.preferredDate,
    previousTime: typeof previous.confirmedTime === "string" ? previous.confirmedTime : null,
    previousTimeWindow: `${previous.slotStartTime} - ${previous.slotEndTime}`,
    amount: typeof booking.consultantCharge === "number" ? booking.consultantCharge : null,
  };
  transaction.create(firestore.collection(COLLECTION).doc(input.eventId), {
    bookingId: input.bookingId, event: input.event, payloadHash: input.payloadHash ?? null, actorRole: input.actorRole,
    bookingAuditId: input.auditId,
    audience: "consumer", channel: "email",
    recipient: String(booking.consumerEmail ?? "").trim().toLowerCase(), payload,
    status: "pending", createdAt: input.now, createdBy: input.actorId,
    updatedAt: input.now, updatedBy: input.actorId, archivedAt: null, archivedBy: null, lastAuditId: input.auditId,
  });
  if (input.consultant !== undefined) {
    transaction.create(firestore.collection(COLLECTION).doc(`${input.eventId}-consultant`), {
      bookingId: input.bookingId, consultantId: String(booking.consultantId ?? ""), event: input.event,
      bookingAuditId: input.auditId,
      payloadHash: input.payloadHash ?? null, actorRole: input.actorRole, audience: "consultant", channel: "email",
      recipient: typeof input.consultant.email === "string" ? input.consultant.email.trim().toLowerCase() : "",
      payload: { ...payload, amount: input.consultantFee ?? null, providerName: String(input.consultant.name ?? booking.consultantName ?? "") },
      status: "pending", createdAt: input.now, createdBy: input.actorId, updatedAt: input.now, updatedBy: input.actorId,
      archivedAt: null, archivedBy: null, lastAuditId: input.auditId,
    });
  }
}

/** Separate claims/outcomes: one recipient's failure never blocks the other. */
export async function deliverConsultationEmails(firestore: Firestore, eventId: string) {
  const [email, consultantEmail] = await Promise.all([
    deliverConsultationEmail(firestore, eventId),
    deliverConsultationEmail(firestore, `${eventId}-consultant`),
  ]);
  return { email, consultantEmail };
}

/**
 * A durable, single claim per committed event. Never retry SMTP after an
 * ambiguous result: SMTP has no exactly-once contract. Retries report the
 * recorded outcome instead of sending another copy.
 */
export async function deliverConsultationEmail(firestore: Firestore, eventId: string): Promise<ConsultationEmailResult> {
  const reference = firestore.collection(COLLECTION).doc(eventId);
  try {
    const claim = await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const event = snapshot.data();
      if (!event) return { status: "unknown" as const, event: null };
      if (event.status !== "pending") return { status: event.status as ConsultationEmailResult["status"], event: null };
      const appointment = typeof event.bookingId === "string" && /^consultation-[a-f0-9]{64}$/.test(event.bookingId)
        ? (await transaction.get(firestore.collection("consultationBookings").doc(event.bookingId))).data() : null;
      // Legacy pending events retain their originating booking audit in lastAuditId.
      // New events snapshot it separately because delivery updates lastAuditId.
      const bookingAuditId = event.bookingAuditId ?? event.lastAuditId;
      const expectedStatus = event.event === "cancelled" ? "cancelled" : "confirmed";
      const current = appointment && appointment.archivedAt == null
        && ["confirmed", "rescheduled", "cancelled"].includes(event.event)
        && typeof bookingAuditId === "string" && bookingAuditId === appointment.lastAuditId
        && appointment.status === expectedStatus;
      const audit = firestore.collection("auditLogs").doc();
      const now = Timestamp.now();
      if (!current) {
        transaction.update(reference, { status: "superseded", supersededAt: now, failureReason: "appointment_changed",
          updatedAt: now, updatedBy: event.createdBy, lastAuditId: audit.id });
        transaction.create(audit, { action: "update", module: COLLECTION, recordId: eventId, actorId: event.createdBy,
          actorRole: event.actorRole, previousValues: { status: "pending" },
          updatedValues: { status: "superseded", failureReason: "appointment_changed" }, timestamp: now, source: "server" });
        return { status: "superseded" as const, event: null };
      }
      transaction.update(reference, { status: "sending", updatedAt: now, updatedBy: event.createdBy, lastAuditId: audit.id });
      transaction.create(audit, { action: "update", module: COLLECTION, recordId: eventId, actorId: event.createdBy,
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
      const url = new URL(event.audience === "consultant" ? "/contact" : "/app/bookings/consultations", authEmailSiteUrl());
      if (event.audience !== "consultant") url.searchParams.set("booking", event.bookingId);
      const template = bookingEmail({ ...event.payload, amount: event.payload.amount ?? undefined,
        kind: "consultation", audience: event.audience ?? "consumer", event: event.event, bookingUrl: url.href } as BookingEmailData);
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
      const admins = event.audience === "consultant" && status === "failed"
        ? await consultationAdminRecipients(transaction, firestore) : [];
      const audit = firestore.collection("auditLogs").doc();
      const now = Timestamp.now();
      transaction.update(reference, { status, failureReason, updatedAt: now, updatedBy: event.createdBy, lastAuditId: audit.id });
      transaction.create(audit, { action: "update", module: COLLECTION, recordId: eventId, actorId: event.createdBy,
        actorRole: event.actorRole, previousValues: { status: "sending" }, updatedValues: { status, failureReason }, timestamp: now, source: "server" });
      for (const admin of admins) addConsultationNotification(transaction, firestore, {
        recipientId: admin, recipientRole: "admin", bookingId: event.bookingId, bookingReference: event.payload.bookingReference,
        message: failureReason === "missing_email" || failureReason === "invalid_email"
          ? "Consultant email is missing or invalid. Update the consultant contact and coordinate this appointment directly."
          : "Consultant email could not be confirmed. Contact the consultant directly.",
        event: `consultant_email_failed_${eventId}`, actorId: event.createdBy, auditId: audit.id, now,
      });
    });
    return { status };
  } catch {
    // A lost database acknowledgement may follow successful SMTP acceptance.
    return { status: "unknown" };
  }
}
