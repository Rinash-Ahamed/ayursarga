import { isIsoDate } from "@/utils/date";

/** Complete only after the saved appointment/window ends, never a new provider schedule. */
export function consultationCompletionEligibility(booking: {
  status: string;
  confirmedDate?: string | null;
  preferredDate?: string | null;
  confirmedTime?: string | null;
  confirmedEndTime?: string | null;
  slotStartTime?: string | null;
  slotEndTime?: string | null;
}, now: number) {
  const date = booking.confirmedDate ?? booking.preferredDate;
  const start = booking.confirmedTime ?? booking.slotStartTime;
  const end = booking.confirmedEndTime ?? booking.slotEndTime;
  const validTime = (value: unknown): value is string => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  const ends = typeof date === "string" && isIsoDate(date) && validTime(start) && validTime(end) && end > start
    ? Date.parse(`${date}T${end}:00+05:30`) : NaN;
  return { allowed: booking.status === "confirmed" && Number.isFinite(now) && Number.isFinite(ends) && now >= ends,
    endsAt: Number.isFinite(ends) ? new Date(ends).toISOString() : null };
}
