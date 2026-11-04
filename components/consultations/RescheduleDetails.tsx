import { bookingActorLabel } from "@/features/bookings/changeReason";
import type { ConsultationBookingDocument } from "@/features/firestore/models";
import { formatDisplayDateTime } from "@/utils/date";

export function RescheduleDetails({ booking }: { booking: ConsultationBookingDocument }) {
  const changedAt = booking.rescheduledAt ?? booking.consumerRescheduledAt;
  const changedLabel = formatDisplayDateTime(changedAt);
  if (!changedLabel && !booking.rescheduleReason && !booking.consumerRescheduleCount) return null;
  return <dl className="consumer-booking-facts">
    <div><dt>Rescheduled by</dt><dd>{bookingActorLabel(booking.rescheduledByRole)}</dd></div>
    {changedLabel && <div><dt>Rescheduled on</dt><dd>{changedLabel} IST</dd></div>}
    <div><dt>Rescheduling reason</dt><dd>{booking.rescheduleReason || "Reason not recorded"}</dd></div>
  </dl>;
}
