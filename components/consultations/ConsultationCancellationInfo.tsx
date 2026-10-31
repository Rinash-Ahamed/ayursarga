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
    <div className="consultation-policy-table-wrap" role="region" aria-label="Consultation cancellation terms" tabIndex={0}>
      <table className="consultation-policy-table">
        <thead><tr><th scope="col">Cancellation period</th><th scope="col">Refund position</th><th scope="col">Important conditions</th></tr></thead>
        <tbody>
          <tr><th scope="row">At least {p.refundWindowHours} hours before the appointment reference time</th><td>{rate(p.refundValue)}</td><td>Refund-rate deadline: {formatDisplayDateTime(snapshot.refundDeadlineAt)} IST (inclusive).</td></tr>
          <tr><th scope="row">Later cancellations</th><td>{rate(p.lateRefundValue)}</td><td>{p.allowAfterCutoff ? "Late cancellation allowed until the appointment begins." : "No online cancellation after this cutoff."}</td></tr>
          <tr><th scope="row">Cancellation cutoff</th><td colSpan={2}>{formatDisplayDateTime(snapshot.cancellationCutoffAt)} IST. {p.allowAfterCutoff ? "Late cancellation allowed until the appointment begins." : "No online cancellation after this cutoff."}</td></tr>
          <tr><th scope="row">Appointment reference</th><td colSpan={2}>{snapshot.reference === "window_start" ? "The configured window start is the cancellation reference; it is not an exact appointment time." : "The confirmed appointment time is the cancellation reference."} All deadlines use India Standard Time.</td></tr>
          {p.conditions && <tr><th scope="row">Special conditions</th><td colSpan={2}>{p.conditions}</td></tr>}
          <tr><th scope="row">Cancellation instructions</th><td colSpan={2}>Use Cancel appointment below when available. Cancellation does not issue a refund automatically. Eligible refunds require processing through the original payment method; any refund already issued is deducted from the remaining amount. <Link href="/app/support">Contact Ayursarga</Link> for assistance or exceptional circumstances.</td></tr>
        </tbody>
      </table>
    </div>
    </details>
  </section>;
}
