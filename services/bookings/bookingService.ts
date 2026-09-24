"use client";

import { Timestamp, type DocumentData } from "firebase/firestore";
import type { BookingDocument, BookingStatus, TreatmentStatus } from "@/features/firestore/models";
import { getTreatmentStatus } from "@/features/bookings/treatmentStatus";
import { BOOKING_TERMS_VERSION } from "@/features/consumers/privacyConsent";
import { COLLECTIONS } from "@/constants/firestore";
import {
  firestoreTimestamp, runFilteredQuery,
  type QueryPageOptions,
} from "@/services/firestore/firestoreService";
import { createAuditedDocument, getAuditActorId, updateAuditedDocument } from "@/services/firestore/auditService";
import { getHospital } from "@/services/hospitals/hospitalService";
import { getService } from "@/services/hospitals/serviceService";
import { INCLUDED_BYSTANDERS, resolveHospitalBystanderPolicy } from "@/features/hospitals/bystanders";
import { isHospitalUnavailable } from "@/features/hospitals/availability";

type BookingRequestInput = {
  consumerId: string; hospitalId: string; serviceId: string; preferredDate: Date;
  preferredEndDate?: Date | null; preferredTime: string; bystanderCount: number;
  consumerNotes?: string | null; consumerName: string;
  consumerEmail: string; consumerPhone: string; consumerAddress: string | null;
  bookingTermsAccepted: boolean;
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
  const [hospital, service] = await Promise.all([getHospital(input.hospitalId), getService(input.serviceId)]);
  if (!hospital || hospital.status !== "active" || !hospital.isPublic) throw new Error("This hospital is not accepting appointment requests right now. Choose another hospital and try again.");
  if (!service || service.hospitalId !== hospital.id || service.status !== "active") throw new Error("This service is not accepting appointment requests right now. Return to the hospital page and choose another service.");
  if (isHospitalUnavailable(hospital, input.preferredDate, input.preferredEndDate)) {
    throw new Error("This hospital is unavailable for the selected dates. Choose another date and try again.");
  }
  const bystanderPolicy = resolveHospitalBystanderPolicy(hospital);
  const maximumBystanders = INCLUDED_BYSTANDERS + bystanderPolicy.maxAdditionalBystanders;
  if (!Number.isInteger(input.bystanderCount) || input.bystanderCount < INCLUDED_BYSTANDERS || input.bystanderCount > maximumBystanders) {
    throw new Error(bystanderPolicy.additionalBystandersAllowed
      ? `Choose between one and ${maximumBystanders} accompanying bystanders.`
      : "This hospital currently includes one bystander and does not allow additional bystanders.");
  }
  const servicePrice = service.price ?? 0;
  const additionalBystanderTotal = (input.bystanderCount - INCLUDED_BYSTANDERS) * bystanderPolicy.additionalBystanderCharge;
  return createAuditedDocument(COLLECTIONS.bookings, {
    consumerId: input.consumerId,
    consumerName: input.consumerName.trim(), consumerEmail: input.consumerEmail.trim().toLowerCase(),
    consumerPhone: input.consumerPhone.trim(), consumerAddress: input.consumerAddress?.trim() || null,
    hospitalId: hospital.id, serviceId: service.id,
    preferredDate: Timestamp.fromDate(input.preferredDate),
    preferredEndDate: input.preferredEndDate ? Timestamp.fromDate(input.preferredEndDate) : null,
    preferredTime: input.preferredTime, bystanderCount: input.bystanderCount,
    additionalBystanderCharge: bystanderPolicy.additionalBystanderCharge,
    additionalBystanderTotal,
    confirmedDate: null, confirmedTime: null, status: "requested", treatmentStatus: "not_started",
    servicePrice, commissionPercentage: hospital.commissionPercentage,
    estimatedCommission: servicePrice * hospital.commissionPercentage / 100,
    consumerNotes: input.consumerNotes?.trim() || null, hospitalNotes: null,
    createdAt: firestoreTimestamp.server(), createdBy: input.consumerId,
    updatedAt: firestoreTimestamp.server(), updatedBy: input.consumerId,
    archivedAt: null, archivedBy: null,
    confirmedAt: null, completedAt: null, treatmentStartedAt: null, treatmentCompletedAt: null,
    bookingTermsAcceptedAt: firestoreTimestamp.server(), bookingTermsVersion: BOOKING_TERMS_VERSION,
  }, { action: "create", actorRole: "consumer" });
}

function listBookings(filters: QueryPageOptions["filters"], options: Pick<QueryPageOptions, "pageSize" | "cursor"> = {}) {
  return runFilteredQuery<BookingDocument>({
    collectionPath: COLLECTIONS.bookings, filters,
    sort: { field: "createdAt", direction: "desc" }, ...options,
  });
}

export const listConsumerBookings = (consumerId: string, options?: Pick<QueryPageOptions, "pageSize" | "cursor">) =>
  listBookings([{ field: "consumerId", operator: "==", value: consumerId }], options);
export type HospitalBookingFilters = {
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

export type AdminBookingFilters = {
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
