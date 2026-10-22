"use client";

import type { ConsultationServiceId } from "@/features/consultations/catalog";
import type { ConsultantPage } from "@/features/consultations/types";
import type { ConsultationBookingDocument } from "@/features/firestore/models";
import { authorizedApiRequest, authorizedMutationRequest } from "@/services/api/client";
import { readDocument, runFilteredQuery, type QueryPageOptions } from "@/services/firestore/firestoreService";

export async function listPublicConsultants(service: ConsultationServiceId, cursor: number | null = null, signal?: AbortSignal): Promise<ConsultantPage> {
  const params = new URLSearchParams({ service });
  if (cursor !== null) params.set("cursor", String(cursor));
  const response = await fetch(`/api/public/consultants?${params}`, { signal, cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Consultant search is unavailable.");
  return result;
}

export function createConsultationBooking(input: {
  consultantId: string; serviceId: ConsultationServiceId; preferredDate: string;
  preferredTimeSlot: string; expectedSlotStartTime: string; expectedSlotEndTime: string;
  consumerNotes: string; expectedCharge: number; bookingTermsAccepted: boolean; requestId: string;
}) {
  return authorizedApiRequest<{ ok: true; bookingId: string; bookingReference: string }>("/api/consumer/consultations", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    signedOutMessage: "Sign in before booking a consultation.", failureMessage: "We could not book your consultation. Try again.",
  });
}

export function listConsultationBookings(consumerId: string | null, cursor?: QueryPageOptions["cursor"]) {
  return runFilteredQuery<ConsultationBookingDocument>({ collectionPath: "consultationBookings", pageSize: 20, cursor,
    filters: consumerId ? [{ field: "consumerId", operator: "==", value: consumerId }] : [], sort: { field: "createdAt", direction: "desc" } });
}

export function getConsultationBooking(id: string) {
  return readDocument<ConsultationBookingDocument>("consultationBookings", id);
}

export function updateConsultationBooking(id: string, input: { status: string; confirmedDate?: string; confirmedTime?: string; adminNotes?: string }) {
  return authorizedMutationRequest<ConsultationBookingDocument>(`/api/consultations/${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    signedOutMessage: "Sign in again to update this consultation.", failureMessage: "We could not update the consultation. Try again.",
  });
}
