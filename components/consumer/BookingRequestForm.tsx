"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createBookingRequest } from "@/services/bookings/bookingService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalToast } from "@/components/portal/PortalToast";
import { formatBystanders, type CentreSearchContext } from "@/features/hospitals/searchContext";

export function BookingRequestForm({ hospitalId, serviceId, searchContext }: { hospitalId: string; serviceId: string; searchContext: CentreSearchContext }) {
  const { firebaseUser, userProfile } = useAuth();
  const router = useRouter();
  const [preferredDate, setPreferredDate] = useState(searchContext.startDate);
  const [preferredEndDate, setPreferredEndDate] = useState(searchContext.endDate);
  const [bookingTermsAccepted, setBookingTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!firebaseUser || !userProfile?.phone) return;
    const data = new FormData(event.currentTarget);
    if (!bookingTermsAccepted) {
      setError("Read and accept the applicable terms and policies before sending your request.");
      return;
    }
    if (preferredEndDate && preferredEndDate < preferredDate) {
      setError("Choose an end date on or after the preferred start date.");
      return;
    }
    setBusy(true); setError(null);
    try {
      await createBookingRequest({ consumerId: firebaseUser.uid, consumerName: userProfile.name,
        consumerEmail: userProfile.email, consumerPhone: userProfile.phone, consumerAddress: userProfile.address,
        hospitalId, serviceId,
        preferredDate: new Date(`${preferredDate}T00:00:00`),
        preferredEndDate: preferredEndDate ? new Date(`${preferredEndDate}T00:00:00`) : null,
        preferredTime: String(data.get("time")), bystanderCount: Number(data.get("bystanders")),
        consumerNotes: String(data.get("notes") || ""), bookingTermsAccepted });
      router.replace("/app/bookings");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not send your appointment request. Check the details and try again."); }
    finally { setBusy(false); }
  }
  return <PortalShell role="consumer" title="Request an appointment" focused>
    <form className="portal-card portal-form" onSubmit={submit}>
      <label>Preferred start date<input name="date" type="date" min={new Date().toISOString().slice(0, 10)} value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} required /></label>
      <label>Preferred end date <small>Optional for consultation or single-day care</small><input name="endDate" type="date" min={preferredDate || new Date().toISOString().slice(0, 10)} value={preferredEndDate} onChange={(event) => setPreferredEndDate(event.target.value)} /></label>
      <label>Preferred time<input name="time" type="time" required /></label>
      <label>Accompanying bystanders<select name="bystanders" defaultValue={searchContext.bystanders}>{[0, 1, 2, 3, 4].map((count) => <option value={count} key={count}>{formatBystanders(count)}</option>)}</select></label>
      <label className="full">Notes (optional)<textarea name="notes" maxLength={500} /></label>
      <fieldset className="portal-consent portal-booking-consent full">
        <legend>Booking confirmation *</legend>
        <p>By proceeding, you acknowledge the applicable Customer Terms &amp; Conditions, Cancellation &amp; Refund Policy and Patient/Service Disclaimer &amp; Consent.</p>
        <label className="portal-consent-choice">
          <input name="bookingTerms" type="checkbox" required checked={bookingTermsAccepted} onChange={(event) => setBookingTermsAccepted(event.target.checked)} />
          <span>I have read and agree to the applicable terms and policies.</span>
        </label>
      </fieldset>
      <PortalToast message={error} tone="error" />
      <div className="portal-actions full"><button className="portal-button" disabled={busy}>{busy ? "Sending…" : "Send request"}</button></div>
    </form>
  </PortalShell>;
}
