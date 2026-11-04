import { withApiTiming, timeApiStep } from "@/services/api/timing";
import { requireActiveUser, AdminAuthorizationError } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { allowRequest } from "@/services/api/rateLimit";
import { consultationService } from "@/features/consultations/catalog";
import { publicConsultantProjection } from "@/features/consultations/publicProjection";
import { getConsultantPricing } from "@/features/consultants/pricing";
import { generateConsultationSlots } from "@/features/consultations/slots";
import { readScheduleDays, slotState, SlotReservationError } from "@/services/consultations/slotReservationsAdmin";
import type { AvailableConsultant } from "@/features/consultations/types";
import { isIsoDate, toDateInputValue } from "@/utils/date";

export const runtime = "nodejs";
const PAGE_SIZE = 8;

async function handleGET(request: Request) {
  try {
    const {uid, firestore} = await requireActiveUser(request, ["consumer", "admin"]);
    if (!allowRequest(`consultation-availability:${uid}`, 90, 60_000)) return apiJson({error:"Please wait a moment before checking availability again."}, 429);
    const params = new URL(request.url).searchParams;
    const service = consultationService(params.get("service")), date = params.get("date") ?? "", cursor = params.get("cursor");
    if (!service || !isIsoDate(date) || date < toDateInputValue() || (cursor !== null && (!/^\d{1,15}$/.test(cursor) || !Number.isSafeInteger(Number(cursor)) || Number(cursor) < 1))) {
      return apiJson({error:"Choose a valid service and future appointment date."}, 400);
    }
    let query = firestore.collection("consultants").where("status", "==", "active")
      .where("consultationServices", "array-contains", service.id).orderBy("employeeSequence", "asc");
    if (cursor) query = query.startAfter(Number(cursor));
    const now = new Date();
    const result = await timeApiStep("database", () => firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(query.limit(PAGE_SIZE + 1));
      const page = snapshot.docs.slice(0, PAGE_SIZE);
      const eligible = page.flatMap(doc => {
          const data = doc.data();
          const pricing = getConsultantPricing(data.consultantCharge, data.ayursargaCommissionPercentage);
          // Match checkout's explicit commission and INR 1 minimum without
          // changing legacy professional discovery or existing appointments.
          if (!pricing || pricing.totalCharge < 1) return [];
          const provider = publicConsultantProjection(doc.id, data, service.id);
          if (!provider) return [];
          const generated = generateConsultationSlots(date, service.id, provider, now);
          if (!generated.length) return [];
          return [{ id: doc.id, provider, generated }];
      });
      const days = await readScheduleDays(transaction, firestore, eligible.map(item => item.id), date);
      const documents: AvailableConsultant[] = eligible.flatMap(({id, provider, generated}) => {
          const day = days.get(id)!;
          const availableSlots = generated.filter(slot => slotState(day, slot, now.getTime()) === "available");
          return availableSlots.length ? [{...provider, availabilityDate:date, availabilityService:service.id, availableSlots}] : [];
      });
      const lastSequence = page.length ? Number(page[page.length - 1].data().employeeSequence) : null;
      if (lastSequence !== null && (!Number.isSafeInteger(lastSequence) || lastSequence < 1)) throw new SlotReservationError("Consultant availability needs review. Please contact Ayursarga.", 503);
      return {documents, cursor:lastSequence, hasMore:snapshot.docs.length > PAGE_SIZE};
    }, {readOnly:true}));
    return apiJson(result);
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof SlotReservationError) return apiJson({error:error.message}, error.status);
    logApiError("GET /api/consultations/availability", error);
    return apiJson({error:"Appointment availability could not be checked. Please try again."}, 503);
  }
}

export const GET = withApiTiming("GET /api/consultations/availability", handleGET);
