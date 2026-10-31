"use client";
import { authorizedApiRequest } from "@/services/api/client";
import type { ConsultationCancellationPolicy } from "@/features/consultations/cancellationPolicy";

export function getConsultationCancellationPolicy(admin = false) {
  return authorizedApiRequest<{ policy: ConsultationCancellationPolicy }>(`/api/${admin ? "admin" : "consumer"}/consultation-cancellation-policy`, {
    signedOutMessage: "Sign in to view cancellation terms.", failureMessage: "Cancellation terms could not be loaded. Please try again.",
  });
}
export function saveConsultationCancellationPolicy(policy: ConsultationCancellationPolicy, expectedVersion: string) {
  return authorizedApiRequest<{ policy: ConsultationCancellationPolicy }>("/api/admin/consultation-cancellation-policy", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ policy, expectedVersion }),
    signedOutMessage: "Sign in as Admin to change cancellation terms.", failureMessage: "Policy update could not be confirmed. Reload before trying again.",
  });
}
