import type { Timestamp } from "firebase/firestore";
import { formatDisplayDate, toDateInputValue, parseDateInputValue } from "@/utils/date";

// Both operational SDK timestamps and public HTTP dates use identical care-date checks.
type HospitalAvailability = {
  blockedDateRanges?: ReadonlyArray<{ startDate: Timestamp | Date; endDate: Timestamp | Date }>;
};

export function parseAvailabilityDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Choose a valid ${label.toLowerCase()}.`);
  const date = parseDateInputValue(value);
  if (!date) throw new Error(`Choose a valid ${label.toLowerCase()}.`);
  return date;
}

export function validateAvailabilityRange(startValue: string, endValue: string) {
  const startDate = parseAvailabilityDate(startValue, "Start date");
  const endDate = parseAvailabilityDate(endValue, "End date");
  const today = parseDateInputValue(toDateInputValue())!;
  if (startDate < today) throw new Error("Choose a start date from today onwards.");
  if (endDate < startDate) throw new Error("Choose an end date on or after the start date.");
  const maximumEnd = new Date(`${startValue}T00:00:00Z`);
  maximumEnd.setUTCFullYear(maximumEnd.getUTCFullYear() + 1);
  if (endValue > maximumEnd.toISOString().slice(0, 10)) throw new Error("An availability block cannot be longer than one year.");
  return { startDate, endDate };
}

function asDate(value: Timestamp | Date | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : value.toDate();
}

function indiaCareDate(value: Date) {
  return toDateInputValue(value);
}

export function isHospitalUnavailable(
  hospital: HospitalAvailability,
  requestedStart: string | Date,
  requestedEnd?: string | Date | null,
) {
  // Blocks represent inclusive care dates in India, not the visitor's timezone.
  const start = typeof requestedStart === "string" ? requestedStart : indiaCareDate(requestedStart);
  const end = requestedEnd ? (typeof requestedEnd === "string" ? requestedEnd : indiaCareDate(requestedEnd)) : start;
  return (hospital.blockedDateRanges ?? []).some((range) => {
    const blockedStart = asDate(range.startDate);
    const blockedEnd = asDate(range.endDate);
    return Boolean(blockedStart && blockedEnd && start <= indiaCareDate(blockedEnd) && end >= indiaCareDate(blockedStart));
  });
}

export function isHospitalSoldOut(hospital: HospitalAvailability, startDate?: string | null, endDate?: string | null, now = new Date()) {
  return isHospitalUnavailable(hospital, startDate || indiaCareDate(now), endDate);
}

export function countUpcomingAvailabilityBlocks(
  hospital: HospitalAvailability,
  referenceDate = new Date(),
) {
  const startOfToday = toDateInputValue(referenceDate);

  return (hospital.blockedDateRanges ?? []).filter((range) => {
    const blockedEnd = asDate(range.endDate);
    return Boolean(blockedEnd && toDateInputValue(blockedEnd) >= startOfToday);
  }).length;
}

export function formatAvailabilityRange(start: Timestamp, end: Timestamp) {
  const format = formatDisplayDate;
  const startLabel = format(start.toDate());
  const endLabel = format(end.toDate());
  return startLabel === endLabel ? startLabel : `${startLabel} to ${endLabel}`;
}
