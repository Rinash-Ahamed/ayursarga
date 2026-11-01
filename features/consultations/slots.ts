import { CONSULTANT_TIME_SLOTS, type ConsultantSlotTimings, type ConsultantTimeSlot } from "@/features/consultants/validation";
import { isConsultantDateAvailable, type ConsultantAvailability } from "@/features/consultations/availability";
import { validConsultationSchedule } from "@/features/consultations/schedule";

export const CONSULTATION_HOLD_MS = 10 * 60 * 1000;
export type AppointmentSlot = { startTime: string; endTime: string; window: ConsultantTimeSlot; status: "available" | "booked" | "reserved" };
export const consultationDuration = (service: string) => service === "psychologist" ? 60 : 30;
export const minutesOfTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN;
export const timeOfMinutes = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export const intervalsOverlap = (a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) => a.startTime < b.endTime && b.startTime < a.endTime;

export function generateConsultationSlots(date: string, service: string, provider: ConsultantAvailability & { preferredTimeSlots: ConsultantTimeSlot[]; preferredSlotTimings: ConsultantSlotTimings }, now = new Date()): AppointmentSlot[] {
  if (!isConsultantDateAvailable(date, provider)) return [];
  const duration = consultationDuration(service);
  const slots: AppointmentSlot[] = [];
  for (const window of CONSULTANT_TIME_SLOTS) {
    if (!provider.preferredTimeSlots.includes(window)) continue;
    const timing = provider.preferredSlotTimings[window];
    if (!timing) continue;
    const start = minutesOfTime(timing.startTime), end = minutesOfTime(timing.endTime);
    const count = Math.floor((end - start) / duration);
    for (let index = 0; Number.isFinite(count) && index < count; index++) {
      // Keep full durations and anchor the final slot to closing time. If the
      // window has a remainder, leave that short gap before the final slot.
      const minute = index === count - 1 ? end - duration : start + index * duration;
      const startTime = timeOfMinutes(minute), endTime = timeOfMinutes(minute + duration);
      if (validConsultationSchedule(date, startTime, endTime, startTime, now)
        && !slots.some(slot => slot.startTime === startTime)) slots.push({ startTime, endTime, window, status: "available" });
    }
  }
  return slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function formatAppointmentRange(start: string, end: string) {
  const format = (time: string) => {
    const minutes = minutesOfTime(time);
    if (!Number.isFinite(minutes)) return time;
    const hour = Math.floor(minutes / 60);
    return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
  };
  return `${format(start)} – ${format(end)}`;
}
