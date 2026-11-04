import { withApiTiming } from "@/services/api/timing";
import { requireActiveUser, AdminAuthorizationError } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { allowRequest } from "@/services/api/rateLimit";
import { publicConsultantProjection } from "@/features/consultations/publicProjection";
import { consultationService } from "@/features/consultations/catalog";
import { generateConsultationSlots, CONSULTATION_HOLD_MS } from "@/features/consultations/slots";
import { readScheduleDay, slotState, SlotReservationError } from "@/services/consultations/slotReservationsAdmin";
import { isIsoDate, toDateInputValue } from "@/utils/date";
import { consumerRescheduleEligibility } from "@/features/consultations/rescheduling";

export const runtime = "nodejs";
async function handleGET(request: Request) {
  try {
    const { uid, role, firestore } = await requireActiveUser(request, ["admin", "consumer"]);
    if (!allowRequest(`consultation-slots:${uid}`, 180, 60_000)) return apiJson({ error: "Please wait a moment before checking times again." }, 429);
    const params = new URL(request.url).searchParams;
    const consultantId = params.get("consultantId") ?? "", date = params.get("date") ?? "";
    const service = consultationService(params.get("service")), exclude = params.get("excludeBookingId") ?? undefined;
    if (!/^AS\d{3,40}$/.test(consultantId) || !isIsoDate(date) || date < toDateInputValue() || !service
      || (exclude && !/^consultation-[a-f0-9]{64}$/.test(exclude))) return apiJson({ error: "Choose a valid consultant, date and service." }, 400);
    const now = new Date();
    const slots = await firestore.runTransaction(async transaction => {
      if (exclude && role === "consumer") {
        const booking = (await transaction.get(firestore.collection("consultationBookings").doc(exclude))).data();
        if (!booking || booking.archivedAt != null || booking.consumerId !== uid || booking.consultantId !== consultantId || booking.serviceId !== service.id) throw new SlotReservationError("This appointment is not available to reschedule.", 403);
        if (!consumerRescheduleEligibility(booking, now.getTime()).allowed) throw new SlotReservationError("Your one-time reschedule is unavailable. It must be requested at least 24 hours before the appointment.", 409);
      }
      const consultant = await transaction.get(firestore.collection("consultants").doc(consultantId));
      const provider = consultant.exists ? publicConsultantProjection(consultantId, consultant.data()!, service.id) : null;
      if (!provider) throw new SlotReservationError("This consultant is no longer available for this service.", 404);
      const day = await readScheduleDay(transaction, firestore, consultantId, date);
      return generateConsultationSlots(date, service.id, provider, now).map(slot => ({ ...slot, status: slotState(day, slot, now.getTime(), exclude) }))
        .filter(slot => role === "admin" || slot.status === "available");
    }, { readOnly: true });
    return apiJson({ slots, checkedAt: now.toISOString(), holdMinutes: CONSULTATION_HOLD_MS / 60_000 });
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof SlotReservationError) return apiJson({ error: error.message }, error.status);
    logApiError("GET /api/consultations/slots", error);
    return apiJson({ error: "Appointment times could not be checked. Please try again." }, 503);
  }
}

export const GET = withApiTiming("GET /api/consultations/slots", handleGET);
