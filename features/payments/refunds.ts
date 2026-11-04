export type ConsultationRefundSummary = {
  status: "checking" | "initiated" | "refunded" | "failed" | "unknown";
  amountPaise: number; reference: string | null; bankReference: string | null;
  requestedAt: string; updatedAt: string;
};
export type ConsultationRefundQuote = { bookingId: string; lastAuditId: string; maximumPaise: number;
  suggestedPaise: number; exceptionRequired: boolean; blocked: string | null };
export function refundStatusLabel(status: ConsultationRefundSummary["status"]) {
  return { checking: "Refund verification pending", initiated: "Refund initiated", refunded: "Refunded",
    failed: "Refund failed", unknown: "Refund verification pending" }[status];
}
