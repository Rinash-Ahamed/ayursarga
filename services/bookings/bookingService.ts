"use client";

import { Timestamp, type DocumentData } from "firebase/firestore";
import type { BookingDocument, BookingStatus, TreatmentStatus } from "@/features/firestore/models";
import { getTreatmentStatus } from "@/features/bookings/treatmentStatus";
import { COLLECTIONS } from "@/constants/firestore";
import {
  firestoreTimestamp, runFilteredQuery, readDocument,
  type QueryPage, type DocumentRecord,
  type QueryPageOptions,
} from "@/services/firestore/firestoreService";
import { getAuditActorId, updateAuditedDocument } from "@/services/firestore/auditService";
import { authorizedApiRequest, authorizedMutationRequest } from "@/services/api/client";

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
  return authorizedApiRequest<{ ok: true; bookingId: string; bookingReference: string }>("/api/consumer/bookings", {
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
    signedOutMessage: "Sign in before booking an appointment.",
    failureMessage: "We could not place your booking. Please try again.",
  });
}

async function withBookingReferences<T extends QueryPage<BookingDocument>>(page: T): Promise<T> {
  const missing = page.documents.filter((booking) => !booking.bookingReference);
  if (!missing.length) return page;
  try {
    const chunks = Array.from({ length: Math.ceil(missing.length / 20) }, (_, index) => missing.slice(index * 20, index * 20 + 20));
    const responses = await Promise.all(chunks.map((chunk) => authorizedApiRequest<{ references: Record<string, string> }>("/api/bookings/references", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingIds: chunk.map((booking) => booking.id) }),
      signedOutMessage: "Sign in to view booking references.", failureMessage: "Booking references are temporarily unavailable.",
    })));
    const references = Object.assign({}, ...responses.map((response) => response.references)) as Record<string, string>;
    return { ...page, documents: page.documents.map((booking) => references[booking.id] ? { ...booking, bookingReference: references[booking.id] } : booking) };
  } catch {
    // Keep records accessible on migration/network failure. Never manufacture a
    // different reference in a portal; the shared label explicitly offers retry.
    return page;
  }
}

async function listBookings(filters: QueryPageOptions["filters"], options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  const page = await runFilteredQuery<BookingDocument>({
    collectionPath: COLLECTIONS.bookings, filters,
    sort: { field: "createdAt", direction: "desc" }, ...options,
  });
  return withBookingReferences(page);
}

export async function getPortalBooking(id: string) {
  if (!id || id.length > 160 || id.includes("/")) return null;
  const booking = await readDocument<BookingDocument>(COLLECTIONS.bookings, id);
  if (!booking) return null;
  const page = await withBookingReferences({ documents: [booking], cursor: null, hasMore: false });
  return page.documents[0] as DocumentRecord<BookingDocument>;
}

export const listConsumerBookings = (consumerId: string, options?: Pick<QueryPageOptions, "pageSize" | "cursor">) =>
  listBookings([{ field: "consumerId", operator: "==", value: consumerId }], options);

export async function getConsumerBookingDetails(ids: string[]) {
  const params = new URLSearchParams();
  for (const id of ids) params.append("id", id);
  return authorizedApiRequest<{ details: Record<string, Pick<BookingDocument, "hospitalName" | "hospitalLocation" | "serviceName">> }>(`/api/consumer/bookings?${params}`, {
    signedOutMessage: "Sign in to view your booking details.",
    failureMessage: "We could not load the centre and package names. Please refresh to try again.",
  });
}
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

export function updateHospitalBooking(id: string, input: HospitalBookingUpdate) {
  const localDate = input.confirmedDate
    ? `${input.confirmedDate.getFullYear()}-${String(input.confirmedDate.getMonth() + 1).padStart(2, "0")}-${String(input.confirmedDate.getDate()).padStart(2, "0")}`
    : null;
  return authorizedMutationRequest<BookingDocument>(`/api/hospital/bookings/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "booking",
      status: input.status,
      confirmedDate: localDate,
      confirmedTime: input.confirmedTime ?? null,
      hospitalNotes: input.hospitalNotes?.trim() || null,
    }),
    signedOutMessage: "Your Hospital session has expired. Sign in again to update the booking.",
    failureMessage: "We could not update the booking. Please try again.",
  });
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
  return authorizedMutationRequest<BookingDocument>(`/api/hospital/bookings/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "treatment", treatmentStatus }),
    signedOutMessage: "Your Hospital session has expired. Sign in again to update treatment progress.",
    failureMessage: "We could not update treatment progress. Please try again.",
  });
}
