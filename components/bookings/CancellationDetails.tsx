import { cancelledByLabel, type CancellationDetails as Details } from "@/features/bookings/cancellation";

export function CancellationDetails({ booking }: { booking: Details & { status: string } }) {
  if (booking.status !== "cancelled") return null;
  return <dl className="consumer-booking-facts">
    <div><dt>Cancelled by</dt><dd>{cancelledByLabel(booking.cancelledByRole)}</dd></div>
    <div><dt>Cancellation reason</dt><dd>{booking.cancellationReason || "Reason not recorded"}</dd></div>
  </dl>;
}
