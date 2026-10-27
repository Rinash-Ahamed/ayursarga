import type { BookingDocument } from "@/features/firestore/models";
import { formatBystanders } from "@/features/hospitals/searchContext";
import { formatCurrency } from "@/utils/currency";
import { formatStatus } from "@/utils/text";
import { formatDisplayDate, formatDisplayDateTime } from "@/utils/date";

/** Placement time is independent of care dates and appointment schedules. */
export function formatBookingPlacedAt(value: unknown) {
  // Do not manufacture midnight for legacy records that contain only a date.
  if (typeof value === "string" && (/^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(value))) {
    const date = formatDisplayDate(value);
    return date ? `${date} (time not recorded)` : "Not recorded";
  }
  const timestamp = formatDisplayDateTime(value);
  return timestamp ? `${timestamp} IST` : "Not recorded";
}

export function bookingReferenceLabel(booking: Pick<BookingDocument, "bookingReference">) {
  return booking.bookingReference || "Reference unavailable. Refresh to retry.";
}

export function bookingStatusLabel(status: BookingDocument["status"]) {
  return status === "requested" ? "Booked · awaiting confirmation" : formatStatus(status);
}

/** Booking placement is not the scheduled care date (or the confirmation time). */
export function bookingDateFacts(booking: Pick<BookingDocument, "createdAt" | "preferredDate" | "confirmedDate" | "confirmedTime" | "status">) {
  const facts = [{ label: "Booked on", value: formatBookingPlacedAt(booking.createdAt) }];
  const scheduled = formatDisplayDate(booking.confirmedDate);
  const preferred = formatDisplayDate(booking.preferredDate);
  // New automatically confirmed bookings repeat the preferred date. Preserve
  // genuinely different schedules, exact times and historical proposals.
  if (scheduled && (scheduled !== preferred || booking.confirmedTime || booking.status === "reschedule_requested")) {
    facts.push({
      label: booking.status === "reschedule_requested" ? "Proposed care date" : "Scheduled care date",
      value: `${scheduled}${booking.confirmedTime ? ` · ${booking.confirmedTime}` : ""}`,
    });
  }
  return facts;
}

type BookingCarePreference = Pick<BookingDocument, "preferredDate" | "preferredEndDate" | "preferredTime" | "bystanderCount" | "additionalBystanderTotal">;

export function formatBookingCarePreference(booking: BookingCarePreference) {
  const startDate = formatDisplayDate(booking.preferredDate);
  const endDate = formatDisplayDate(booking.preferredEndDate);
  const period = endDate && endDate !== startDate ? `${startDate} to ${endDate}` : startDate;
  const bystanderCharge = booking.additionalBystanderTotal ?? 0;
  const bystanders = `${formatBystanders(booking.bystanderCount ?? 1)}${bystanderCharge > 0 ? ` (${formatCurrency(bystanderCharge)} additional)` : ""}`;
  const time = booking.preferredTime && booking.preferredTime !== "Flexible" ? ` at ${booking.preferredTime}` : "";
  return `${period}${time} · ${bystanders}`;
}
