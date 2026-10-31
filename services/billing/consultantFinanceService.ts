"use client";
import { authorizedApiRequest } from "@/services/api/client";
import type { ConsultantFinancialRecord } from "@/features/payments/consultationFinance";

export type ConsultantFinancePage = { documents: ConsultantFinancialRecord[]; cursor: string | null; hasMore: boolean; mode: "test" | "live";
  setupIssues?: { id: string; receipt: string; state: string; consultantName: string; totalPaise: number }[];
  summary: { count: number; grossPaise: number; commissionPaise: number; gatewayFeePaise: number; refundedPaise: number; pendingPayablePaise: number; paidPayablePaise: number; reviewCount: number; unknownFeeCount: number } };
const options = { signedOutMessage: "Sign in as Admin to view Finance.", failureMessage: "Finance could not be loaded. Please try again." };
export function listConsultantFinance(mode: string, cursor?: string | null) {
  const query = new URLSearchParams({ mode }); if (cursor) query.set("cursor", cursor);
  return authorizedApiRequest<ConsultantFinancePage>(`/api/admin/consultant-finance?${query}`, options);
}
export function recordConsultantSettlement(input: { id: string; expectedAuditId: string; status: string; reference: string; date: string; notes: string }) {
  return authorizedApiRequest<{ record: ConsultantFinancialRecord }>("/api/admin/consultant-finance", { ...options, method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), failureMessage: "The settlement update could not be confirmed. Refresh before retrying." });
}
