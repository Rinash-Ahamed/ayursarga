"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createBookingRequest } from "@/services/bookings/bookingService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalToast } from "@/components/portal/PortalToast";
import { formatBystanders, type CentreSearchContext } from "@/features/hospitals/searchContext";
import type { HospitalDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { getHospital } from "@/services/hospitals/hospitalService";
import { INCLUDED_BYSTANDERS, resolveHospitalBystanderPolicy } from "@/features/hospitals/bystanders";
import { formatCurrency } from "@/utils/currency";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";

export function BookingRequestForm({ hospitalId, serviceId, searchContext }: { hospitalId: string; serviceId: string; searchContext: CentreSearchContext }) {
  const { firebaseUser, userProfile } = useAuth();
  const router = useRouter();
  const [preferredDate, setPreferredDate] = useState(searchContext.startDate);
  const [preferredEndDate, setPreferredEndDate] = useState(searchContext.endDate);
  const [bookingTermsAccepted, setBookingTermsAccepted] = useState(false);
  const [hospital, setHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [hospitalLoading, setHospitalLoading] = useState(true);
  const [bystanderCount, setBystanderCount] = useState(INCLUDED_BYSTANDERS);
  const [busy, setBusy] = useState(false); const [error, setError] = useRepeatableMessage();

  useEffect(() => {
    let active = true;
    void getHospital(hospitalId).then((record) => {
      if (active) setHospital(record);
    }).catch(() => {
      if (active) setError("We could not load this hospital's bystander policy. Return to the centre page and try again.");
    }).finally(() => {
      if (active) setHospitalLoading(false);
    });
    return () => { active = false; };
  }, [hospitalId, setError]);

  const bystanderPolicy = resolveHospitalBystanderPolicy(hospital ?? {});
  const maximumBystanders = INCLUDED_BYSTANDERS + bystanderPolicy.maxAdditionalBystanders;
  const additionalBystanderTotal = (bystanderCount - INCLUDED_BYSTANDERS) * bystanderPolicy.additionalBystanderCharge;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!firebaseUser || !userProfile?.phone) return;
    if (hospitalLoading || !hospital) {
      setError("Wait for the hospital's bystander policy to finish loading, then try again.");
      return;
    }
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
        preferredTime: "Flexible", bystanderCount,
        consumerNotes: String(data.get("notes") || ""), bookingTermsAccepted });
      router.replace("/app/bookings");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not send your appointment request. Check the details and try again."); }
    finally { setBusy(false); }
  }
  return <PortalShell role="consumer" title="Request an appointment" focused>
    <form className="portal-card portal-form" onSubmit={submit}>
      <label>Preferred start date<input name="date" type="date" min={new Date().toISOString().slice(0, 10)} value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} required /></label>
      <label>Preferred end date <small>Optional for consultation or single-day care</small><input name="endDate" type="date" min={preferredDate || new Date().toISOString().slice(0, 10)} value={preferredEndDate} onChange={(event) => setPreferredEndDate(event.target.value)} /></label>
      <label>Accompanying bystanders
        {bystanderPolicy.additionalBystandersAllowed
          ? <select name="bystanders" value={bystanderCount} onChange={(event) => setBystanderCount(Number(event.target.value))} disabled={hospitalLoading}>
            {Array.from({ length: maximumBystanders }, (_, index) => index + INCLUDED_BYSTANDERS).map((count) => {
              const charge = (count - INCLUDED_BYSTANDERS) * bystanderPolicy.additionalBystanderCharge;
              return <option value={count} key={count}>{formatBystanders(count)}{charge > 0 ? ` (+${formatCurrency(charge)})` : " (included)"}</option>;
            })}
          </select>
          : <input value="1 bystander included" readOnly aria-label="One accompanying bystander included" />}
        <small>{bystanderPolicy.additionalBystandersAllowed
          ? `One is included. Each additional bystander costs ${formatCurrency(bystanderPolicy.additionalBystanderCharge)}.`
          : "One bystander is included at no additional cost."}</small>
      </label>
      {additionalBystanderTotal > 0 && <div className="portal-booking-extra-charge"><span>Additional bystander charge</span><strong>{formatCurrency(additionalBystanderTotal)}</strong></div>}
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
