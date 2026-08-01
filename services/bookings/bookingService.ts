"use client";

import { Timestamp } from "firebase/firestore";
import type { BookingDocument, BookingStatus } from "@/features/firestore/models";
import { COLLECTIONS } from "@/constants/firestore";
import {
  createDocument, firestoreTimestamp, runFilteredQuery, updateDocument,
  type QueryPageOptions,
} from "@/services/firestore/firestoreService";
import { getHospital } from "@/services/hospitals/hospitalService";
import { getService } from "@/services/hospitals/serviceService";

export type BookingRequestInput = {
  consumerId: string; hospitalId: string; serviceId: string; preferredDate: Date;
  preferredTime: string; consumerNotes?: string | null;
};

export async function createBookingRequest(input: BookingRequestInput) {
  const [hospital, service] = await Promise.all([getHospital(input.hospitalId), getService(input.serviceId)]);
  if (!hospital || hospital.status !== "active" || !hospital.isPublic) throw new Error("This hospital is not available.");
  if (!service || service.hospitalId !== hospital.id || service.status !== "active") throw new Error("This service is not available.");
  return createDocument(COLLECTIONS.bookings, {
    consumerId: input.consumerId, hospitalId: hospital.id, serviceId: service.id,
    preferredDate: Timestamp.fromDate(input.preferredDate), preferredTime: input.preferredTime,
    confirmedDate: null, confirmedTime: null, status: "requested",
    servicePrice: service.price, commissionPercentage: hospital.commissionPercentage,
    estimatedCommission: service.price * hospital.commissionPercentage / 100,
    consumerNotes: input.consumerNotes?.trim() || null, hospitalNotes: null,
    createdAt: firestoreTimestamp.server(), updatedAt: firestoreTimestamp.server(),
    confirmedAt: null, completedAt: null,
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
export const listHospitalBookings = (hospitalId: string, options?: Pick<QueryPageOptions, "pageSize" | "cursor">) =>
  listBookings([{ field: "hospitalId", operator: "==", value: hospitalId }], options);
export const listAllBookings = (options?: Pick<QueryPageOptions, "pageSize" | "cursor">) => listBookings([], options);

export const cancelConsumerBooking = (id: string) => updateDocument(COLLECTIONS.bookings, id, {
  status: "cancelled", updatedAt: firestoreTimestamp.server(),
});

export type HospitalBookingUpdate = {
  status: Extract<BookingStatus, "confirmed" | "reschedule_requested" | "rejected" | "completed">;
  confirmedDate?: Date | null; confirmedTime?: string | null; hospitalNotes?: string | null;
};

export function updateHospitalBooking(id: string, input: HospitalBookingUpdate) {
  const data: Record<string, unknown> = {
    status: input.status, hospitalNotes: input.hospitalNotes?.trim() || null,
    updatedAt: firestoreTimestamp.server(),
  };
  if (input.confirmedDate !== undefined) data.confirmedDate = input.confirmedDate ? Timestamp.fromDate(input.confirmedDate) : null;
  if (input.confirmedTime !== undefined) data.confirmedTime = input.confirmedTime;
  if (input.status === "confirmed") data.confirmedAt = firestoreTimestamp.server();
  if (input.status === "completed") data.completedAt = firestoreTimestamp.server();
  return updateDocument(COLLECTIONS.bookings, id, data);
}
