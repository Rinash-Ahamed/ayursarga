import { CONSULTANT_TIME_SLOTS, CONSULTANT_TIME_SLOT_CONFIG, type ConsultantTimeSlot } from "@/features/consultants/validation";
import { consultationService } from "@/features/consultations/catalog";
import { readConsultantAvailability } from "@/features/consultations/availability";
import type { PublicConsultant } from "@/features/consultations/types";

/** Whitelist only: no contact data, address, emergency details or audit metadata. */
export function publicConsultantProjection(id: string, data: Record<string, unknown>, serviceId: string): PublicConsultant | null {
  if (!consultationService(serviceId) || data.status !== "active" || data.archivedAt != null
    || !Array.isArray(data.consultationServices) || !data.consultationServices.includes(serviceId)
    || typeof data.name !== "string" || !data.name.trim()
    || typeof data.consultantCharge !== "number" || !Number.isFinite(data.consultantCharge)
    || data.consultantCharge < 0 || !Number.isSafeInteger(Math.round(data.consultantCharge * 100))) return null;
  const preferredTimeSlots: ConsultantTimeSlot[] = [];
  const availability = readConsultantAvailability(data);
  if (!availability) return null;
  const preferredSlotTimings: PublicConsultant["preferredSlotTimings"] = {};
  const timings = data.preferredSlotTimings as PublicConsultant["preferredSlotTimings"] | undefined;
  for (const slot of CONSULTANT_TIME_SLOTS) {
    if (!Array.isArray(data.preferredTimeSlots) || !data.preferredTimeSlots.includes(slot)) continue;
    const timing = timings?.[slot] ?? CONSULTANT_TIME_SLOT_CONFIG[slot];
    if (!timing || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timing.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timing.endTime) || timing.endTime <= timing.startTime) continue;
    preferredTimeSlots.push(slot);
    preferredSlotTimings[slot] = { startTime: timing.startTime, endTime: timing.endTime };
  }
  if (!preferredTimeSlots.length) return null;
  return { id, name: data.name.trim().slice(0, 120), designation: typeof data.designation === "string" ? data.designation.slice(0, 120) : "",
    qualification: typeof data.qualification === "string" ? data.qualification.slice(0, 200) : "",
    yearsExperience: typeof data.yearsExperience === "number" && Number.isFinite(data.yearsExperience) ? data.yearsExperience : 0,
    consultantCharge: data.consultantCharge, ...availability, preferredTimeSlots, preferredSlotTimings };
}
