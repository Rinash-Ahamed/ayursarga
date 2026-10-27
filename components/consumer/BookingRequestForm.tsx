"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { createBookingRequest } from "@/services/bookings/bookingService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalToast } from "@/components/portal/PortalToast";
import { formatBystanders, type CentreSearchContext } from "@/features/hospitals/searchContext";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { getPublicHospital, getPublicHospitalService, type PublicHospitalDocument, type PublicServiceDocument } from "@/services/hospitals/publicHospitalService";
import { packageTitle, packageProcedureEntries } from "@/features/hospitals/packages";
import { INCLUDED_BYSTANDERS, resolveHospitalBystanderPolicy } from "@/features/hospitals/bystanders";
import { formatCurrency } from "@/utils/currency";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { focusFirstInvalidField } from "@/utils/formFocus";
import { isHospitalSoldOut } from "@/features/hospitals/availability";
import { DateInput } from "@/components/forms/DateInput";
import { toDateInputValue, parseDateInputValue } from "@/utils/date";

type BookingFieldErrors = Partial<Record<"preferredDate" | "bookingTerms", string>>;

export function BookingRequestForm({ hospitalId, serviceId, searchContext }: { hospitalId: string; serviceId: string; searchContext: CentreSearchContext }) {
  const { firebaseUser, userProfile } = useAuth();
  const router = useRouter();
  const [preferredDate, setPreferredDate] = useState(searchContext.startDate);
  const [bookingTermsAccepted, setBookingTermsAccepted] = useState(false);
  const selectionKey = `${hospitalId}:${serviceId}`;
  const [selection, setSelection] = useState<{ key: string; hospital: DocumentRecord<PublicHospitalDocument> | null; service: DocumentRecord<PublicServiceDocument> | null } | null>(null);
  const hospitalLoading = selection?.key !== selectionKey;
  const hospital = !hospitalLoading ? selection.hospital : null;
  const service = !hospitalLoading ? selection.service : null;
  const [bystanderCount, setBystanderCount] = useState(INCLUDED_BYSTANDERS);
  const [busy, setBusy] = useState(false); const [error, setError, errorNotification] = useRepeatableMessage();
  const [fieldErrors, setFieldErrors] = useState<BookingFieldErrors>({});
  const requestId = useRef<string>(globalThis.crypto.randomUUID());

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void Promise.all([getPublicHospital(hospitalId), getPublicHospitalService(hospitalId, serviceId, controller.signal)]).then(([record, selected]) => {
      if (!active) return;
      setSelection({ key: selectionKey, hospital: record, service: selected });
      if (!record || !selected) setError("This centre or package is no longer available. Return to the centre page to choose another package.");
      else setError(null);
    }).catch(() => {
      if (active) {
        setSelection({ key: selectionKey, hospital: null, service: null });
        setError("We could not load your centre and package details. Return to the centre page and try again.");
      }
    });
    return () => { active = false; controller.abort(); };
  }, [hospitalId, serviceId, selectionKey, setError]);

  const bystanderPolicy = resolveHospitalBystanderPolicy(hospital ?? {});
  const maximumBystanders = INCLUDED_BYSTANDERS + bystanderPolicy.maxAdditionalBystanders;
  const additionalBystanderTotal = (bystanderCount - INCLUDED_BYSTANDERS) * bystanderPolicy.additionalBystanderCharge;
  const procedures = service ? packageProcedureEntries(service) : [];
  const soldOut = Boolean(hospital && isHospitalSoldOut(hospital, preferredDate));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !firebaseUser || !userProfile?.phone) return;
    const form = event.currentTarget;
    setFieldErrors({});
    if (hospitalLoading || !hospital || !service) {
      setError("Wait for your centre and package details to finish loading, then try again.");
      return;
    }
    const data = new FormData(form);
    if (soldOut) {
      setFieldErrors({ preferredDate: "Sold Out for these dates. Choose another care date." });
      setError("This centre is sold out for these dates. Choose another care date before booking.");
      focusFirstInvalidField(form);
      return;
    }
    if (!preferredDate) {
      setFieldErrors({ preferredDate: "Choose a preferred start date." });
      setError("Choose a preferred start date before sending your request.");
      focusFirstInvalidField(form);
      return;
    }
    if (!bookingTermsAccepted) {
      setFieldErrors({ bookingTerms: "Read and accept the applicable terms and policies." });
      setError("Read and accept the applicable terms and policies before sending your request.");
      focusFirstInvalidField(form);
      return;
    }
    setBusy(true); setError(null);
    try {
      const result = await createBookingRequest({ consumerId: firebaseUser.uid, consumerName: userProfile.name,
        consumerEmail: userProfile.email, consumerPhone: userProfile.phone, consumerAddress: userProfile.address,
        hospitalId, serviceId, expectedPackageVersion: service.packageVersion,
        preferredDate: parseDateInputValue(preferredDate)!,
        preferredEndDate: null,
        preferredTime: "Flexible", bystanderCount,
        consumerNotes: String(data.get("notes") || ""), bookingTermsAccepted, requestId: requestId.current });
      router.replace(`/app/bookings?booking=${encodeURIComponent(result.bookingId)}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not place your booking. Check the details and try again."); }
    finally { setBusy(false); }
  }
  return <PortalShell role="consumer" title="Book an appointment">
    <nav className="consumer-request-navigation" aria-label="Booking navigation"><Link href={`/centers/${encodeURIComponent(hospitalId)}`}>Back to centre</Link><Link href="/app/bookings">My bookings</Link></nav>
    <section className="portal-card consumer-request-summary" aria-label="Selected centre and package" aria-busy={hospitalLoading}>
      {hospitalLoading ? <p role="status">Loading your centre and package details…</p> : <>
        <div><span className="consumer-booking-reference">Your selected care</span><h2>{hospital?.name || "Centre unavailable"}</h2><p>{[hospital?.city, hospital?.district, hospital?.state].filter(Boolean).join(", ")}</p><h3>{service ? packageTitle(service) : "Package unavailable"}</h3>{service?.description && <p>{service.description}</p>}</div>
        {service && <div className="consumer-booking-cost"><span>Package amount</span><strong>{formatCurrency(service.price ?? 0)}</strong><small>Availability checked when you book</small></div>}
        {procedures.length > 0 && <details className="consumer-booking-notes"><summary>View included procedures</summary><ul className="consumer-package-procedures">{procedures.map((procedure) => <li key={procedure.id}><span>{procedure.label}</span>{procedure.days !== null && <strong>{procedure.days} {procedure.days === 1 ? "day" : "days"}</strong>}</li>)}</ul></details>}
      </>}
    </section>
    <form className="portal-card portal-form consumer-request-form" onSubmit={submit} noValidate>
      <div className="consumer-request-intro full"><h2>Your care preferences</h2><p>Choose your preferred start date or expected delivery date and share anything the centre should know. Your booking is confirmed once it is successfully placed.</p></div>
      {soldOut && <p className="portal-form-error full" role="status">Sold Out {preferredDate ? "for your selected care dates" : "today"}. Please choose another care date.</p>}
      <label>Preferred start date / Expected Delivery Date<DateInput name="date" min={toDateInputValue()} value={preferredDate} onChange={(event) => { setPreferredDate(event.target.value); setFieldErrors((current) => ({ ...current, preferredDate: undefined })); }} required aria-invalid={Boolean(fieldErrors.preferredDate)} />{fieldErrors.preferredDate && <span className="portal-field-error" role="alert">{fieldErrors.preferredDate}</span>}</label>
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
          <input name="bookingTerms" type="checkbox" required checked={bookingTermsAccepted} aria-invalid={Boolean(fieldErrors.bookingTerms)} onChange={(event) => { setBookingTermsAccepted(event.target.checked); setFieldErrors((current) => ({ ...current, bookingTerms: undefined })); }} />
          <span>I have read and agree to the applicable terms and policies.</span>
        </label>
        {fieldErrors.bookingTerms && <span className="portal-field-error" role="alert">{fieldErrors.bookingTerms}</span>}
      </fieldset>
      <PortalToast message={error} notification={errorNotification} tone="error" />
      {error && <p className="portal-form-error full">{error}</p>}
      <div className="portal-actions full"><button className="portal-button" disabled={busy || hospitalLoading || !hospital || !service || soldOut || !bookingTermsAccepted}>{busy ? "Booking…" : "Book Appointment"}</button></div>
    </form>
  </PortalShell>;
}
