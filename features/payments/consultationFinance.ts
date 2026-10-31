/** Admin-only DTO. Never include in Consumer booking/public consultant responses. */
export type ConsultantFinancialRecord = {
  id: string; bookingId: string | null; bookingReference: string | null; consultantId: string; consultantName: string;
  consumerName: string; serviceName: string; paymentId: string; orderId: string; mode: string;
  grossPaise: number; commissionPaise: number; consultantPayablePaise: number; commissionPercentage: number;
  gatewayFeePaise: number | null; gatewayTaxPaise: number | null; refundedPaise: number;
  netSettlementPaise: number | null; netRevenuePaise: number | null;
  paymentStatus: string; settlementStatus: "pending" | "processed" | "paid"; settlementHold: boolean;
  reviewReason: string | null; settlementReference: string | null; updatedAt: string; createdAt: string;
  settlementDate?: string | null; settlementNotes?: string | null;
  lastAuditId: string;
};

export function consultationFinancialTotals(input: {
  grossPaise: number; commissionPaise: number; consultantPayablePaise: number;
  gatewayFeePaise: number | null; refundedPaise: number;
}) {
  const { grossPaise, commissionPaise, consultantPayablePaise, gatewayFeePaise, refundedPaise } = input;
  if (![grossPaise, commissionPaise, consultantPayablePaise, refundedPaise].every(value => Number.isSafeInteger(value) && value >= 0)
    || grossPaise !== commissionPaise + consultantPayablePaise || refundedPaise > grossPaise
    || (gatewayFeePaise !== null && (!Number.isSafeInteger(gatewayFeePaise) || gatewayFeePaise < 0))) throw new Error("Invalid financial amounts.");
  // Fee is Razorpay's reported total fee; tax is a component, never added twice.
  // Refunds require manual reconciliation: do not invent a commission reversal or payout split.
  return {
    netSettlementPaise: gatewayFeePaise === null ? null : grossPaise - refundedPaise - gatewayFeePaise,
    netRevenuePaise: gatewayFeePaise === null || refundedPaise > 0 ? null : commissionPaise - gatewayFeePaise,
  };
}
