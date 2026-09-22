import type { BookingDocument } from "@/features/firestore/models";
import { formatBystanders } from "@/features/hospitals/searchContext";

type BookingCarePreference = Pick<BookingDocument, "preferredDate" | "preferredEndDate" | "preferredTime" | "bystanderCount">;

export function formatBookingCarePreference(booking: BookingCarePreference) {
  const startDate = booking.preferredDate.toDate().toLocaleDateString("en-IN");
  const endDate = booking.preferredEndDate?.toDate().toLocaleDateString("en-IN");
  const period = endDate && endDate !== startDate ? `${startDate} to ${endDate}` : startDate;
  const bystanders = formatBystanders(booking.bystanderCount ?? 1);
  const time = booking.preferredTime && booking.preferredTime !== "Flexible" ? ` at ${booking.preferredTime}` : "";
  return `${period}${time} · ${bystanders}`;
}
