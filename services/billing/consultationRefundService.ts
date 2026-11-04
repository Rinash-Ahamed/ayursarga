"use client";
import { authorizedApiRequest, decodeMutation } from "@/services/api/client";
import type { ConsultationBookingDocument } from "@/features/firestore/models";
import type { ConsultationRefundQuote } from "@/features/payments/refunds";
const endpoint = "/api/admin/consultation-refunds";
export async function getConsultationRefundQuote(bookingId: string, signal?: AbortSignal) {
  const response = await authorizedApiRequest<{ quote: ConsultationRefundQuote }>(`${endpoint}?${new URLSearchParams({ bookingId })}`, {
    signal, signedOutMessage: "Sign in again to check refunds.", failureMessage: "Refund details could not be checked. Please try again.",
  });
  return response.quote;
}
export async function submitConsultationRefund(input: { bookingId: string; action: "check" } | {
  bookingId: string; action: "refund"; requestId: string; expectedAuditId: string; reason: string; amountPaise: number; exceptionApproved: boolean;
}) {
  const result = await authorizedApiRequest<{ changes: Record<string, unknown> }>(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    signedOutMessage: "Sign in again to manage refunds.", failureMessage: "Refund could not be confirmed. Check its status before sending another request.",
  });
  if (!result.changes || typeof result.changes !== "object" || Array.isArray(result.changes)) throw new Error("Refresh to check the saved refund before trying again.");
  return decodeMutation(result.changes) as Partial<ConsultationBookingDocument>;
}
