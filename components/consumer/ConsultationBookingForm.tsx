"use client";
import { ConsultantPhoto } from "@/components/consultants/ConsultantPhoto";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { consultationService } from "@/features/consultations/catalog";
import { consultantAvailabilitySummary, isConsultantDateAvailable } from "@/features/consultations/availability";
import { validConsultationSchedule } from "@/features/consultations/schedule";
import type { PublicConsultant } from "@/features/consultations/types";
import { formatConsultantTimeSlot, type ConsultantTimeSlot } from "@/features/consultants/validation";
import { createConsultationBooking, listPublicConsultants } from "@/services/consultations/consultationService";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalPagination } from "@/components/portal/PortalPagination";
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

export function ConsultationBookingForm({ serviceId }: { serviceId: string }) {
  const { firebaseUser } = useAuth();
  const service = consultationService(serviceId);
  const router = useRouter();
  const loader = useCallback((cursor: number | null) => service
    ? listPublicConsultants(service.id, cursor) : Promise.resolve({ documents: [], cursor: null, hasMore: false }), [service]);
  const { items, error: loadError, errorNotification: loadNotification, isLoading, hasMore, loadMore, reload } = usePaginatedList<PublicConsultant, number>(loader, "We could not load consultants. Please try again.");
  const [consultantId, setConsultantId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<ConsultantTimeSlot | "">("");
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
  const lastVisibilityRefresh = useRef(0);
  const consultant = items.find((item) => item.id === consultantId);
  const dateAllowed = useCallback((value: string) => Boolean(consultant && isConsultantDateAvailable(value, consultant)
    && consultant.preferredTimeSlots.some((key) => {
      const window = consultant.preferredSlotTimings[key];
      return window && validConsultationSchedule(value, window.startTime, window.endTime);
    })), [consultant]);
  const hasConsultants = items.length > 0;
  const availableDates = consultant?.availableDates?.filter(dateAllowed).toSorted() ?? [];
  const noAvailableDates = Boolean(consultant?.availableDates?.length && !availableDates.length);
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
      } else setError(result.state === "paid_review" ? "Payment received; your appointment needs Ayursarga review. Contact support and do not pay again." : "Payment is not confirmed yet. Resume this payment or contact Ayursarga if money was debited.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "We could not check payment. Please contact support before paying again."); }
    finally { submitting.current = false; setBusy(false); }
  }
  useEffect(() => {
    const refreshVisibleConsultants = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastVisibilityRefresh.current < 1_500) return;
      lastVisibilityRefresh.current = Date.now();
      void reload();
    };
    lastVisibilityRefresh.current = Date.now();
    window.addEventListener("focus", refreshVisibleConsultants);
    window.addEventListener("pageshow", refreshVisibleConsultants);
    document.addEventListener("visibilitychange", refreshVisibleConsultants);
    return () => {
      window.removeEventListener("focus", refreshVisibleConsultants);
      window.removeEventListener("pageshow", refreshVisibleConsultants);
      document.removeEventListener("visibilitychange", refreshVisibleConsultants);
    };
  }, [reload]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !service || pendingPayment || !cancellationPolicy) return;
    const timing = slot && consultant?.preferredSlotTimings[slot];
    if (!consultant || !slot || !timing || !consultant.preferredTimeSlots.includes(slot) || !isIsoDate(date) || date < toDateInputValue() || !consent) {
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
      const result = await createConsultationBooking({ consultantId, serviceId: service.id, preferredDate: date, preferredTimeSlot: slot,
        expectedSlotStartTime: timing.startTime, expectedSlotEndTime: timing.endTime,
        consumerNotes: notes, expectedCharge: consultant.consultantCharge, bookingTermsAccepted: consent, requestId: attempt.current.id, expectedCancellationPolicyVersion: cancellationPolicy.version });
      router.push(`/app/bookings/consultations?booking=${encodeURIComponent(result.bookingId)}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We could not book this consultation. Try again.");
    } finally { submitting.current = false; setBusy(false); }
  }
  return <PortalShell role="consumer" title={service?.label ?? "Online consultation"}>
    <div className="portal-flow-page">
    {!service ? <><nav className="portal-actions portal-flow-navigation" aria-label="Consultation navigation"><Link className="portal-button secondary" href="/#wellness">Choose another service</Link><Link className="portal-button secondary" href="/app/bookings/consultations">My online consultations</Link></nav><p className="portal-form-error">Choose a valid service from Wellness Path.</p></> : <>
      <section className="portal-flow-intro" aria-label="Consultation guidance">
        <p>Choose an available professional, date and time window. Pay the full consultation fee securely through Razorpay. Your appointment is confirmed only after payment is verified. Online consultation is not an emergency service.</p>
        <nav className="portal-actions portal-flow-navigation" aria-label="Consultation navigation"><Link className="portal-button secondary" href="/#wellness">Choose another service</Link><Link className="portal-button secondary" href="/app/bookings/consultations">My online consultations</Link></nav>
      </section>
      {pendingPayment && <section className="portal-card" aria-label="Pending consultation payment">
        <h2>Check your previous payment</h2><p>Resume or check the existing payment before starting another. A closed checkout does not confirm payment failure.</p>
        {paymentDetails && <p>{paymentDetails.consultantName} · {paymentDetails.serviceName} · {formatDisplayDate(paymentDetails.date)} · {paymentDetails.timeWindow} · {formatCurrency(paymentDetails.totalPaise / 100)}</p>}
        {paymentDetails?.cancellationPolicy && <ConsultationCancellationInfo snapshot={paymentDetails.cancellationPolicy} status="confirmed" now={clock} />}
        {error && <p className="portal-form-error" role="alert">{error}</p>}
        <div className="portal-actions"><button type="button" className="portal-button secondary" disabled={busy} onClick={() => void checkPayment()}>Check payment status</button><button type="button" className="portal-button" disabled={busy} onClick={() => void checkPayment(true)}>Resume payment</button><Link className="portal-button secondary" href="/app/support">Contact support</Link></div>
      </section>}
      <PortalToast message={error} notification={notification} tone="error" />
      <PortalToast message={loadError} notification={loadNotification} tone="error" />
      {loadError && !hasConsultants && <section className="portal-empty-state portal-state-card" role="alert"><span className="portal-empty-state-leaf" aria-hidden="true" /><h3>Consultants could not be loaded</h3><p>{loadError}</p><button className="portal-button secondary" type="button" onClick={() => void reload()} disabled={isLoading}>Try again</button></section>}
      {isLoading && !hasConsultants && <section className="portal-empty-state portal-state-card" role="status"><span className="portal-empty-state-leaf" aria-hidden="true" /><h3>Finding available consultants</h3><p>Please wait while we check the current professionals for this service.</p></section>}
      {!isLoading && !loadError && !hasConsultants && <section className="portal-empty-state portal-state-card" role="status"><span className="portal-empty-state-leaf" aria-hidden="true" /><h3>Consultants are not available yet</h3><p>No professionals are currently assigned to {service.label.toLowerCase()}. Please check again or <Link href="/contact">contact Ayursarga</Link> for assistance.</p><button className="portal-button secondary" type="button" onClick={() => void reload()} disabled={isLoading}>Check availability again</button></section>}
      {hasConsultants && <form className="portal-form portal-card consumer-consultation-form" onSubmit={submit}>
        <fieldset className="full consultation-professionals" disabled={busy}>
          <legend>Choose your consultant *</legend>
          <div className="consultation-professional-grid">{items.map((item) => <label className="consultation-professional" key={item.id} data-selected={item.id === consultantId}>
            <input type="radio" name="consultant" value={item.id} checked={item.id === consultantId} required onChange={() => { setConsultantId(item.id); setDate(""); setSlot(""); }} />
            <span className="consultation-professional-info">
              <ConsultantPhoto name={item.name} imageUrl={item.imageUrl} />
              <strong className="consultation-professional-name">{item.name}</strong>
              {item.designation && item.designation.trim().toLowerCase() !== item.qualification.trim().toLowerCase() && <span className="consultation-professional-role">{item.designation}</span>}
              {item.qualification && <span className="consultation-professional-detail"><small>Qualification</small>{item.qualification}</span>}
              <span className="consultation-professional-detail"><small>Experience</small>{item.yearsExperience} {item.yearsExperience === 1 ? "year" : "years"}</span>
              <span className="consultation-professional-detail consultation-professional-fee"><small>Consultation fee</small><strong>{formatCurrency(item.consultantCharge)}</strong></span>
            </span>
          </label>)}</div>
          <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
        </fieldset>
        {consultant && <p className="full portal-form-note">Available days/dates: {consultantAvailabilitySummary(consultant)}. Dates must match all configured restrictions.</p>}
        {noAvailableDates && <p className="full portal-form-error" role="status">This consultant has no future available dates matching their configured weekdays. Choose another professional or contact Ayursarga.</p>}
        <label>Preferred appointment date *<DateInput value={date} min={availableDates[0] ?? toDateInputValue()} max={availableDates.at(-1)} isDateAllowed={dateAllowed} onChange={(event) => { setDate(event.target.value); setSlot(""); }} required disabled={busy || !consultant || noAvailableDates} /></label>
        <label>Preferred time *<select value={slot} onChange={(event) => setSlot(event.target.value as ConsultantTimeSlot)} required disabled={busy || !consultant}>
          <option value="">Select a preferred time</option>{consultant?.preferredTimeSlots.map((value) => {
            const window = consultant.preferredSlotTimings[value];
            return <option key={value} value={value} disabled={!date || !dateAllowed(date) || !window || !validConsultationSchedule(date, window.startTime, window.endTime)}>{formatConsultantTimeSlot(value, consultant.preferredSlotTimings)}</option>;
          })}
        </select></label>
        <label className="full">Notes (optional)<textarea name="notes" maxLength={500} disabled={busy} /></label>
        {cancellationPolicy && consultant && slot && isIsoDate(date) && consultant.preferredSlotTimings[slot] && <div className="full"><ConsultationCancellationInfo snapshot={snapshotConsultationCancellation(cancellationPolicy, date, consultant.preferredSlotTimings[slot]!.startTime)} status="confirmed" now={clock} /></div>}
        <fieldset className="portal-consent full" disabled={busy}><legend>Booking confirmation *</legend>
          <p>Please review the <Link href={ROUTES.public.termsAndConditions} target="_blank">Customer Terms &amp; Conditions</Link>, <Link href={ROUTES.public.cancellationRefundPolicy} target="_blank">Cancellation &amp; Refund Policy</Link> and <Link href={ROUTES.public.patientServiceDisclaimer} target="_blank">Patient/Service Disclaimer &amp; Consent</Link>.</p>
          <label className="portal-consent-choice"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I have read and agree to the applicable terms and policies.</span></label>
        </fieldset>
        {error && <p className="portal-form-error full" role="alert">{error}</p>}
        {error && <div className="portal-actions full"><button type="button" className="portal-button secondary" disabled={busy || isLoading} onClick={() => { setConsultantId(""); setSlot(""); setConsent(false); void reload(); }}>Refresh consultants</button><button type="button" className="portal-button secondary" disabled={busy || Boolean(pendingPayment)} onClick={() => { setConsent(false); setError(null); setCancellationPolicy(null); setPolicyFailed(false); setPolicyRetry(value => value + 1); }}>Reload cancellation terms</button></div>}
        {!cancellationPolicy && <p className="full" role="status">{policyFailed ? "Cancellation terms could not be loaded. Please retry before paying." : "Loading agreed cancellation terms…"}{policyFailed && <button type="button" className="portal-button secondary" onClick={() => { setPolicyFailed(false); setPolicyRetry(value => value + 1); }}>Reload cancellation terms</button>}</p>}
        <div className="portal-actions full"><button className="portal-button" disabled={busy || Boolean(pendingPayment) || !cancellationPolicy || !consent || !consultant || !date || !dateAllowed(date) || !slot}>{busy ? "Processing payment..." : consultant ? `Pay ${formatCurrency(consultant.consultantCharge)} & book appointment` : "Pay & book appointment"}</button></div>
      </form>}
    </>}
    </div>
  </PortalShell>;
}
