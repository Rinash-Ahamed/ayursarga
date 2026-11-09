"use client";
import { useRef, useState } from "react";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { BookingChangeReasonField } from "@/components/bookings/BookingChangeReasonField";
import { cancellationReason } from "@/features/bookings/cancellation";
import type { BookingDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { cancelHospitalBooking } from "@/services/bookings/bookingService";

export function HospitalCancellationDialog({ booking, onClose, onSaved }: {
  booking: DocumentRecord<Pick<BookingDocument, "lastAuditId">>; onClose: () => void; onSaved: (changes: Partial<BookingDocument>) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  async function confirm() {
    if (submitting.current) return;
    if (!cancellationReason(reason)) { setError("Enter a cancellation reason using 3 to 500 characters."); return; }
    submitting.current = true; setBusy(true); setError(null);
    try { const result = await cancelHospitalBooking(booking.id, reason.trim(), booking.lastAuditId); onSaved(result); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Cancellation could not be confirmed. Refresh the booking before trying again."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <PortalDialog open title="Cancel this hospital booking?" message="Tell us why you are cancelling. Cancellation does not confirm a refund." tone="danger"
    busy={busy} confirmDisabled={!cancellationReason(reason)} confirmLabel="Cancel booking" cancelLabel="Keep booking"
    onCancel={() => { if (!submitting.current) onClose(); }} onConfirm={() => void confirm()}>
    <div className="portal-form"><BookingChangeReasonField action="cancellation" value={reason} onChange={setReason} disabled={busy} />
      {error && <p className="full portal-form-error" role="alert">{error}</p>}
    </div>
  </PortalDialog>;
}
