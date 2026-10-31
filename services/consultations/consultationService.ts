"use client";

import type { ConsultationServiceId } from "@/features/consultations/catalog";
import type { ConsultantPage, PublicConsultant } from "@/features/consultations/types";
import type { ConsultationBookingDocument } from "@/features/firestore/models";
import { authorizedApiRequest, decodeMutation } from "@/services/api/client";
import type { ConsultationEmailResult } from "@/features/consultations/email";
import { readDocument, runFilteredQuery, type QueryPageOptions } from "@/services/firestore/firestoreService";

export async function listPublicConsultants(service: ConsultationServiceId, cursor: number | null = null, signal?: AbortSignal): Promise<ConsultantPage> {
  const params = new URLSearchParams({ service });
  if (cursor !== null) params.set("cursor", String(cursor));
  const response = await fetch(`/api/public/consultants?${params}`, { signal, cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Consultant search is unavailable.");
  return result;
}

export async function getPublicConsultant(service: string, consultantId: string, signal?: AbortSignal): Promise<PublicConsultant | null> {
  const response = await fetch(`/api/public/consultants?${new URLSearchParams({ service, consultantId })}`, { signal, cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Consultant availability is unavailable.");
  return result.consultant;
}

export async function createConsultationBooking(input: {
  consultantId: string; serviceId: ConsultationServiceId; preferredDate: string;
  preferredTimeSlot: string; expectedSlotStartTime: string; expectedSlotEndTime: string;
  consumerNotes: string; expectedCharge: number; bookingTermsAccepted: boolean; requestId: string; expectedCancellationPolicyVersion: string;
}) {
  const { loadConsultationCheckout, preparePaidConsultation, payForConsultation } = await import("@/services/payments/consultationCheckout");
  await loadConsultationCheckout();
  const response = await preparePaidConsultation(input);
  const paid = await payForConsultation(response.checkout);
  if (!paid.bookingId) throw new Error("Payment has not been confirmed. Check status before paying again.");
  return { ok: true as const, bookingId: paid.bookingId, bookingReference: paid.bookingReference ?? "" };
}

export function listConsultationBookings(consumerId: string | null, cursor?: QueryPageOptions["cursor"]) {
  return runFilteredQuery<ConsultationBookingDocument>({ collectionPath: "consultationBookings", pageSize: 20, cursor,
    filters: consumerId ? [{ field: "consumerId", operator: "==", value: consumerId }] : [], sort: { field: "createdAt", direction: "desc" } });
}

export function getConsultationBooking(id: string) {
  return readDocument<ConsultationBookingDocument>("consultationBookings", id);
}

export async function updateConsultationBooking(id: string, input: { action: "reschedule" | "completed" | "cancelled"; requestId: string; expectedAuditId: string; confirmedDate?: string; confirmedTime?: string; adminNotes?: string }) {
  const result = await authorizedApiRequest<{ changes: Record<string, unknown>; email?: ConsultationEmailResult; consultantEmail?: ConsultationEmailResult }>(`/api/consultations/${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    signedOutMessage: "Sign in again to update this consultation.", failureMessage: "We could not update the consultation. Try again.",
  });
  if (!result.changes || typeof result.changes !== "object" || Array.isArray(result.changes)) throw new Error("The response was incomplete. Refresh to check the saved appointment.");
  return { changes: decodeMutation(result.changes) as Partial<ConsultationBookingDocument>, email: result.email, consultantEmail: result.consultantEmail };
}
