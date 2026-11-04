export { MAX_BOOKING_CHANGE_REASON as MAX_CANCELLATION_REASON, bookingChangeReason as cancellationReason, bookingActorLabel as cancelledByLabel } from "@/features/bookings/changeReason";
export type CancellationDetails = {
  cancellationReason?: string;
  cancelledByRole?: "admin" | "consumer";
  cancelledBy?: string;
  cancelledAt?: import("firebase/firestore").Timestamp;
};
