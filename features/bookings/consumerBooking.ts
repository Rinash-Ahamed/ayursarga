import type { BookingDocument } from "@/features/firestore/models";

// An explicit allowlist: adding operational fields must never publish them.
export const CONSUMER_BOOKING_FIELDS = [
  "bookingReference", "hospitalId", "serviceId", "hospitalName", "hospitalLocation", "serviceName",
  "preferredDate", "preferredEndDate", "preferredTime", "confirmedDate", "confirmedTime",
  "status", "treatmentStatus", "servicePrice", "bystanderCount", "additionalBystanderTotal",
  "consumerNotes", "hospitalNotes", "createdAt", "lastAuditId",
  "cancellationReason", "cancelledByRole", "cancelledAt",
] as const satisfies readonly (keyof BookingDocument)[];

export type ConsumerBooking = Pick<BookingDocument, typeof CONSUMER_BOOKING_FIELDS[number]>;

export function projectConsumerBooking(id: string, data: Record<string, unknown>) {
  return { id, ...Object.fromEntries(CONSUMER_BOOKING_FIELDS
    .filter(field => data[field] !== undefined)
    .map(field => [field, data[field]])) };
}
