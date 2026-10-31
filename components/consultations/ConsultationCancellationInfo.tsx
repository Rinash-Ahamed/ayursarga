import Link from "next/link";
import { consultationCancellationEligibility, validCancellationSnapshot, type ConsultationCancellationSnapshot, type ConsultationPaymentTotals, type ConsultationCancellationOutcome } from "@/features/consultations/cancellationPolicy";
import { formatDisplayDateTime } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";

export function ConsultationCancellationInfo({ snapshot, status, totals, outcome, now }: {
  snapshot?: ConsultationCancellationSnapshot; status: string; totals?: ConsultationPaymentTotals; outcome?: ConsultationCancellationOutcome; now: number | null;
}) {
  if (!validCancellationSnapshot(snapshot)) return <section className="consultation-cancellation"><h3>Cancellation policy</h3><p>Your original booking terms apply. The agreed deadline and refund require support verification; current policies have not been applied to this booking.</p><Link href="/app/support">Contact Ayursarga with your booking reference</Link></section>;
  const p = snapshot.policy;
  const eligibility = now === null ? null : consultationCancellationEligibility(snapshot, status, totals ?? null, now);
  const rate = (value: number) => p.refundType === "percentage" ? `${value}% of the amount paid` : `${formatCurrency(value)}, capped to the amount paid`;
  const ended = !["requested", "confirmed"].includes(status);
  const remaining = outcome ? outcome.remainingRefundPaise : eligibility?.allowed ? eligibility.remainingRefundPaise : null;
  return <section className="consultation-cancellation" aria-label="Cancellation policy">
    <h3>Cancellation policy</h3>
    <dl className="consultation-cancellation-details">
      <div><dt>Cancellation eligibility</dt><dd>{status === "cancelled" ? "Cancelled" : ended ? "Online cancellation unavailable" : eligibility === null ? "Checking deadline…" : eligibility.allowed ? "Cancellation available" : "Cancellation window expired"}</dd></div>
      <div><dt>Last cancellation date and time</dt><dd>{formatDisplayDateTime(snapshot.lastCancellationAt)} IST{p.allowAfterCutoff ? " (before appointment begins)" : " (cutoff inclusive)"}</dd></div>
      <div><dt>Refund eligibility</dt><dd>{outcome ? remaining === null ? "Support review required" : `At cancellation: ${formatCurrency(remaining / 100)} remaining eligible refund` : eligibility?.allowed ? remaining === null ? "Payment verification required before calculating a refund" : `${formatCurrency(remaining / 100)} remaining eligible refund` : "No online refund quote available; contact support for exceptions"}</dd></div>
    </dl>
    <details><summary>Policy terms and refund deadlines</summary>
    <p>{rate(p.refundValue)} refundable when cancelled at least {p.refundWindowHours} hours before the appointment reference time. Later cancellations: {rate(p.lateRefundValue)}.</p>
    <p>Refund-rate deadline: {formatDisplayDateTime(snapshot.refundDeadlineAt)} IST (inclusive).</p>
    <p>Cancellation cutoff: {formatDisplayDateTime(snapshot.cancellationCutoffAt)} IST. {p.allowAfterCutoff ? "Late cancellation allowed until the appointment begins." : "No online cancellation after this cutoff."}</p>
    <p>{snapshot.reference === "window_start" ? "The configured window start is the cancellation reference; it is not an exact appointment time." : "The confirmed appointment time is the cancellation reference."} All deadlines use India Standard Time.</p>
    {p.conditions && <p>{p.conditions}</p>}
    </details>
    <p>Use Cancel appointment below when available. Cancellation does not issue a refund automatically. Eligible refunds require processing through the original payment method; any refund already issued is deducted from the remaining amount. <Link href="/app/support">Contact Ayursarga</Link> for assistance or exceptional circumstances.</p>
  </section>;
}
