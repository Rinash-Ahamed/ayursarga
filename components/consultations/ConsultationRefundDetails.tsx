import type { ConsultationRefundSummary } from "@/features/payments/refunds";
import { refundStatusLabel } from "@/features/payments/refunds";
import { formatCurrency } from "@/utils/currency";
import { formatDisplayDateTime } from "@/utils/date";
export function ConsultationRefundDetails({ summary }: { summary?: ConsultationRefundSummary }) {
  if (!summary) return null;
  return <dl className="consumer-booking-facts" aria-label="Refund details">
    <div><dt>Refund status</dt><dd>{refundStatusLabel(summary.status)}</dd></div>
    <div><dt>Refund amount</dt><dd>{formatCurrency(summary.amountPaise / 100)}</dd></div>
    <div><dt>Refund requested on</dt><dd>{formatDisplayDateTime(summary.requestedAt)} IST</dd></div>
    {summary.reference && <div><dt>Refund reference</dt><dd>{summary.reference}</dd></div>}
    {summary.bankReference && <div><dt>Bank reference</dt><dd>{summary.bankReference}</dd></div>}
  </dl>;
}
