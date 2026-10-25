import { CONSULTANT_WEEK_DAYS, CONSULTANT_DAY_LABELS, type ConsultantWeekDay } from "@/features/consultants/validation";
import { formatDisplayDate, isIsoDate } from "@/utils/date";

export type ConsultantAvailability = { preferredDays?: ConsultantWeekDay[]; availableDates?: string[] };

/** Missing legacy preferences are unrestricted; malformed preferences fail closed. */
export function readConsultantAvailability(data: ConsultantAvailability | Record<string, unknown>): Required<ConsultantAvailability> | null {
  const days = data.preferredDays ?? [];
  const dates = data.availableDates ?? [];
  if (!Array.isArray(days) || days.length > 7 || new Set(days).size !== days.length
    || days.some((day) => !CONSULTANT_WEEK_DAYS.includes(day))
    || !Array.isArray(dates) || dates.length > 31 || new Set(dates).size !== dates.length
    || dates.some((date) => typeof date !== "string" || !isIsoDate(date))) return null;
  return { preferredDays: CONSULTANT_WEEK_DAYS.filter((day) => days.includes(day)), availableDates: dates.toSorted() };
}

export function isConsultantDateAvailable(date: string, availability: ConsultantAvailability): boolean {
  if (!isIsoDate(date)) return false;
  const config = readConsultantAvailability(availability);
  if (!config) return false;
  const index = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  return (!config.preferredDays.length || config.preferredDays.includes(CONSULTANT_WEEK_DAYS[index]))
    && (!config.availableDates.length || config.availableDates.includes(date));
}

export function consultantAvailabilitySummary(availability: ConsultantAvailability): string {
  const config = readConsultantAvailability(availability);
  if (!config) return "Availability needs updating";
  return [config.preferredDays.map((day) => CONSULTANT_DAY_LABELS[day]).join(", "),
    config.availableDates.map((date) => formatDisplayDate(date)).join(", ")].filter(Boolean).join(" · ") || "Any day";
}
