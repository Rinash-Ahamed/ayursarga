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
import type { ConsultantTimeSlot } from "@/features/consultants/validation";
import { validConsultationSchedule } from "@/features/consultations/schedule";
import { queueConsultationEmail, deliverConsultationEmails } from "@/services/email/consultationEmailService";

export const runtime = "nodejs";
export const maxDuration = 60;
class ConsultationError extends Error { constructor(message: string, public status: number) { super(message); } }

export async function PATCH(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const { uid, role, firestore } = await requireActiveUser(request, ["admin", "consumer"]);
    const { bookingId } = await context.params;
    if (!/^consultation-[a-f0-9]{64}$/.test(bookingId)) return apiJson({ error: "Invalid consultation." }, 400);
    if (!allowRequest(requestFingerprint(request, `consultation-update:${uid}`), 40, 10 * 60 * 1000)) return apiJson({ error: "Please wait before trying again." }, 429);
    const input = await readJsonBody(request, 4_000) as Record<string, unknown> | null;
    if (!input || typeof input !== "object" || Array.isArray(input)) return apiJson({ error: "An appointment action is required." }, 400);
    const action = input.action ?? input.status;
    if (!["reschedule", "completed", "cancelled"].includes(String(action))) return apiJson({ error: "Invalid appointment action." }, 400);
    if (role === "consumer" && action !== "cancelled") return apiJson({ error: "You can only cancel your own appointment." }, 403);
    if (input.adminNotes !== undefined && (typeof input.adminNotes !== "string" || input.adminNotes.length > 1000)) return apiJson({ error: "Keep notes within 1,000 characters." }, 400);
    const requestId = typeof input.requestId === "string" && /^[a-zA-Z0-9-]{16,100}$/.test(input.requestId) ? input.requestId : null;
    if (role === "admin" && action !== "completed" && !requestId) return apiJson({ error: "A valid action reference is required. Refresh and try again." }, 400);
    const eventId = requestId ? `action-${createHash("sha256").update(`${uid}:${bookingId}:${requestId}`).digest("hex")}` : null;
    const payloadHash = createHash("sha256").update(JSON.stringify([action, input.confirmedDate ?? null, input.confirmedTime ?? null,
      role === "admin" ? String(input.adminNotes ?? "").trim() : null, input.expectedAuditId ?? null])).digest("hex");
    const result = await firestore.runTransaction(async (transaction) => {
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
      if (role === "admin" && typeof input.adminNotes === "string") update.adminNotes = input.adminNotes.trim() || null;
      if (action === "reschedule") {
        const date = typeof input.confirmedDate === "string" ? input.confirmedDate : "";
        const time = typeof input.confirmedTime === "string" ? input.confirmedTime : "";
        if (!validConsultationSchedule(date, booking.slotStartTime, booking.slotEndTime, time)) throw new ConsultationError("Choose a future date and a time within the appointment window.", 400);
        if (booking.status === "confirmed" && date === booking.confirmedDate && time === booking.confirmedTime) throw new ConsultationError("Choose a different appointment date or time.", 400);
        const consultant = await transaction.get(firestore.collection("consultants").doc(booking.consultantId));
        consultantContact = consultant.data() ?? {};
        const provider = consultant.exists ? publicConsultantProjection(consultant.id, consultant.data()!, booking.serviceId) : null;
        const timing = provider?.preferredSlotTimings[booking.preferredTimeSlot as ConsultantTimeSlot];
        if (!provider || !timing || time < timing.startTime || time >= timing.endTime) throw new ConsultationError("The consultant is no longer available in this appointment window.", 409);
        update.confirmedDate = date; update.confirmedTime = time;
        update.confirmedAt = booking.confirmedAt ?? now;
      }
      if (role === "admin" && action === "cancelled") {
        const consultant = await transaction.get(firestore.collection("consultants").doc(booking.consultantId));
        consultantContact = consultant.data() ?? {};
      }
      if (action === "completed") update.completedAt = now;
      const admins = role === "consumer" ? await consultationAdminRecipients(transaction, firestore) : [];
      const audit = firestore.collection("auditLogs").doc();
      update.lastAuditId = audit.id;
      transaction.update(reference, update);
      transaction.create(audit, { action: action === "reschedule" ? "update" : "status_change", module: "consultationBookings", recordId: bookingId,
        actorId: uid, actorRole: role,
        previousValues: { status: booking.status, confirmedDate: booking.confirmedDate ?? null, confirmedTime: booking.confirmedTime ?? null },
        updatedValues: update, timestamp: now, source: "server", device: requestAuditDevice(request) });
      const recipients = role === "admin" ? [{ id: booking.consumerId as string, role: "consumer" as const }]
        : admins.map((id) => ({ id, role: "admin" as const }));
      for (const recipient of recipients) addConsultationNotification(transaction, firestore, {
        recipientId: recipient.id, recipientRole: recipient.role, bookingId, bookingReference: booking.bookingReference,
        message: `${booking.serviceName}: appointment ${action === "reschedule" ? "rescheduled" : action}.`,
        event: `consultation_${action}_${audit.id}`, actorId: uid, auditId: audit.id, now,
      });
      const emailEventId = role === "admin" && action !== "completed" ? eventId : null;
      if (emailEventId) queueConsultationEmail(transaction, firestore, { eventId: emailEventId, bookingId,
        event: action === "reschedule" ? "rescheduled" : "cancelled", booking: { ...booking, ...update }, previous: booking,
        consultant: consultantContact, actorId: uid, actorRole: "admin", auditId: audit.id, now, payloadHash });
      return { changes: update, emailEventId };
    });
    const delivery = result.emailEventId ? await deliverConsultationEmails(firestore, result.emailEventId) : undefined;
    return mutationJson(result.changes, delivery);
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError || error instanceof ConsultationError) return apiJson({ error: error.message }, error.status);
    logApiError("PATCH /api/consultations/[bookingId]", error);
    return apiJson({ error: "We could not update this consultation. Try again." }, 503);
  }
}
