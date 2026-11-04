"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ConsultationBookingDocument } from "@/features/firestore/models";
import type { DocumentRecord, QueryPageOptions } from "@/services/firestore/firestoreService";
import { emptyQueryPage } from "@/services/firestore/firestoreService";
import { getConsultationBooking, getPublicConsultant, listConsultationBookings, updateConsultationBooking } from "@/services/consultations/consultationService";
import type { PublicConsultant } from "@/features/consultations/types";
import { consultantAvailabilitySummary, isConsultantDateAvailable } from "@/features/consultations/availability";
import { useConsultationSlots } from "@/hooks/useConsultationSlots";
import { formatAppointmentRange } from "@/features/consultations/slots";
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
import { formatDisplayDate, formatDisplayDateTime, toDateInputValue } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import { formatStatus } from "@/utils/text";
import { formatConsultantTimeSlot } from "@/features/consultants/validation";
import { consultationEmailFeedback } from "@/features/consultations/email";
import { formatBookingPlacedAt } from "@/features/bookings/display";
import { AdminBookingNavigation } from "@/components/admin/AdminBookingNavigation";
import { ConsultationCancellationInfo } from "@/components/consultations/ConsultationCancellationInfo";
import { consultationCancellationEligibility } from "@/features/consultations/cancellationPolicy";
import { usePortalClock } from "@/hooks/usePortalClock";
import { consumerRescheduleEligibility } from "@/features/consultations/rescheduling";
import { bookingChangeReason } from "@/features/bookings/changeReason";
import { BookingChangeReasonField } from "@/components/bookings/BookingChangeReasonField";
import { CancellationDetails } from "@/components/bookings/CancellationDetails";
import { RescheduleDetails } from "@/components/consultations/RescheduleDetails";

type Appointment = DocumentRecord<ConsultationBookingDocument>;
type Action = { booking: Appointment; status: "reschedule" | "completed" | "cancelled"; requestId: string };
const CONSULTATION_STATUSES: readonly ConsultationBookingDocument["status"][] = ["requested", "confirmed", "completed", "cancelled", "rejected"];

export function ConsultationBookings({ role, bookingId }: { role: "admin" | "consumer"; bookingId?: string }) {
  const { firebaseUser } = useAuth();
  const clock = usePortalClock();
  const home = role === "admin" ? "/admin/bookings" : "/app/bookings";
  const loader = useCallback(async (cursor: QueryPageOptions["cursor"]) => {
    if (!firebaseUser) return emptyQueryPage<ConsultationBookingDocument>();
    if (!bookingId) return listConsultationBookings(role === "consumer" ? firebaseUser.uid : null, cursor);
    const record = await getConsultationBooking(bookingId);
    return { documents: record && (role === "admin" || record.consumerId === firebaseUser.uid) ? [record] : [], cursor: null, hasMore: false };
  }, [firebaseUser, role, bookingId]);
  const { items, error: loadError, errorNotification, isLoading, hasMore, loadMore, patchItem, reload } = usePaginatedList<ConsultationBookingDocument>(loader, "We could not load online consultations. Please try again.");
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
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
        if (!provider) setAvailabilityError(role === "admin" ? "This consultant is no longer bookable. Check their availability in Our Consultants." : "This consultant is not currently available for this service. Contact Ayursarga for help.");
      })
      .catch(() => { if (!controller.signal.aborted) setAvailabilityError("Could not check current availability. Close and reopen to try again."); })
      .finally(() => { if (!controller.signal.aborted) setAvailabilityLoading(false); });
    return () => controller.abort();
  }, [action, role]);
  const dateAllowed = useCallback((value: string) => Boolean(availability && isConsultantDateAvailable(value, availability)), [availability]);
  const availableDates = availability?.availableDates?.filter((value) => value >= toDateInputValue() && dateAllowed(value)).toSorted() ?? [];
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const appointmentSlots = useConsultationSlots(action?.status === "reschedule" ? action.booking.consultantId : "", action?.booking.serviceId ?? "", date, action?.booking.id);
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
    setReason("");
    setAvailability(null); setAvailabilityError(""); setAvailabilityLoading(status === "reschedule");
    setError(null); setDate(booking.confirmedDate ?? booking.preferredDate); setTime(booking.confirmedTime ?? booking.slotStartTime); setNotes(booking.adminNotes ?? ""); setAction({ booking, status, requestId: globalThis.crypto.randomUUID() });
  }
  async function confirm() {
    if (!action || submitting.current) return;
    if ((action.status === "cancelled" || action.status === "reschedule") && !bookingChangeReason(reason)) {
      setError(`Enter a ${action.status === "cancelled" ? "cancellation" : "rescheduling"} reason using 3 to 500 characters.`); return;
    }
    if (role === "consumer" && action.status === "reschedule" && (clock === null || !consumerRescheduleEligibility(action.booking, clock).allowed)) {
      setError("Your one-time reschedule is unavailable. Changes must be made at least 24 hours before the appointment."); return;
    }
    if (action.status === "reschedule" && (!availability || availabilityLoading || !dateAllowed(date))) {
      setError("Choose a date matching the consultant's current availability."); return;
    }
    if (action.status === "reschedule" && (appointmentSlots.loading || appointmentSlots.error || !appointmentSlots.slots.some(slot => slot.startTime === time && slot.status === "available"))) {
      setError("Choose an available appointment time."); return;
    }
    submitting.current = true; setBusy(true); setError(null); setMessage(null); setEmailWarning(null);
    try {
      const result = await updateConsultationBooking(action.booking.id, { action: action.status, requestId: action.requestId, expectedAuditId: action.booking.lastAuditId,
        ...(action.status === "cancelled" ? { cancellationReason: reason.trim() } : {}),
        ...(action.status === "reschedule" ? { confirmedDate: date, confirmedTime: time, rescheduleReason: reason.trim() } : {}), ...(role === "admin" ? { adminNotes: notes } : {}) });
      patchItem(action.booking.id, result.changes);
      const deliveries = role === "admin"
        ? [[result.email, "consumer"], [result.consultantEmail, "consultant"], [result.supportEmail, "support"]] as const
        : [[result.email, "consumer"]] as const;
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
    <div className={`consultation-history consumer-booking-list${role === "admin" ? " admin-record-grid admin-booking-grid portal-record-grid portal-booking-grid" : ""}`}>{visibleItems.map((booking) => {
      const reschedule = consumerRescheduleEligibility(booking, clock ?? NaN);
      return <article className="portal-row consumer-booking-row operational-booking-card consultation-history-card" data-accent={booking.status} key={booking.id}>
      <div className="consumer-booking-copy">
      <span className="consumer-booking-reference">Booking ID: {booking.bookingReference}</span>
      <h3>{booking.serviceName}</h3>
      <p className="consumer-booking-package">{booking.consultantName}{booking.consultantDesignation ? ` · ${booking.consultantDesignation}` : ""}</p>
      <dl className="consumer-booking-facts consultation-booking-details">
        <div><dt>Booked on</dt><dd>{formatBookingPlacedAt(booking.createdAt)}</dd></div>
        <div><dt>Preferred date</dt><dd>{formatDisplayDate(booking.preferredDate)}</dd></div>
        {booking.paymentStatus && <div><dt>Payment</dt><dd>{formatStatus(booking.paymentStatus)}{role === "admin" && booking.paymentReference ? ` · ${booking.paymentReference}` : ""}</dd></div>}
        {booking.paymentStatus && booking.status === "cancelled" && <div><dt>Refund information</dt><dd>Cancellation does not automatically refund payment. Contact Ayursarga for review under the cancellation policy.</dd></div>}
        <div><dt>Preferred window</dt><dd>{formatConsultantTimeSlot(booking.preferredTimeSlot, { [booking.preferredTimeSlot]: { startTime: booking.slotStartTime, endTime: booking.slotEndTime } })}</dd></div>
        {booking.confirmedDate && <div><dt>Scheduled appointment</dt><dd>{formatDisplayDate(booking.confirmedDate)} · {booking.confirmedTime && booking.confirmedEndTime ? formatAppointmentRange(booking.confirmedTime, booking.confirmedEndTime) : booking.confirmedTime ?? `${booking.slotStartTime} - ${booking.slotEndTime}`} IST</dd></div>}
        {role === "admin" && <><div><dt>Consumer</dt><dd>{booking.consumerName}</dd></div><div><dt>Email</dt><dd>{booking.consumerEmail}</dd></div><div><dt>Phone</dt><dd>{booking.consumerPhone}</dd></div></>}
        {booking.consumerNotes && <div><dt>Consumer notes</dt><dd>{booking.consumerNotes}</dd></div>}
        {booking.adminNotes && <div><dt>Appointment notes</dt><dd>{booking.adminNotes}</dd></div>}
      </dl>
      <CancellationDetails booking={booking} />
      <RescheduleDetails booking={booking} />
      </div>
      <div className="consumer-booking-meta"><span className="portal-status" data-status={booking.status}>{formatStatus(booking.status)}</span><div className="consumer-booking-cost"><span>Consultation charge</span><strong>{formatCurrency(booking.consultantCharge)}</strong></div></div>
      {role === "consumer" && <ConsultationCancellationInfo snapshot={booking.cancellationPolicy} status={booking.status} totals={booking.paymentTotals} outcome={booking.cancellationOutcome} now={clock} />}
      {role === "consumer" && booking.status === "confirmed" && <section className="consultation-cancellation" aria-label="Rescheduling policy"><h3>Rescheduling</h3><p>{reschedule.used ? "Your one-time reschedule has been used. Contact Ayursarga if you need more help." : reschedule.deadlineAt ? <>You can reschedule once with the same consultant, at least 24 hours before your appointment. Reschedule by {formatDisplayDateTime(reschedule.deadlineAt)} IST (inclusive).{clock !== null && !reschedule.allowed && " The rescheduling deadline has passed. Contact Ayursarga for help."}</> : "Contact Ayursarga to check rescheduling for this appointment."}</p></section>}
      <div className="operational-booking-actions"><div className="portal-actions">
        {(role === "admin" && ["requested", "confirmed"].includes(booking.status) || role === "consumer" && reschedule.allowed) && <button className="portal-button secondary" disabled={busy} onClick={() => open(booking, "reschedule")}>Reschedule</button>}
        {role === "admin" && booking.status === "confirmed" && <button className="portal-button" disabled={busy} onClick={() => open(booking, "completed")}>Mark completed</button>}
        {["requested", "confirmed"].includes(booking.status) && (role === "admin" || !booking.cancellationPolicy || (clock !== null && consultationCancellationEligibility(booking.cancellationPolicy, booking.status, booking.paymentTotals ?? null, clock).allowed)) && <button className="portal-button danger" disabled={busy} onClick={() => open(booking, "cancelled")}>Cancel appointment</button>}
      </div></div>
    </article>; })}</div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
    </div>
    <PortalDialog open={Boolean(action)} title={action ? `${action.status === "reschedule" ? "Reschedule" : action.status === "completed" ? "Complete" : "Cancel"} appointment?` : "Appointment"}
      message={action?.status === "reschedule" ? role === "consumer" ? "Confirm your new appointment date and time. This uses your one-time reschedule; your payment stays with this booking." : "Save the revised schedule and email the consumer after it is saved." : action?.status === "cancelled" && role === "admin" ? "Cancel this appointment and email the consumer after it is saved." : "The status changes only after you confirm."} tone={action?.status === "cancelled" ? "danger" : "default"}
      busy={busy} confirmDisabled={action?.status === "cancelled" ? !bookingChangeReason(reason) : action?.status === "reschedule" && (!bookingChangeReason(reason) || role === "consumer" && !consumerRescheduleEligibility(action.booking, clock ?? NaN).allowed || availabilityLoading || !availability || !dateAllowed(date) || appointmentSlots.loading || Boolean(appointmentSlots.error) || !appointmentSlots.slots.some(slot => slot.startTime === time && slot.status === "available"))} onCancel={() => { if (!submitting.current) setAction(null); }} onConfirm={() => void confirm()}>
      <div className="portal-form consultation-dialog-fields">
        {action?.status === "reschedule" && <><p className="full">Current appointment: {formatDisplayDate(action.booking.confirmedDate ?? action.booking.preferredDate)} · {action.booking.confirmedTime ?? `${action.booking.slotStartTime} - ${action.booking.slotEndTime}`} IST</p>
          {availabilityLoading && <p className="full" role="status">Checking current consultant availability…</p>}
          {availabilityError && <p className="portal-form-error full" role="alert">{availabilityError}</p>}
          {availability && <p className="full">Available days/dates: {consultantAvailabilitySummary(availability)}</p>}
          <label>New appointment date *<DateInput min={availableDates[0] ?? toDateInputValue()} max={availableDates.at(-1)} value={date} isDateAllowed={dateAllowed} onChange={(event) => setDate(event.target.value)} disabled={busy || availabilityLoading || !availability} required /></label>
          <label>New appointment time (IST) *<select value={time} onChange={(event) => setTime(event.target.value)} disabled={busy || appointmentSlots.loading || Boolean(appointmentSlots.error)} required><option value="">Select an available time</option>{appointmentSlots.slots.map(slot => <option key={slot.startTime} value={slot.startTime} disabled={slot.status !== "available"}>{formatAppointmentRange(slot.startTime, slot.endTime)}{slot.status !== "available" ? ` · ${slot.status}` : ""}</option>)}</select></label><p className="full">Choose an available time. The previous appointment stays reserved until this change is saved.</p>{appointmentSlots.error && <p className="full portal-form-error" role="alert">{appointmentSlots.error}</p>}</>}
        {(action?.status === "cancelled" || action?.status === "reschedule") && <BookingChangeReasonField action={action.status === "reschedule" ? "reschedule" : "cancellation"} value={reason} onChange={setReason} disabled={busy} />}
        {role === "admin" && <label className="full">Appointment notes (visible to the consumer)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} disabled={busy} /></label>}
        {error && <p className="portal-form-error full" role="alert">{error}</p>}
        {busy && <p className="full" role="status">{role === "admin" && action?.status !== "completed" ? "Saving the appointment and checking email delivery. Please wait." : "Saving the appointment. Please wait."}</p>}
      </div>
    </PortalDialog>
  </PortalShell>;
}
