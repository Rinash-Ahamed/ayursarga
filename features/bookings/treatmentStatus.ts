import type { BookingDocument, TreatmentStatus } from "@/features/firestore/models";

const TREATMENT_STATUSES: readonly TreatmentStatus[] = ["not_started", "started", "ongoing", "completed"];

export function getTreatmentStatus(booking: Pick<BookingDocument, "status" | "treatmentStatus">): TreatmentStatus {
  if (booking.status === "completed") return "completed";
  return booking.treatmentStatus && TREATMENT_STATUSES.includes(booking.treatmentStatus)
    ? booking.treatmentStatus
    : "not_started";
}
