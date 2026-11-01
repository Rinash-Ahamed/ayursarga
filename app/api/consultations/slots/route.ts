import { requireActiveUser, AdminAuthorizationError } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { allowRequest } from "@/services/api/rateLimit";
import { publicConsultantProjection } from "@/features/consultations/publicProjection";
import { consultationService } from "@/features/consultations/catalog";
import { generateConsultationSlots, CONSULTATION_HOLD_MS } from "@/features/consultations/slots";
import { readScheduleDay, slotState, SlotReservationError } from "@/services/consultations/slotReservationsAdmin";
import { isIsoDate, toDateInputValue } from "@/utils/date";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { uid, role, firestore } = await requireActiveUser(request, ["admin", "consumer"]);
    if (!allowRequest(`consultation-slots:${uid}`, 180, 60_000)) return apiJson({ error: "Please wait a moment before checking times again." }, 429);
    const params = new URL(request.url).searchParams;
    const consultantId = params.get("consultantId") ?? "", date = params.get("date") ?? "";
    const service = consultationService(params.get("service")), exclude = params.get("excludeBookingId") ?? undefined;
    if (!/^AS\d{3,40}$/.test(consultantId) || !isIsoDate(date) || date < toDateInputValue() || !service
      || (exclude && (role !== "admin" || !/^consultation-[a-f0-9]{64}$/.test(exclude)))) return apiJson({ error: "Choose a valid consultant, date and service." }, 400);
    const now = new Date();
    const slots = await firestore.runTransaction(async transaction => {
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
