import { isIsoDate } from "@/utils/date";
import { validCancellationSnapshot } from "@/features/consultations/cancellationPolicy";

export const CONSUMER_RESCHEDULE_HOURS = 24;
export type RescheduleDetails = {
  rescheduleReason?: string;
  rescheduledByRole?: "admin" | "consumer";
  rescheduledBy?: string;
  rescheduledAt?: import("firebase/firestore").Timestamp;
};
/** Shared display/server rule. The mutation must evaluate it on the current transaction snapshot. */
export function consumerRescheduleEligibility(value: unknown, now: number) {
  const booking = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const date = booking.confirmedDate ?? booking.preferredDate;
  const time = booking.confirmedTime ?? booking.slotStartTime;
  const reference = validCancellationSnapshot(booking.cancellationPolicy) ? Date.parse(booking.cancellationPolicy.appointmentAt)
    : booking.cancellationPolicy == null && typeof date === "string" && typeof time === "string" && isIsoDate(date) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)
      ? Date.parse(`${date}T${time}:00+05:30`) : NaN;
  const deadline = reference - CONSUMER_RESCHEDULE_HOURS * 3600000;
  const deadlineAt = Number.isFinite(deadline) ? new Date(deadline).toISOString() : null;
  const used = booking.consumerRescheduledAt != null || (booking.consumerRescheduleCount ?? 0) !== 0;
  const allowed = booking.status === "confirmed" && !used && Number.isFinite(now) && deadlineAt !== null && now <= deadline;
  return { allowed, used, deadlineAt };
}
