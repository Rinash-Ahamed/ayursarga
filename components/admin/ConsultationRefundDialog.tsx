"use client";
import { useEffect, useRef, useState } from "react";
import type { ConsultationBookingDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import type { ConsultationRefundQuote } from "@/features/payments/refunds";
import { bookingChangeReason } from "@/features/bookings/changeReason";
import { BookingChangeReasonField } from "@/components/bookings/BookingChangeReasonField";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { getConsultationRefundQuote, submitConsultationRefund } from "@/services/billing/consultationRefundService";
import { updateConsultationBooking } from "@/services/consultations/consultationService";
import { formatCurrency } from "@/utils/currency";

function paise(value: string) {
  const parts = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!parts) return null;
  const amount = Number(parts[1]) * 100 + Number((parts[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
export function ConsultationRefundDialog({ booking, onClose, onSaved }: {
  booking: DocumentRecord<ConsultationBookingDocument>; onClose: () => void;
  onSaved: (changes: Partial<ConsultationBookingDocument>, message?: string) => void;
}) {
  const [quote, setQuote] = useState<ConsultationRefundQuote | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(""); const [amount, setAmount] = useState("");
  const [exception, setException] = useState(false); const [locked, setLocked] = useState(false);
  const submitting = useRef(false); const requestId = useRef(globalThis.crypto.randomUUID());
  const cancellation = useRef<{ saved: boolean; revision: string }>({ saved: booking.status === "cancelled", revision: booking.lastAuditId });
  useEffect(() => {
    const controller = new AbortController();
    getConsultationRefundQuote(booking.id, controller.signal).then(value => {
      if (!controller.signal.aborted) { setQuote(value); setAmount((value.suggestedPaise / 100).toFixed(2)); }
    }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not check refund details."); });
    return () => controller.abort();
  }, [booking.id]);
  const amountPaise = paise(amount);
  const needsException = Boolean(quote && (quote.exceptionRequired || amountPaise !== null && amountPaise > quote.suggestedPaise));
  async function confirm() {
    if (submitting.current || !quote || quote.blocked || !amountPaise || amountPaise > quote.maximumPaise || !bookingChangeReason(reason) || needsException && !exception) return;
    submitting.current = true; setBusy(true); setError(""); setLocked(true);
    try {
      if (!cancellation.current.saved) {
        const result = await updateConsultationBooking(booking.id, { action: "cancelled", requestId: requestId.current,
          expectedAuditId: cancellation.current.revision, cancellationReason: reason.trim() });
        cancellation.current = { saved: true, revision: result.changes.lastAuditId ?? cancellation.current.revision };
        onSaved(result.changes);
      }
      const changes = await submitConsultationRefund({ action: "refund", bookingId: booking.id, requestId: requestId.current,
        expectedAuditId: cancellation.current.revision, reason: reason.trim(), amountPaise, exceptionApproved: exception });
      const status = changes.refundSummary?.status;
      onSaved(changes, status === "refunded" ? "Appointment cancelled. Razorpay has processed the refund."
        : status === "initiated" ? "Appointment cancelled. Refund initiated; processing is not yet complete."
        : status === "failed" ? "Appointment cancelled, but the refund failed. Review the payment before trying again."
        : "Appointment cancelled. Refund needs verification; use Check refund status before another request.");
      onClose();
    } catch (failure) { setError(`${cancellation.current.saved ? "Cancellation is saved. " : ""}${failure instanceof Error ? failure.message : "Refund could not be confirmed."}`); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <PortalDialog open title={booking.status === "cancelled" ? "Refund this booking?" : "Cancel & refund?"}
    message="Review the amount and reason. The refund goes to the original payment method. Cancellation stays saved even if the refund needs follow-up."
    tone="danger" confirmLabel={locked ? "Check & continue" : "Confirm refund"} busy={busy}
    confirmDisabled={!quote || Boolean(quote.blocked) || !amountPaise || amountPaise > quote.maximumPaise || !bookingChangeReason(reason) || needsException && !exception}
    onCancel={() => { if (!submitting.current) onClose(); }} onConfirm={() => void confirm()}>
    <div className="portal-form consultation-dialog-fields">
      <p className="full"><strong>{booking.bookingReference}</strong> · {booking.serviceName} · {booking.consultantName}</p>
      {!quote && !error && <p className="full" role="status">Checking the payment and refund terms…</p>}
      {quote && <><label className="full">Refund amount (₹) *<input type="text" inputMode="decimal" value={amount} disabled={busy || locked || Boolean(quote.blocked)} onChange={event => setAmount(event.target.value)} /><small>Maximum remaining payment: {formatCurrency(quote.maximumPaise / 100)}. Gateway fees are not deducted from this customer refund.</small></label>
        <BookingChangeReasonField action="refund" value={reason} onChange={setReason} disabled={busy || locked} />
        {needsException && <label className="portal-consent full"><input type="checkbox" checked={exception} disabled={busy || locked} onChange={event => setException(event.target.checked)} />I approve this exceptional refund outside the booking’s usual refund allowance.</label>}
        {quote.blocked && <p className="portal-form-error full" role="alert">{quote.blocked}</p>}
      </>}
      {error && <p className="portal-form-error full" role="alert">{error}</p>}
      {busy && <p className="full" role="status">Saving cancellation and checking Razorpay. Please keep this window open.</p>}
    </div>
  </PortalDialog>;
}
