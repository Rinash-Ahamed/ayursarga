import type { BookingDocument, TreatmentStatus } from "@/features/firestore/models";

const TREATMENT_STATUSES: readonly TreatmentStatus[] = ["not_started", "started", "ongoing", "completed"];

export const TREATMENT_PROGRESS_STEPS = ["Yet to be started", "Ongoing", "Completed"] as const;

/** Both stored in-progress states represent the same stage to the customer. */
export function getTreatmentProgress(status: TreatmentStatus) {
  const index = status === "completed" ? 2 : status === "started" || status === "ongoing" ? 1 : 0;
  return { index, label: TREATMENT_PROGRESS_STEPS[index] };
}

export function treatmentStatusLabel(status: TreatmentStatus) {
  if (status === "completed") return "Treatment completed";
  if (status === "started" || status === "ongoing") return "Treatment Started";
  return "Treatment not started";
}

export function getTreatmentStatus(booking: Pick<BookingDocument, "status" | "treatmentStatus">): TreatmentStatus {
  if (booking.status === "completed") return "completed";
  return booking.treatmentStatus && TREATMENT_STATUSES.includes(booking.treatmentStatus)
    ? booking.treatmentStatus
    : "not_started";
}
