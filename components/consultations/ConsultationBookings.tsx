"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ConsultationBookingDocument } from "@/features/firestore/models";
import type { DocumentRecord, QueryPageOptions } from "@/services/firestore/firestoreService";
import { emptyQueryPage } from "@/services/firestore/firestoreService";
import { getConsultationBooking, getPublicConsultant, listConsultationBookings, updateConsultationBooking } from "@/services/consultations/consultationService";
import type { PublicConsultant } from "@/features/consultations/types";
import { consultantAvailabilitySummary, isConsultantDateAvailable } from "@/features/consultations/availability";
import { useAuth } from "@/hooks/useAuth";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalResultCount } from "@/components/portal/PortalResultCount";
import { DateInput } from "@/components/forms/DateInput";
import { formatDisplayDate, toDateInputValue } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import { formatStatus } from "@/utils/text";
import { formatConsultantTimeSlot } from "@/features/consultants/validation";
import { validConsultationSchedule } from "@/features/consultations/schedule";
import { consultationEmailFeedback } from "@/features/consultations/email";
import { formatBookingPlacedAt } from "@/features/bookings/display";
import { AdminBookingNavigation } from "@/components/admin/AdminBookingNavigation";

type Appointment = DocumentRecord<ConsultationBookingDocument>;
type Action = { booking: Appointment; status: "reschedule" | "completed" | "cancelled"; requestId: string };
const CONSULTATION_STATUSES: readonly ConsultationBookingDocument["status"][] = ["requested", "confirmed", "completed", "cancelled", "rejected"];

export function ConsultationBookings({ role, bookingId }: { role: "admin" | "consumer"; bookingId?: string }) {
  const { firebaseUser } = useAuth();
  const home = role === "admin" ? "/admin/bookings" : "/app/bookings";
  const loader = useCallback(async (cursor: QueryPageOptions["cursor"]) => {
    if (!firebaseUser) return emptyQueryPage<ConsultationBookingDocument>();
    if (!bookingId) return listConsultationBookings(role === "consumer" ? firebaseUser.uid : null, cursor);
    const record = await getConsultationBooking(bookingId);
    return { documents: record && (role === "admin" || record.consumerId === firebaseUser.uid) ? [record] : [], cursor: null, hasMore: false };
  }, [firebaseUser, role, bookingId]);
  const { items, error: loadError, errorNotification, isLoading, hasMore, loadMore, patchItem, reload } = usePaginatedList<ConsultationBookingDocument>(loader, "We could not load online consultations. Please try again.");
  const [action, setAction] = useState<Action | null>(null);
  const [availability, setAvailability] = useState<PublicConsultant | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  useEffect(() => {
    if (action?.status !== "reschedule") return;
    const controller = new AbortController();
    getPublicConsultant(action.booking.serviceId, action.booking.consultantId, controller.signal)
      .then((provider) => {
        if (controller.signal.aborted) return;
        setAvailability(provider);
        if (!provider) setAvailabilityError("This consultant is no longer bookable. Check their availability in Our Consultants.");
      })
      .catch(() => { if (!controller.signal.aborted) setAvailabilityError("Could not check current availability. Close and reopen to try again."); })
      .finally(() => { if (!controller.signal.aborted) setAvailabilityLoading(false); });
    return () => controller.abort();
  }, [action]);
  const dateAllowed = useCallback((value: string) => Boolean(availability && isConsultantDateAvailable(value, availability)), [availability]);
  const availableDates = availability?.availableDates?.filter((value) => value >= toDateInputValue() && dateAllowed(value)).toSorted() ?? [];
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailWarning, setEmailWarning, emailWarningEvent] = useRepeatableMessage();
  const submitting = useRef(false);
  const [error, setError, errorEvent] = useRepeatableMessage();
  const [message, setMessage, messageEvent] = useRepeatableMessage();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [status, setStatus] = useState<ConsultationBookingDocument["status"] | "">("");
  const [month, setMonth] = useState("");
  const hasFilters = role === "admin" && !bookingId && Boolean(deferredSearch || status || month);
  const visibleItems = useMemo(() => {
    if (role !== "admin" || bookingId) return items;
    return items.filter((booking) => {
      const searchable = [booking.bookingReference, booking.serviceName, booking.consultantName, booking.consumerName, booking.consumerEmail, booking.consumerPhone]
        .filter(Boolean).join(" ").toLowerCase();
      return (!deferredSearch || searchable.includes(deferredSearch))
        && (!status || booking.status === status)
        && (!month || (booking.confirmedDate ?? booking.preferredDate).startsWith(month));
    });
  }, [bookingId, deferredSearch, items, month, role, status]);
  const guidance = role === "consumer"
    ? "Appointments are confirmed when booked for your selected date and time window. Any schedule changes will appear here."
    : "Appointments are confirmed when booked. Reschedule, cancel or complete consultations here.";
  const emptyTitle = bookingId ? "Consultation not available" : role === "consumer" ? "No online consultations yet" : "No consultation requests yet";
  const emptyMessage = bookingId
    ? "This appointment could not be found in the records available to you."
    : role === "consumer"
      ? "Appointments booked through Wellness Path will appear here with their consultant, appointment window and current status."
      : "New online consultation requests will appear here when they are submitted.";
  function open(booking: Appointment, status: Action["status"]) {
    setAvailability(null); setAvailabilityError(""); setAvailabilityLoading(status === "reschedule");
    setError(null); setDate(booking.confirmedDate ?? booking.preferredDate); setTime(booking.confirmedTime ?? booking.slotStartTime); setNotes(booking.adminNotes ?? ""); setAction({ booking, status, requestId: globalThis.crypto.randomUUID() });
  }
  async function confirm() {
    if (!action || submitting.current) return;
    if (action.status === "reschedule" && (!availability || availabilityLoading || !dateAllowed(date))) {
      setError("Choose a date matching the consultant's current availability."); return;
    }
    if (action.status === "reschedule" && !validConsultationSchedule(date, action.booking.slotStartTime, action.booking.slotEndTime, time)) {
      setError("Choose a future date and a time within the appointment window."); return;
    }
    submitting.current = true; setBusy(true); setError(null); setMessage(null); setEmailWarning(null);
    try {
      const result = await updateConsultationBooking(action.booking.id, { action: action.status, requestId: action.requestId, expectedAuditId: action.booking.lastAuditId,
        ...(action.status === "reschedule" ? { confirmedDate: date, confirmedTime: time } : {}), ...(role === "admin" ? { adminNotes: notes } : {}) });
      patchItem(action.booking.id, result.changes);
      const deliveries = [[result.email, "consumer"], [result.consultantEmail, "consultant"]] as const;
      const accepted = deliveries.filter(([delivery]) => delivery?.status === "accepted").map(([delivery, recipient]) => consultationEmailFeedback(delivery, recipient));
      const warnings = deliveries.filter(([delivery]) => delivery && delivery.status !== "accepted").map(([delivery, recipient]) => consultationEmailFeedback(delivery, recipient));
      setMessage(`Appointment ${action.status === "reschedule" ? "rescheduled" : formatStatus(action.status).toLowerCase()}. ${accepted.join(" ")}`.trim());
      if (warnings.length) setEmailWarning(warnings.join(" "));
      setAction(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "We could not update the appointment."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <PortalShell role={role} title="Online consultations">
    {role === "admin" && <AdminBookingNavigation active="consultation" detail={Boolean(bookingId)} />}
    <div className="portal-flow-page">
    <section className="portal-flow-intro" aria-label="Online consultation guidance">
      <p>{guidance}</p>
      {role === "consumer" && <nav className="portal-actions portal-flow-navigation" aria-label="Booking categories"><Link className="portal-button secondary" href={home}>My hospital bookings</Link>
        {bookingId && <Link className="portal-button secondary" href={`${home}/consultations`}>All online consultations</Link>}
        {role === "consumer" && <Link className="portal-button" href="/#wellness">Explore wellness services</Link>}
      </nav>}
    </section>
    <PortalToast message={loadError} notification={errorNotification} tone="error" />
    <PortalToast message={error} notification={errorEvent} tone="error" />
    <PortalToast message={message} notification={messageEvent} />
    <PortalToast message={emailWarning} notification={emailWarningEvent} tone="error" />
    {emailWarning && <p className="portal-form-error" role="alert">{emailWarning}</p>}
    {role === "admin" && !bookingId && <section className="portal-card portal-booking-filters" aria-label="Online consultation filters">
      <div className="portal-filter-field portal-hospital-filter">
        <label htmlFor="consultation-search">Search consultations</label>
        <input id="consultation-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Booking, consumer, consultant, email or phone" autoComplete="off" />
      </div>
      <div className="portal-filter-field">
        <label htmlFor="consultation-status">Status</label>
        <select id="consultation-status" value={status} onChange={(event) => setStatus(event.target.value as ConsultationBookingDocument["status"] | "")}>
          <option value="">All statuses</option>
          {CONSULTATION_STATUSES.map((value) => <option key={value} value={value}>{formatStatus(value)}</option>)}
        </select>
      </div>
      <div className="portal-filter-field">
        <label htmlFor="consultation-month">Appointment month</label>
        <input id="consultation-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </div>
      <div className="portal-filter-actions"><button type="button" className="portal-button secondary" disabled={!hasFilters} onClick={() => { setSearch(""); setStatus(""); setMonth(""); }}>Clear filters</button></div>
      <p className="portal-filter-note full">Search and filters apply to the consultations currently loaded on this page.</p>
      {visibleItems.length > 0 && <div className="portal-filter-summary"><PortalResultCount count={visibleItems.length} singular="online consultation" hasMore={hasMore} /></div>}
    </section>}
    {loadError && items.length === 0 && <section className="portal-empty-state portal-state-card" role="alert"><span className="portal-empty-state-leaf" aria-hidden="true" /><h3>Online consultations could not be loaded</h3><p>{loadError}</p><button className="portal-button secondary" type="button" disabled={isLoading} onClick={() => void reload()}>Try again</button></section>}
    {isLoading && items.length === 0 && <section className="portal-empty-state portal-state-card" role="status"><span className="portal-empty-state-leaf" aria-hidden="true" /><h3>Loading online consultations</h3><p>Please wait while we retrieve your appointment information.</p></section>}
    {!isLoading && !loadError && items.length === 0 && <section className="portal-empty-state portal-state-card" role="status"><span className="portal-empty-state-leaf" aria-hidden="true" /><h3>{emptyTitle}</h3><p>{emptyMessage}</p></section>}
    {!isLoading && !loadError && items.length > 0 && visibleItems.length === 0 && <PortalFeedback emptyTitle="No matching online consultations" empty="No consultations currently loaded on this page match the selected search or filters." />}
    <div className="consultation-history consumer-booking-list">{visibleItems.map((booking) => <article className="portal-row consumer-booking-row operational-booking-card consultation-history-card" data-accent={booking.status} key={booking.id}>
      <div className="consumer-booking-copy">
      <span className="consumer-booking-reference">Booking ID: {booking.bookingReference}</span>
      <h3>{booking.serviceName}</h3>
      <p className="consumer-booking-package">{booking.consultantName}{booking.consultantDesignation ? ` · ${booking.consultantDesignation}` : ""}</p>
      <dl className="consumer-booking-facts consultation-booking-details">
        <div><dt>Booked on</dt><dd>{formatBookingPlacedAt(booking.createdAt)}</dd></div>
        <div><dt>Preferred date</dt><dd>{formatDisplayDate(booking.preferredDate)}</dd></div>
        {booking.paymentStatus && <div><dt>Payment</dt><dd>{formatStatus(booking.paymentStatus)}{booking.paymentReference ? ` · ${booking.paymentReference}` : ""}</dd></div>}
        {booking.paymentStatus && booking.status === "cancelled" && <div><dt>Refund information</dt><dd>Cancellation does not automatically refund payment. Contact Ayursarga for review under the cancellation policy.</dd></div>}
        <div><dt>Preferred window</dt><dd>{formatConsultantTimeSlot(booking.preferredTimeSlot, { [booking.preferredTimeSlot]: { startTime: booking.slotStartTime, endTime: booking.slotEndTime } })}</dd></div>
        {booking.confirmedDate && <div><dt>Scheduled appointment</dt><dd>{formatDisplayDate(booking.confirmedDate)} · {booking.confirmedTime ? `${booking.confirmedTime} IST` : `${booking.slotStartTime} - ${booking.slotEndTime} IST`}</dd></div>}
        {role === "admin" && <><div><dt>Consumer</dt><dd>{booking.consumerName}</dd></div><div><dt>Email</dt><dd>{booking.consumerEmail}</dd></div><div><dt>Phone</dt><dd>{booking.consumerPhone}</dd></div></>}
        {booking.consumerNotes && <div><dt>Consumer notes</dt><dd>{booking.consumerNotes}</dd></div>}
        {booking.adminNotes && <div><dt>Appointment notes</dt><dd>{booking.adminNotes}</dd></div>}
      </dl>
      </div>
      <div className="consumer-booking-meta"><span className="portal-status" data-status={booking.status}>{formatStatus(booking.status)}</span><div className="consumer-booking-cost"><span>Consultation charge</span><strong>{formatCurrency(booking.consultantCharge)}</strong></div></div>
      <div className="operational-booking-actions"><div className="portal-actions">
        {role === "admin" && ["requested", "confirmed"].includes(booking.status) && <button className="portal-button secondary" disabled={busy} onClick={() => open(booking, "reschedule")}>Reschedule</button>}
        {role === "admin" && booking.status === "confirmed" && <button className="portal-button" disabled={busy} onClick={() => open(booking, "completed")}>Mark completed</button>}
        {["requested", "confirmed"].includes(booking.status) && <button className="portal-button danger" disabled={busy} onClick={() => open(booking, "cancelled")}>Cancel appointment</button>}
      </div></div>
    </article>)}</div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
    </div>
    <PortalDialog open={Boolean(action)} title={action ? `${action.status === "reschedule" ? "Reschedule" : action.status === "completed" ? "Complete" : "Cancel"} appointment?` : "Appointment"}
      message={action?.status === "reschedule" ? "Save the revised schedule and email the consumer after it is saved." : action?.status === "cancelled" && role === "admin" ? "Cancel this appointment and email the consumer after it is saved." : "The status changes only after you confirm."} tone={action?.status === "cancelled" ? "danger" : "default"}
      busy={busy} confirmDisabled={action?.status === "reschedule" && (availabilityLoading || !availability || !dateAllowed(date))} onCancel={() => { if (!submitting.current) setAction(null); }} onConfirm={() => void confirm()}>
      <div className="portal-form consultation-dialog-fields">
        {action?.status === "reschedule" && <><p className="full">Current appointment: {formatDisplayDate(action.booking.confirmedDate ?? action.booking.preferredDate)} · {action.booking.confirmedTime ?? `${action.booking.slotStartTime} - ${action.booking.slotEndTime}`} IST</p>
          {availabilityLoading && <p className="full" role="status">Checking current consultant availability…</p>}
          {availabilityError && <p className="portal-form-error full" role="alert">{availabilityError}</p>}
          {availability && <p className="full">Available days/dates: {consultantAvailabilitySummary(availability)}</p>}
          <label>New appointment date *<DateInput min={availableDates[0] ?? toDateInputValue()} max={availableDates.at(-1)} value={date} isDateAllowed={dateAllowed} onChange={(event) => setDate(event.target.value)} disabled={busy || availabilityLoading || !availability} required /></label>
          <label>New appointment time (IST) *<input type="time" value={time} min={action.booking.slotStartTime} max={action.booking.slotEndTime} onChange={(event) => setTime(event.target.value)} disabled={busy} required /></label><p className="full">Choose a time inside the {action.booking.slotStartTime} to {action.booking.slotEndTime} IST appointment window. The current consultant availability is checked before saving.</p></>}
        {role === "admin" && <label className="full">Appointment notes (visible to the consumer)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} disabled={busy} /></label>}
        {error && <p className="portal-form-error full" role="alert">{error}</p>}
        {busy && <p className="full" role="status">{role === "admin" && action?.status !== "completed" ? "Saving the appointment and checking email delivery. Please wait." : "Saving the appointment. Please wait."}</p>}
      </div>
    </PortalDialog>
  </PortalShell>;
}
