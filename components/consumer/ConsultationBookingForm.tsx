"use client";
import { ConsultantPhoto } from "@/components/consultants/ConsultantPhoto";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { consultationService } from "@/features/consultations/catalog";
import { isConsultantDateAvailable } from "@/features/consultations/availability";
import { validConsultationSchedule } from "@/features/consultations/schedule";
import type { AvailableConsultant } from "@/features/consultations/types";
import { formatAppointmentRange, generateConsultationSlots } from "@/features/consultations/slots";
import { useConsultationSlots } from "@/hooks/useConsultationSlots";
import { createConsultationBooking, listConsultationAvailability } from "@/services/consultations/consultationService";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalToast } from "@/components/portal/PortalToast";
import { DateInput } from "@/components/forms/DateInput";
import { formatCurrency } from "@/utils/currency";
import { isIsoDate, toDateInputValue, formatDisplayDate } from "@/utils/date";
import type { ConsultationCheckout } from "@/features/payments/checkout";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/config/routes";
import { getConsultationCancellationPolicy } from "@/services/consultations/cancellationPolicyService";
import { snapshotConsultationCancellation, type ConsultationCancellationPolicy } from "@/features/consultations/cancellationPolicy";
import { ConsultationCancellationInfo } from "@/components/consultations/ConsultationCancellationInfo";
import { usePortalClock } from "@/hooks/usePortalClock";
import { useConsultationPaymentReminder } from "@/hooks/useConsultationPaymentReminder";

const isFutureAppointmentDate = (value: string) => isIsoDate(value) && value >= toDateInputValue();

export function ConsultationBookingForm({ serviceId }: { serviceId: string }) {
  const { firebaseUser } = useAuth();
  const service = consultationService(serviceId);
  const router = useRouter();
  const [consultantId, setConsultantId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const loader = useCallback((cursor: number | null) => service && isFutureAppointmentDate(date)
    ? listConsultationAvailability(service.id, date, cursor) : Promise.resolve({ documents: [], cursor: null, hasMore: false }), [service, date]);
  const { items: loadedItems, error: loadError, errorNotification: loadNotification, isLoading, hasMore, loadMore, reload } = usePaginatedList<AvailableConsultant, number>(loader, "We could not check appointment availability. Please try again.");
  // A previous date's page may remain in the shared pagination state while the
  // new request runs. Never offer its times or consultant IDs for this date.
  const items = loadedItems.filter(item => item.availabilityDate === date && item.availabilityService === service?.id);
  const times = [...new Map(items.flatMap(item => item.availableSlots).map(value => [value.startTime, value])).values()].sort((a,b) => a.startTime.localeCompare(b.startTime));
  const matchingConsultants = items.filter(item => item.availableSlots.some(value => value.startTime === slot));
  const appointmentSlots = useConsultationSlots(consultantId, service?.id ?? "", date);
  const appointment = appointmentSlots.slots.find(value => value.startTime === slot && value.status === "available");
  const [consent, setConsent] = useState(false);
  const [cancellationPolicy, setCancellationPolicy] = useState<ConsultationCancellationPolicy | null>(null);
  const [policyFailed, setPolicyFailed] = useState(false);
  const clock = usePortalClock();
  const [policyRetry, setPolicyRetry] = useState(0);
  useEffect(() => {
    let active = true;
    getConsultationCancellationPolicy().then(result => { if (active) setCancellationPolicy(result.policy); }).catch(() => { if (active) setPolicyFailed(true); });
    return () => { active = false; };
  }, [policyRetry]);
  const [busy, setBusy] = useState(false);
  const pendingPayment = useConsultationPaymentReminder(firebaseUser?.uid);
  const [paymentDetails, setPaymentDetails] = useState<ConsultationCheckout | null>(null);
  const [error, setError, notification] = useRepeatableMessage();
  const submitting = useRef(false);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const consultant = matchingConsultants.find((item) => item.id === consultantId);
  const dateAllowed = (value: string) => Boolean(consultant && isConsultantDateAvailable(value, consultant)
    && service && generateConsultationSlots(value, service.id, consultant).length);
  async function checkPayment(resume = false) {
    if (!pendingPayment || submitting.current) return;
    submitting.current = true; setBusy(true); setError(null);
    try {
      const { consultationPaymentStatus, payForConsultation, clearConsultationPaymentReminder } = await import("@/services/payments/consultationCheckout");
      let result = (await consultationPaymentStatus(pendingPayment)).checkout;
      setPaymentDetails(result);
      if (resume && result.state === "ready") result = await payForConsultation(result);
      if (result.bookingId) {
        clearConsultationPaymentReminder();
        router.push(`/app/bookings/consultations?booking=${encodeURIComponent(result.bookingId)}`);
      } else setError(result.state === "paid_review" ? "Payment received; your appointment needs Ayursarga review. Contact support and do not pay again." : result.state === "reservation_expired" ? "Your appointment hold has expired. If money was debited, contact Ayursarga before paying again. Otherwise, choose another appointment time." : "Payment is not confirmed yet. Resume this payment or contact Ayursarga if money was debited.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "We could not check payment. Please contact support before paying again."); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !service || pendingPayment || !cancellationPolicy) return;
    const timing = appointment && consultant?.preferredSlotTimings[appointment.window];
    if (!consultant || !appointment || !timing || appointmentSlots.loading || appointmentSlots.error || loadError || !isIsoDate(date) || date < toDateInputValue() || !consent) {
      setError("Choose a consultant, date and preferred time window, and accept the booking terms."); return;
    }
    if (!dateAllowed(date) || !validConsultationSchedule(date, timing.startTime, timing.endTime)) {
      setError("Choose an available date and a time window that has not ended."); return;
    }
    const notes = String(new FormData(event.currentTarget).get("notes") ?? "").trim();
    const key = JSON.stringify([service.id, consultantId, date, slot, notes, consultant.consultantCharge, timing.startTime, timing.endTime, cancellationPolicy.version]);
    if (attempt.current?.key !== key) attempt.current = { key, id: globalThis.crypto.randomUUID() };
    submitting.current = true; setBusy(true); setError(null);
    try {
      const result = await createConsultationBooking({ consultantId, serviceId: service.id, preferredDate: date, preferredTimeSlot: appointment.window, appointmentStartTime: appointment.startTime,
        expectedSlotStartTime: timing.startTime, expectedSlotEndTime: timing.endTime,
        consumerNotes: notes, expectedCharge: consultant.consultantCharge, bookingTermsAccepted: consent, requestId: attempt.current.id, expectedCancellationPolicyVersion: cancellationPolicy.version });
      router.push(`/app/bookings/consultations?booking=${encodeURIComponent(result.bookingId)}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We could not book this consultation. Try again.");
      appointmentSlots.reload();
    } finally { submitting.current = false; setBusy(false); }
  }
  return <PortalShell role="consumer" title={service?.label ?? "Online consultation"}>
    <div className="portal-flow-page">
    {!service ? <><nav className="portal-actions portal-flow-navigation" aria-label="Consultation navigation"><Link className="portal-button secondary" href="/#wellness">Choose another service</Link><Link className="portal-button secondary" href="/app/bookings/consultations">My online consultations</Link></nav><p className="portal-form-error">Choose a valid service from Wellness Path.</p></> : <>
      <section className="portal-flow-intro" aria-label="Consultation guidance">
        <p>Choose your date and an available time, then select a consultant. Pay the full consultation fee securely through Razorpay. Your appointment is confirmed only after payment is verified. Online consultation is not an emergency service.</p>
        <nav className="portal-actions portal-flow-navigation" aria-label="Consultation navigation"><Link className="portal-button secondary" href="/#wellness">Choose another service</Link><Link className="portal-button secondary" href="/app/bookings/consultations">My online consultations</Link></nav>
      </section>
      {pendingPayment && <section className="portal-card" aria-label="Pending consultation payment">
        <h2>Check your previous payment</h2><p>Check your payment status before paying again. Closing the payment window does not always mean the payment failed.</p>
        {paymentDetails && <p>{paymentDetails.consultantName} · {paymentDetails.serviceName} · {formatDisplayDate(paymentDetails.date)} · {paymentDetails.timeWindow} · {formatCurrency(paymentDetails.totalPaise / 100)}</p>}
        {paymentDetails?.cancellationPolicy && <ConsultationCancellationInfo snapshot={paymentDetails.cancellationPolicy} status="confirmed" now={clock} />}
        {error && <p className="portal-form-error" role="alert">{error}</p>}
        <div className="portal-actions"><button type="button" className="portal-button secondary" disabled={busy} onClick={() => void checkPayment()}>Check payment status</button>{paymentDetails?.state === "reservation_expired" ? <button type="button" className="portal-button secondary" disabled={busy} onClick={async () => { const {clearConsultationPaymentReminder} = await import("@/services/payments/consultationCheckout"); clearConsultationPaymentReminder(); attempt.current=null; setPaymentDetails(null); setSlot(""); appointmentSlots.reload(); }}>Choose another appointment time</button> : <button type="button" className="portal-button" disabled={busy} onClick={() => void checkPayment(true)}>Resume payment</button>}<Link className="portal-button secondary" href="/app/support">Contact support</Link></div>
      </section>}
      <PortalToast message={error} notification={notification} tone="error" />
      <PortalToast message={loadError} notification={loadNotification} tone="error" />
      <form className="portal-form portal-card consumer-consultation-form" onSubmit={submit}>
        <label>Preferred appointment date *<DateInput value={date} min={toDateInputValue()} isDateAllowed={isFutureAppointmentDate} onChange={(event) => { setDate(event.target.value); setSlot(""); setConsultantId(""); setConsent(false); setError(null); }} required disabled={busy} /></label>
        <label>Preferred time *<select value={slot} onChange={(event) => { setSlot(event.target.value); setConsultantId(""); setConsent(false); setError(null); }} required disabled={busy || !date || !times.length || Boolean(loadError)}>
          <option value="">{date && isLoading && !items.length ? "Checking appointment times…" : "Select an appointment time"}</option>{times.map(value => <option key={value.startTime} value={value.startTime}>{formatAppointmentRange(value.startTime, value.endTime)}</option>)}
        </select></label>
        {!date && <p className="full portal-form-note">Choose a date to see available appointment times.</p>}
        {date && isLoading && !items.length && <p className="full portal-form-note" role="status">Checking available appointment times…</p>}
        {loadError && <div className="full portal-form-error" role="alert">{loadError}<button className="portal-button secondary" type="button" disabled={isLoading} onClick={() => void reload()}>Try again</button></div>}
        {date && !isLoading && !loadError && !times.length && <p className="full portal-form-note" role="status">{hasMore ? "No times are available among these consultants. Load more availability or choose another date." : "No appointment times are available on this date. Choose another date or contact Ayursarga for help."}</p>}
        {hasMore && <div className="portal-actions full"><button className="portal-button secondary" type="button" disabled={busy || isLoading} onClick={() => void loadMore()}>{isLoading ? "Loading availability…" : "Load more availability"}</button><p className="portal-form-note">More consultants may have additional times available.</p></div>}
        {date && <div className="portal-actions full"><button className="portal-button secondary" type="button" disabled={busy || isLoading} onClick={() => { setSlot(""); setConsultantId(""); setConsent(false); void reload(); }}>Refresh availability</button></div>}
        {slot && <fieldset className="full consultation-professionals" disabled={busy || Boolean(loadError)}>
          <legend>Choose your consultant *</legend>
          <div className="consultation-professional-grid">{matchingConsultants.map((item) => <label className="consultation-professional" key={item.id} data-selected={item.id === consultantId}>
            <input type="radio" name="consultant" value={item.id} checked={item.id === consultantId} required onChange={() => { setConsultantId(item.id); setConsent(false); }} />
            <span className="consultation-professional-info">
              <span className="consultation-professional-banner">
                <span className="consultation-professional-identity">
                  <strong className="consultation-professional-name">{item.name}</strong>
                  {item.designation && <span className="consultation-professional-role"><small>Designation</small><span>{item.designation}</span></span>}
                </span>
                <ConsultantPhoto name={item.name} imageUrl={item.imageUrl} size={160} />
              </span>
              <span className="consultation-professional-footer">
                <span className="consultation-professional-credentials">
                  {item.qualification && item.qualification.trim().toLowerCase() !== item.designation.trim().toLowerCase() && <span className="consultation-professional-detail"><small className="sr-only">Qualification</small>{item.qualification}</span>}
                  <span className="consultation-professional-detail"><small className="sr-only">Experience</small>{item.yearsExperience} {item.yearsExperience === 1 ? "year" : "years"} experience</span>
                </span>
                <span className="consultation-professional-detail consultation-professional-fee"><small>Consultation fee</small><strong>{formatCurrency(item.consultantCharge)}</strong></span>
              </span>
            </span>
          </label>)}</div>
        </fieldset>}
        {slot && !matchingConsultants.length && !isLoading && !loadError && <p className="full portal-form-note" role="status">No consultants currently loaded are available at this time. Choose another time{hasMore ? " or load more availability" : ""}.</p>}
        {consultant && appointmentSlots.loading && <p className="full portal-form-note" role="status">Checking your consultant’s appointment time…</p>}
        {appointmentSlots.error && <div className="full portal-form-error" role="alert">{appointmentSlots.error}<button className="portal-button secondary" type="button" onClick={appointmentSlots.reload}>Check times again</button></div>}
        {consultant && !appointment && !appointmentSlots.loading && !appointmentSlots.error && <p className="full portal-form-error" role="status">This consultant is no longer available at your selected time. Please choose another consultant or appointment time.</p>}
        <p className="full portal-form-note">Your time is reserved for 10 minutes after you start payment. Availability is checked again before confirmation.</p>
        <label className="full">Notes (optional)<textarea name="notes" maxLength={500} disabled={busy} /></label>
        {cancellationPolicy && appointment && isIsoDate(date) && <div className="full"><ConsultationCancellationInfo snapshot={snapshotConsultationCancellation(cancellationPolicy, date, appointment.startTime)} status="confirmed" now={clock} /></div>}
        <fieldset className="portal-consent full" disabled={busy}><legend>Booking confirmation *</legend>
          <p>Please review the <Link href={ROUTES.public.termsAndConditions} target="_blank">Customer Terms &amp; Conditions</Link>, <Link href={ROUTES.public.cancellationRefundPolicy} target="_blank">Cancellation &amp; Refund Policy</Link> and <Link href={ROUTES.public.patientServiceDisclaimer} target="_blank">Patient/Service Disclaimer &amp; Consent</Link>.</p>
          <label className="portal-consent-choice"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I have read and agree to the applicable terms and policies.</span></label>
        </fieldset>
        {error && <p className="portal-form-error full" role="alert">{error}</p>}
        {error && <div className="portal-actions full"><button type="button" className="portal-button secondary" disabled={busy || isLoading} onClick={() => { setConsultantId(""); setSlot(""); setConsent(false); void reload(); }}>Refresh consultants</button><button type="button" className="portal-button secondary" disabled={busy || Boolean(pendingPayment)} onClick={() => { setConsent(false); setError(null); setCancellationPolicy(null); setPolicyFailed(false); setPolicyRetry(value => value + 1); }}>Reload cancellation terms</button></div>}
        {!cancellationPolicy && <p className="full" role="status">{policyFailed ? "Cancellation terms could not be loaded. Please retry before paying." : "Loading agreed cancellation terms…"}{policyFailed && <button type="button" className="portal-button secondary" onClick={() => { setPolicyFailed(false); setPolicyRetry(value => value + 1); }}>Reload cancellation terms</button>}</p>}
        <div className="portal-actions full"><button className="portal-button" disabled={busy || Boolean(pendingPayment) || !cancellationPolicy || !consent || !consultant || !date || !dateAllowed(date) || !appointment || appointmentSlots.loading || Boolean(appointmentSlots.error) || Boolean(loadError)}>{busy ? "Processing payment..." : consultant ? `Pay ${formatCurrency(consultant.consultantCharge)} & book appointment` : "Pay & book appointment"}</button></div>
      </form>
    </>}
    </div>
  </PortalShell>;
}
