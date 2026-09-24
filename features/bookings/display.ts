import type { BookingDocument } from "@/features/firestore/models";
import { formatBystanders } from "@/features/hospitals/searchContext";
import { formatCurrency } from "@/utils/currency";

type BookingCarePreference = Pick<BookingDocument, "preferredDate" | "preferredEndDate" | "preferredTime" | "bystanderCount" | "additionalBystanderTotal">;

export function formatBookingCarePreference(booking: BookingCarePreference) {
  const startDate = booking.preferredDate.toDate().toLocaleDateString("en-IN");
  const endDate = booking.preferredEndDate?.toDate().toLocaleDateString("en-IN");
  const period = endDate && endDate !== startDate ? `${startDate} to ${endDate}` : startDate;
  const bystanderCharge = booking.additionalBystanderTotal ?? 0;
  const bystanders = `${formatBystanders(booking.bystanderCount ?? 1)}${bystanderCharge > 0 ? ` (${formatCurrency(bystanderCharge)} additional)` : ""}`;
  const time = booking.preferredTime && booking.preferredTime !== "Flexible" ? ` at ${booking.preferredTime}` : "";
  return `${period}${time} · ${bystanders}`;
}
