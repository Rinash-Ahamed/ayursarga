import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveUser } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { allowRequest, requestFingerprint } from "@/services/api/rateLimit";
import { requestAuditDevice } from "@/services/api/audit";
import { reserveBookingReference } from "@/services/bookings/bookingReferenceAdmin";
import { consultationAdminRecipients, addConsultationNotification } from "@/services/consultations/consultationNotificationsAdmin";
import { consultationService } from "@/features/consultations/catalog";
import { publicConsultantProjection } from "@/features/consultations/publicProjection";
import { CONSULTANT_TIME_SLOTS, type ConsultantTimeSlot } from "@/features/consultants/validation";
import { BOOKING_TERMS_VERSION, CUSTOMER_TERMS_VERSION, CONSUMER_PRIVACY_NOTICE_VERSION } from "@/features/consumers/privacyConsent";
import { isValidPhoneNumber } from "@/utils/phone";
import { isIsoDate, toDateInputValue } from "@/utils/date";
import { validConsultationSchedule } from "@/features/consultations/schedule";
import { isConsultantDateAvailable } from "@/features/consultations/availability";
import { queueConsultationEmail, deliverConsultationEmails } from "@/services/email/consultationEmailService";

export const runtime = "nodejs";
export const maxDuration = 60;
class ConsultationError extends Error { constructor(message: string, public status: number) { super(message); } }

export async function POST(request: Request) {
  try {
    const { uid, profile, firestore } = await requireActiveUser(request, ["consumer"]);
    if (!allowRequest(requestFingerprint(request, `consultation:${uid}`), 20, 10 * 60 * 1000)) return apiJson({ error: "Please wait before booking again." }, 429);
    const body = await readJsonBody(request, 6_000) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) return apiJson({ error: "Consultation details are required." }, 400);
    if (profile.privacyConsentVersion !== CONSUMER_PRIVACY_NOTICE_VERSION || profile.customerTermsVersion !== CUSTOMER_TERMS_VERSION
      || !profile.privacyConsentAt || !profile.customerTermsAcceptedAt || typeof profile.phone !== "string" || !isValidPhoneNumber(profile.phone.trim())) return apiJson({ error: "Complete your profile and consent before booking." }, 409);
    if (body.bookingTermsAccepted !== true) return apiJson({ error: "Accept the booking terms and policies." }, 400);
    const service = consultationService(body.serviceId);
    const consultantId = typeof body.consultantId === "string" && /^AS\d{3,}$/.test(body.consultantId) && body.consultantId.length <= 40 ? body.consultantId : null;
    const date = typeof body.preferredDate === "string" ? body.preferredDate : "";
    const slot = body.preferredTimeSlot as ConsultantTimeSlot;
    const requestId = typeof body.requestId === "string" && /^[a-zA-Z0-9-]{16,100}$/.test(body.requestId) ? body.requestId : null;
    const notes = typeof body.consumerNotes === "string" ? body.consumerNotes.trim() : "";
    const expectedCharge = body.expectedCharge;
    if (!service || !consultantId || !requestId || !isIsoDate(date) || date < toDateInputValue() || !CONSULTANT_TIME_SLOTS.includes(slot) || notes.length > 500
      || typeof expectedCharge !== "number" || !Number.isFinite(expectedCharge) || expectedCharge < 0) return apiJson({ error: "Choose a valid service, consultant, date and preferred time window." }, 400);
    const id = `consultation-${createHash("sha256").update(`${uid}:${requestId}`).digest("hex")}`;
    const reference = firestore.collection("consultationBookings").doc(id);
    const result = await firestore.runTransaction(async (transaction) => {
      const [current, consultant] = await transaction.getAll(reference, firestore.collection("consultants").doc(consultantId));
      if (current.exists) {
        const previous = current.data()!;
        if (previous.consumerId !== uid || previous.consultantId !== consultantId || previous.serviceId !== service.id
          || previous.preferredDate !== date || previous.preferredTimeSlot !== slot || previous.consultantCharge !== expectedCharge
          || previous.slotStartTime !== body.expectedSlotStartTime || previous.slotEndTime !== body.expectedSlotEndTime) throw new ConsultationError("This attempt already belongs to different consultation details.", 409);
        return { bookingReference: String(previous.bookingReference), duplicate: true };
      }
      const provider = consultant.exists ? publicConsultantProjection(consultantId, consultant.data()!, service.id) : null;
      const timing = provider?.preferredSlotTimings[slot];
      if (!provider || !provider.preferredTimeSlots.includes(slot) || !timing) throw new ConsultationError("This consultant or time window is no longer bookable. Please choose again.", 409);
      if (provider.consultantCharge !== expectedCharge) throw new ConsultationError("The consultation charge has changed. Refresh the consultant list and review the new charge before booking.", 409);
      if (!isConsultantDateAvailable(date, provider)) throw new ConsultationError("The consultant is not available on this date. Choose an available day or refresh the consultant list.", 409);
      if (timing.startTime !== body.expectedSlotStartTime || timing.endTime !== body.expectedSlotEndTime) throw new ConsultationError("The preferred time window has changed. Refresh the consultant list and choose again.", 409);
      if (!validConsultationSchedule(date, timing.startTime, timing.endTime)) throw new ConsultationError("Choose an available date and time window that has not ended.", 400);
      const admins = await consultationAdminRecipients(transaction, firestore);
      const bookingReference = await reserveBookingReference(transaction, firestore, id);
      const audit = firestore.collection("auditLogs").doc();
      const now = FieldValue.serverTimestamp();
      const data = {
        bookingReference, consumerId: uid, consumerName: String(profile.name ?? "").trim(),
        consumerEmail: String(profile.email ?? "").trim().toLowerCase(), consumerPhone: profile.phone.trim(),
        consumerAddress: typeof profile.address === "string" ? profile.address.trim() || null : null,
        consultantId, consultantName: provider.name, consultantDesignation: provider.designation,
        serviceId: service.id, serviceName: service.label, consultantCharge: provider.consultantCharge,
        preferredDate: date, preferredTimeSlot: slot, slotStartTime: timing.startTime, slotEndTime: timing.endTime,
        consumerNotes: notes || null, adminNotes: null, status: "confirmed", confirmedDate: date, confirmedTime: null,
        confirmedAt: now, completedAt: null, bookingTermsAcceptedAt: now, bookingTermsVersion: BOOKING_TERMS_VERSION,
        createdAt: now, createdBy: uid, updatedAt: now, updatedBy: uid, archivedAt: null, archivedBy: null, lastAuditId: audit.id,
      };
      transaction.create(reference, data);
      transaction.create(audit, { action: "create", module: "consultationBookings", recordId: id, actorId: uid, actorRole: "consumer",
        previousValues: null, updatedValues: data, timestamp: now, source: "server", device: requestAuditDevice(request) });
      queueConsultationEmail(transaction, firestore, { eventId: `confirmation-${id}`, bookingId: id, event: "confirmed",
        booking: data, consultant: consultant.data()!, actorId: uid, actorRole: "consumer", auditId: audit.id, now });
      for (const admin of admins) addConsultationNotification(transaction, firestore, { recipientId: admin, recipientRole: "admin", bookingId: id, bookingReference,
        message: `${provider.name} · ${service.label} · Online appointment confirmed.`, event: "consultation_created", actorId: uid, auditId: audit.id, now });
      return { bookingReference, duplicate: false };
    });
    const { email } = await deliverConsultationEmails(firestore, `confirmation-${id}`);
    return apiJson({ ok: true, bookingId: id, ...result, email }, result.duplicate ? 200 : 201);
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError || error instanceof ConsultationError) return apiJson({ error: error.message }, error.status);
    logApiError("POST /api/consumer/consultations", error);
    return apiJson({ error: "We could not book your consultation. Please try again." }, 503);
  }
}
