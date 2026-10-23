import { Timestamp } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { mutationJson } from "@/services/api/mutation";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { requestAuditDevice } from "@/services/api/audit";
import { consultationAdminRecipients, addConsultationNotification } from "@/services/consultations/consultationNotificationsAdmin";
import { publicConsultantProjection } from "@/features/consultations/publicProjection";
import { isIsoDate, toDateInputValue } from "@/utils/date";
import { scheduleBookingConfirmation } from "@/services/email/bookingEmailService";

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
    const status = input.status;
    if (!["confirmed", "completed", "cancelled", "rejected"].includes(String(status))) return apiJson({ error: "Invalid appointment action." }, 400);
    if (role === "consumer" && status !== "cancelled") return apiJson({ error: "You can only cancel your own appointment." }, 403);
    if (input.adminNotes !== undefined && (typeof input.adminNotes !== "string" || input.adminNotes.length > 1000)) return apiJson({ error: "Keep notes within 1,000 characters." }, 400);
    const result = await firestore.runTransaction(async (transaction) => {
      const reference = firestore.collection("consultationBookings").doc(bookingId);
      const snapshot = await transaction.get(reference);
      const booking = snapshot.data();
      if (!snapshot.exists || !booking || booking.archivedAt != null) throw new ConsultationError("Consultation not found.", 404);
      if (role === "consumer" && booking.consumerId !== uid) throw new ConsultationError("You cannot update this appointment.", 403);
      // Idempotent retries do not replay audit entries, notifications or scheduling changes.
      if (booking.status === status) return { changes: { status: booking.status, confirmedDate: booking.confirmedDate, confirmedTime: booking.confirmedTime, adminNotes: booking.adminNotes }, confirmation: null };
      const allowed: Record<string, string[]> = { requested: ["confirmed", "rejected", "cancelled"], confirmed: ["completed", "cancelled"] };
      if (!allowed[booking.status]?.includes(String(status))) throw new ConsultationError("This appointment has changed. Refresh before trying again.", 409);
      const now = Timestamp.now();
      const update: Record<string, unknown> = { status, updatedAt: now, updatedBy: uid };
      if (role === "admin" && typeof input.adminNotes === "string") update.adminNotes = input.adminNotes.trim() || null;
      if (status === "confirmed") {
        const date = typeof input.confirmedDate === "string" ? input.confirmedDate : "";
        const time = typeof input.confirmedTime === "string" ? input.confirmedTime : "";
        if (!isIsoDate(date) || date < toDateInputValue() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
          || time < booking.slotStartTime || time >= booking.slotEndTime) throw new ConsultationError("Choose a valid date and a time within the preferred window.", 400);
        const consultant = await transaction.get(firestore.collection("consultants").doc(booking.consultantId));
        if (!consultant.exists || !publicConsultantProjection(consultant.id, consultant.data()!, booking.serviceId)) throw new ConsultationError("The consultant is no longer available for this service.", 409);
        update.confirmedDate = date; update.confirmedTime = time; update.confirmedAt = now;
      }
      if (status === "completed") update.completedAt = now;
      const admins = role === "consumer" ? await consultationAdminRecipients(transaction, firestore) : [];
      const audit = firestore.collection("auditLogs").doc();
      update.lastAuditId = audit.id;
      transaction.update(reference, update);
      transaction.create(audit, { action: "status_change", module: "consultationBookings", recordId: bookingId,
        actorId: uid, actorRole: role, previousValues: { status: booking.status }, updatedValues: update,
        timestamp: now, source: "server", device: requestAuditDevice(request) });
      const recipients = role === "admin" ? [{ id: booking.consumerId as string, role: "consumer" as const }]
        : admins.map((id) => ({ id, role: "admin" as const }));
      for (const recipient of recipients) addConsultationNotification(transaction, firestore, {
        recipientId: recipient.id, recipientRole: recipient.role, bookingId, bookingReference: booking.bookingReference,
        message: `${booking.serviceName}: appointment ${status}.`, event: `consultation_${status}`, actorId: uid, auditId: audit.id, now,
      });
      return { changes: update, confirmation: status === "confirmed" ? { ...booking, ...update } : null };
    });
    if (result.confirmation) scheduleBookingConfirmation("consultation", bookingId, result.confirmation);
    return mutationJson(result.changes);
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError || error instanceof ConsultationError) return apiJson({ error: error.message }, error.status);
    logApiError("PATCH /api/consultations/[bookingId]", error);
    return apiJson({ error: "We could not update this consultation. Try again." }, 503);
  }
}
