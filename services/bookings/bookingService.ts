"use client";

import { Timestamp, type DocumentData } from "firebase/firestore";
import type { BookingDocument, BookingStatus, TreatmentStatus } from "@/features/firestore/models";
import { getTreatmentStatus } from "@/features/bookings/treatmentStatus";
import { COLLECTIONS } from "@/constants/firestore";
import {
  firestoreTimestamp, runFilteredQuery,
  type QueryPageOptions,
} from "@/services/firestore/firestoreService";
import { getAuditActorId, updateAuditedDocument } from "@/services/firestore/auditService";
import { authorizedApiRequest } from "@/services/api/client";

type BookingRequestInput = {
  consumerId: string; hospitalId: string; serviceId: string; preferredDate: Date;
  preferredEndDate?: Date | null; preferredTime: string; bystanderCount: number;
  consumerNotes?: string | null; consumerName: string;
  consumerEmail: string; consumerPhone: string; consumerAddress: string | null;
  bookingTermsAccepted: boolean; requestId: string;
};

export async function createBookingRequest(input: BookingRequestInput) {
  if (!input.bookingTermsAccepted) throw new Error("Read and accept the applicable terms and policies before sending your request.");
  if (Number.isNaN(input.preferredDate.getTime())) throw new Error("Choose a valid preferred start date.");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (input.preferredDate < today) throw new Error("Choose a preferred start date from today onwards.");
  if (input.preferredEndDate && (Number.isNaN(input.preferredEndDate.getTime()) || input.preferredEndDate < input.preferredDate)) {
    throw new Error("Choose an end date on or after the preferred start date.");
  }
  const localDate = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  return authorizedApiRequest<{ ok: true; bookingId: string }>("/api/consumer/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hospitalId: input.hospitalId,
      serviceId: input.serviceId,
      preferredDate: localDate(input.preferredDate),
      preferredEndDate: input.preferredEndDate ? localDate(input.preferredEndDate) : null,
      bystanderCount: input.bystanderCount,
      consumerNotes: input.consumerNotes?.trim() || null,
      bookingTermsAccepted: input.bookingTermsAccepted,
      requestId: input.requestId,
    }),
    signedOutMessage: "Sign in before sending an appointment request.",
    failureMessage: "We could not send your appointment request. Please try again.",
  });
}

function listBookings(filters: QueryPageOptions["filters"], options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  return runFilteredQuery<BookingDocument>({
    collectionPath: COLLECTIONS.bookings, filters,
    sort: { field: "createdAt", direction: "desc" }, ...options,
  });
}

export const listConsumerBookings = (consumerId: string, options?: Pick<QueryPageOptions, "pageSize" | "cursor">) =>
  listBookings([{ field: "consumerId", operator: "==", value: consumerId }], options);
type HospitalBookingFilters = {
  status?: BookingStatus;
  createdFrom?: Date;
  createdBefore?: Date;
};

export function listHospitalBookings(
  hospitalId: string,
  input: HospitalBookingFilters = {},
  options?: Pick<QueryPageOptions, "pageSize" | "cursor">,
) {
  const filters: NonNullable<QueryPageOptions["filters"]> = [
    { field: "hospitalId", operator: "==", value: hospitalId },
  ];
  if (input.status) filters.push({ field: "status", operator: "==", value: input.status });
  if (input.createdFrom) filters.push({ field: "createdAt", operator: ">=", value: Timestamp.fromDate(input.createdFrom) });
  if (input.createdBefore) filters.push({ field: "createdAt", operator: "<", value: Timestamp.fromDate(input.createdBefore) });
  return listBookings(filters, options);
}

type AdminBookingFilters = {
  hospitalId?: string;
  status?: BookingStatus;
  createdFrom?: Date;
  createdBefore?: Date;
};

export function listAdminBookings(
  input: AdminBookingFilters,
  options?: Pick<QueryPageOptions, "pageSize" | "cursor">,
) {
  const filters: NonNullable<QueryPageOptions["filters"]> = [];
  if (input.hospitalId) filters.push({ field: "hospitalId", operator: "==", value: input.hospitalId });
  if (input.status) filters.push({ field: "status", operator: "==", value: input.status });
  if (input.createdFrom) filters.push({ field: "createdAt", operator: ">=", value: Timestamp.fromDate(input.createdFrom) });
  if (input.createdBefore) filters.push({ field: "createdAt", operator: "<", value: Timestamp.fromDate(input.createdBefore) });
  return listBookings(filters, options);
}

export const cancelConsumerBooking = (id: string, previousValues?: DocumentData) => updateAuditedDocument(COLLECTIONS.bookings, id, {
  status: "cancelled", updatedAt: firestoreTimestamp.server(), updatedBy: getAuditActorId(),
}, { action: "status_change", actorRole: "consumer" }, previousValues);

export type HospitalBookingUpdate = {
  status: Extract<BookingStatus, "confirmed" | "reschedule_requested" | "rejected">;
  confirmedDate?: Date | null; confirmedTime?: string | null; hospitalNotes?: string | null;
};

export function updateHospitalBooking(id: string, input: HospitalBookingUpdate, previousValues?: DocumentData) {
  const data: Record<string, unknown> = {
    status: input.status, hospitalNotes: input.hospitalNotes?.trim() || null,
    updatedAt: firestoreTimestamp.server(),
  };
  if (input.confirmedDate !== undefined) data.confirmedDate = input.confirmedDate ? Timestamp.fromDate(input.confirmedDate) : null;
  if (input.confirmedTime !== undefined) data.confirmedTime = input.confirmedTime;
  if (input.status === "confirmed") data.confirmedAt = firestoreTimestamp.server();
  data.updatedBy = getAuditActorId();
  return updateAuditedDocument(COLLECTIONS.bookings, id, data, { action: "status_change", actorRole: "hospital" }, previousValues);
}

const NEXT_TREATMENT_STATUS: Record<TreatmentStatus, readonly TreatmentStatus[]> = {
  not_started: ["started"],
  started: ["ongoing", "completed"],
  ongoing: ["completed"],
  completed: [],
};

export function updateTreatmentProgress(
  id: string,
  treatmentStatus: Exclude<TreatmentStatus, "not_started">,
  previousValues: DocumentData,
) {
  if (previousValues.status !== "confirmed" && previousValues.status !== "completed") {
    throw new Error("Confirm the booking before updating treatment progress.");
  }
  const currentStatus = getTreatmentStatus(previousValues as BookingDocument);
  if (!NEXT_TREATMENT_STATUS[currentStatus].includes(treatmentStatus)) {
    throw new Error("This treatment status change is not available.");
  }
  const changes: Record<string, unknown> = {
    treatmentStatus,
    updatedAt: firestoreTimestamp.server(),
    updatedBy: getAuditActorId(),
  };
  if (treatmentStatus === "started") changes.treatmentStartedAt = firestoreTimestamp.server();
  if (treatmentStatus === "completed") {
    changes.status = "completed";
    changes.completedAt = firestoreTimestamp.server();
    changes.treatmentCompletedAt = firestoreTimestamp.server();
  }
  return updateAuditedDocument(
    COLLECTIONS.bookings,
    id,
    changes,
    { action: "status_change", actorRole: "hospital" },
    previousValues,
  );
}
