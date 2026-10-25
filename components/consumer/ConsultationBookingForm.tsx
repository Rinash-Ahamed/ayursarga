"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { consultationService } from "@/features/consultations/catalog";
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
import { isIsoDate, toDateInputValue } from "@/utils/date";
import { ROUTES } from "@/config/routes";

export function ConsultationBookingForm({ serviceId }: { serviceId: string }) {
  const service = consultationService(serviceId);
  const router = useRouter();
  const loader = useCallback((cursor: number | null) => service
    ? listPublicConsultants(service.id, cursor) : Promise.resolve({ documents: [], cursor: null, hasMore: false }), [service]);
  const { items, error: loadError, errorNotification: loadNotification, isLoading, hasMore, loadMore, reload } = usePaginatedList<PublicConsultant, number>(loader, "We could not load consultants. Please try again.");
  const [consultantId, setConsultantId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<ConsultantTimeSlot | "">("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError, notification] = useRepeatableMessage();
  const submitting = useRef(false);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const lastVisibilityRefresh = useRef(0);
  const consultant = items.find((item) => item.id === consultantId);
  const hasConsultants = items.length > 0;
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
    if (submitting.current || !service) return;
    const timing = slot && consultant?.preferredSlotTimings[slot];
    if (!consultant || !slot || !timing || !consultant.preferredTimeSlots.includes(slot) || !isIsoDate(date) || date < toDateInputValue() || !consent) {
      setError("Choose a consultant, date and preferred time window, and accept the booking terms."); return;
    }
    const notes = String(new FormData(event.currentTarget).get("notes") ?? "").trim();
    const key = JSON.stringify([service.id, consultantId, date, slot, notes, consultant.consultantCharge, timing.startTime, timing.endTime]);
    if (attempt.current?.key !== key) attempt.current = { key, id: globalThis.crypto.randomUUID() };
    submitting.current = true; setBusy(true); setError(null);
    try {
      const result = await createConsultationBooking({ consultantId, serviceId: service.id, preferredDate: date, preferredTimeSlot: slot,
        expectedSlotStartTime: timing.startTime, expectedSlotEndTime: timing.endTime,
        consumerNotes: notes, expectedCharge: consultant.consultantCharge, bookingTermsAccepted: consent, requestId: attempt.current.id });
      router.push(`/app/bookings/consultations?booking=${encodeURIComponent(result.bookingId)}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We could not book this consultation. Try again.");
    } finally { submitting.current = false; setBusy(false); }
  }
  return <PortalShell role="consumer" title={service?.label ?? "Online consultation"}>
    <div className="portal-flow-page">
    {!service ? <><nav className="portal-actions portal-flow-navigation" aria-label="Consultation navigation"><Link className="portal-button secondary" href="/#wellness">Choose another service</Link><Link className="portal-button secondary" href="/app/bookings/consultations">My online consultations</Link></nav><p className="portal-form-error">Choose a valid service from Wellness Path.</p></> : <>
      <section className="portal-flow-intro" aria-label="Consultation guidance">
        <p>Choose an available professional, date and time window. Your appointment is confirmed when booked. An exact time is shown if Ayursarga reschedules it. Online consultation is not an emergency service.</p>
        <nav className="portal-actions portal-flow-navigation" aria-label="Consultation navigation"><Link className="portal-button secondary" href="/#wellness">Choose another service</Link><Link className="portal-button secondary" href="/app/bookings/consultations">My online consultations</Link></nav>
      </section>
      <PortalToast message={loadError} notification={loadNotification} tone="error" />
      {loadError && !hasConsultants && <section className="portal-empty-state portal-state-card" role="alert"><span className="portal-empty-state-leaf" aria-hidden="true" /><h3>Consultants could not be loaded</h3><p>{loadError}</p><button className="portal-button secondary" type="button" onClick={() => void reload()} disabled={isLoading}>Try again</button></section>}
      {isLoading && !hasConsultants && <section className="portal-empty-state portal-state-card" role="status"><span className="portal-empty-state-leaf" aria-hidden="true" /><h3>Finding available consultants</h3><p>Please wait while we check the current professionals for this service.</p></section>}
      {!isLoading && !loadError && !hasConsultants && <section className="portal-empty-state portal-state-card" role="status"><span className="portal-empty-state-leaf" aria-hidden="true" /><h3>Consultants are not available yet</h3><p>No professionals are currently assigned to {service.label.toLowerCase()}. Please check again or <Link href="/contact">contact Ayursarga</Link> for assistance.</p><button className="portal-button secondary" type="button" onClick={() => void reload()} disabled={isLoading}>Check availability again</button></section>}
      {hasConsultants && <form className="portal-form portal-card consumer-consultation-form" onSubmit={submit}>
        <fieldset className="full consultation-professionals" disabled={busy}>
          <legend>Choose your consultant *</legend>
          <div className="consultation-professional-grid">{items.map((item) => <label className="consultation-professional" key={item.id} data-selected={item.id === consultantId}>
            <input type="radio" name="consultant" value={item.id} checked={item.id === consultantId} required onChange={() => { setConsultantId(item.id); setSlot(""); }} />
            <span><strong>{item.name}</strong><span>{item.designation || item.qualification}</span><span>{item.qualification} · {item.yearsExperience} years of experience</span><strong>{formatCurrency(item.consultantCharge)}</strong></span>
          </label>)}</div>
          <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
        </fieldset>
        <label>Preferred appointment date *<DateInput value={date} min={toDateInputValue()} onChange={(event) => setDate(event.target.value)} required disabled={busy} /></label>
        <label>Preferred time window *<select value={slot} onChange={(event) => setSlot(event.target.value as ConsultantTimeSlot)} required disabled={busy || !consultant}>
          <option value="">Select a preferred window</option>{consultant?.preferredTimeSlots.map((value) => <option key={value} value={value}>{formatConsultantTimeSlot(value, consultant.preferredSlotTimings)}</option>)}
        </select></label>
        <label className="full">Notes (optional)<textarea name="notes" maxLength={500} disabled={busy} /></label>
        <fieldset className="portal-consent full" disabled={busy}><legend>Booking confirmation *</legend>
          <p>Please review the <Link href={ROUTES.public.termsAndConditions} target="_blank">Customer Terms &amp; Conditions</Link>, <Link href={ROUTES.public.cancellationRefundPolicy} target="_blank">Cancellation &amp; Refund Policy</Link> and <Link href={ROUTES.public.patientServiceDisclaimer} target="_blank">Patient/Service Disclaimer &amp; Consent</Link>.</p>
          <label className="portal-consent-choice"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I have read and agree to the applicable terms and policies.</span></label>
        </fieldset>
        <PortalToast message={error} notification={notification} tone="error" />
        {error && <p className="portal-form-error full" role="alert">{error}</p>}
        {error && <div className="portal-actions full"><button type="button" className="portal-button secondary" disabled={busy || isLoading} onClick={() => { setConsultantId(""); setSlot(""); setConsent(false); void reload(); }}>Refresh consultants</button></div>}
        <div className="portal-actions full"><button className="portal-button" disabled={busy || !consent || !consultant || !date || !slot}>{busy ? "Booking appointment..." : "Book appointment"}</button></div>
      </form>}
    </>}
    </div>
  </PortalShell>;
}
