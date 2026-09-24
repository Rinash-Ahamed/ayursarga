import { Timestamp } from "firebase/firestore";
import type { HospitalDocument } from "@/features/firestore/models";

export function parseAvailabilityDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Choose a valid ${label.toLowerCase()}.`);
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error(`Choose a valid ${label.toLowerCase()}.`);
  return date;
}

export function validateAvailabilityRange(startValue: string, endValue: string) {
  const startDate = parseAvailabilityDate(startValue, "Start date");
  const endDate = parseAvailabilityDate(endValue, "End date");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (startDate < today) throw new Error("Choose a start date from today onwards.");
  if (endDate < startDate) throw new Error("Choose an end date on or after the start date.");
  const maximumEnd = new Date(startDate);
  maximumEnd.setFullYear(maximumEnd.getFullYear() + 1);
  if (endDate > maximumEnd) throw new Error("An availability block cannot be longer than one year.");
  return { startDate, endDate };
}

function asDate(value: Timestamp | Date | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : value.toDate();
}

export function isHospitalUnavailable(
  hospital: Pick<HospitalDocument, "blockedDateRanges">,
  requestedStart: string | Date,
  requestedEnd?: string | Date | null,
) {
  const start = typeof requestedStart === "string" ? parseAvailabilityDate(requestedStart, "Start date") : requestedStart;
  const end = requestedEnd
    ? (typeof requestedEnd === "string" ? parseAvailabilityDate(requestedEnd, "End date") : requestedEnd)
    : start;
  return (hospital.blockedDateRanges ?? []).some((range) => {
    const blockedStart = asDate(range.startDate);
    const blockedEnd = asDate(range.endDate);
    return Boolean(blockedStart && blockedEnd && start <= blockedEnd && end >= blockedStart);
  });
}

export function formatAvailabilityRange(start: Timestamp, end: Timestamp) {
  const format = (date: Date) => date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const startLabel = format(start.toDate());
  const endLabel = format(end.toDate());
  return startLabel === endLabel ? startLabel : `${startLabel} to ${endLabel}`;
}
