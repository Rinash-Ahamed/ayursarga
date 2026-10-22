"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import type { ConsultationBookingDocument } from "@/features/firestore/models";
import type { DocumentRecord, QueryPageOptions } from "@/services/firestore/firestoreService";
import { emptyQueryPage } from "@/services/firestore/firestoreService";
import { getConsultationBooking, listConsultationBookings, updateConsultationBooking } from "@/services/consultations/consultationService";
import { useAuth } from "@/hooks/useAuth";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { DateInput } from "@/components/forms/DateInput";
import { formatDisplayDate, toDateInputValue } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import { formatStatus } from "@/utils/text";
import { formatConsultantTimeSlot } from "@/features/consultants/validation";

type Appointment = DocumentRecord<ConsultationBookingDocument>;
type Action = { booking: Appointment; status: "confirmed" | "completed" | "cancelled" | "rejected" };

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
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError, errorEvent] = useRepeatableMessage();
  const [message, setMessage, messageEvent] = useRepeatableMessage();
  function open(booking: Appointment, status: Action["status"]) {
    setError(null); setDate(booking.preferredDate); setTime(booking.slotStartTime); setNotes(booking.adminNotes ?? ""); setAction({ booking, status });
  }
  async function confirm() {
    if (!action || submitting.current) return;
    submitting.current = true; setBusy(true); setError(null); setMessage(null);
    try {
      const changes = await updateConsultationBooking(action.booking.id, { status: action.status,
        ...(action.status === "confirmed" ? { confirmedDate: date, confirmedTime: time } : {}), ...(role === "admin" ? { adminNotes: notes } : {}) });
      patchItem(action.booking.id, changes); setMessage(`Appointment ${formatStatus(action.status).toLowerCase()}.`); setAction(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "We could not update the appointment."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <PortalShell role={role} title="Online consultations">
    <nav className="portal-actions" aria-label="Booking categories"><Link className="portal-button secondary" href={home}>Hospital bookings</Link>
      {bookingId && <Link className="portal-button secondary" href={`${home}/consultations`}>All online consultations</Link>}
      {role === "consumer" && <Link className="portal-button" href="/#wellness">Explore wellness services</Link>}
    </nav>
    <p>Preferred windows are requests. A confirmed appointment shows its agreed date and time below.</p>
    <PortalToast message={loadError} notification={errorNotification} tone="error" />
    <PortalToast message={error} notification={errorEvent} tone="error" />
    <PortalToast message={message} notification={messageEvent} />
    {loadError && <div className="portal-actions"><p role="alert">{loadError}</p><button className="portal-button secondary" disabled={isLoading} onClick={() => void reload()}>Try again</button></div>}
    {isLoading && items.length === 0 && <p role="status">Loading appointments...</p>}
    {!isLoading && !loadError && items.length === 0 && <div className="portal-empty-state"><h3>No online consultations yet</h3><p>Your online appointment requests will appear here.</p></div>}
    <div className="consultation-history">{items.map((booking) => <article className="portal-card consultation-history-card" key={booking.id}>
      <header><div><h2>{booking.serviceName}</h2><p>{booking.consultantName}{booking.consultantDesignation ? ` · ${booking.consultantDesignation}` : ""}</p><small>Booking {booking.bookingReference}</small></div><span className="portal-status" data-status={booking.status}>{formatStatus(booking.status)}</span></header>
      <dl className="consultation-booking-details">
        <div><dt>Consultation charge</dt><dd>{formatCurrency(booking.consultantCharge)}</dd></div>
        <div><dt>Preferred date</dt><dd>{formatDisplayDate(booking.preferredDate)}</dd></div>
        <div><dt>Preferred window</dt><dd>{formatConsultantTimeSlot(booking.preferredTimeSlot, { [booking.preferredTimeSlot]: { startTime: booking.slotStartTime, endTime: booking.slotEndTime } })}</dd></div>
        {booking.confirmedDate && <div><dt>Confirmed appointment</dt><dd>{formatDisplayDate(booking.confirmedDate)} · {booking.confirmedTime}</dd></div>}
        {role === "admin" && <><div><dt>Consumer</dt><dd>{booking.consumerName}</dd></div><div><dt>Email</dt><dd>{booking.consumerEmail}</dd></div><div><dt>Phone</dt><dd>{booking.consumerPhone}</dd></div></>}
        {booking.consumerNotes && <div><dt>Consumer notes</dt><dd>{booking.consumerNotes}</dd></div>}
        {booking.adminNotes && <div><dt>Appointment notes</dt><dd>{booking.adminNotes}</dd></div>}
      </dl>
      <div className="portal-actions">
        {role === "admin" && booking.status === "requested" && <><button className="portal-button" disabled={busy} onClick={() => open(booking, "confirmed")}>Confirm appointment</button><button className="portal-button danger" disabled={busy} onClick={() => open(booking, "rejected")}>Reject</button></>}
        {role === "admin" && booking.status === "confirmed" && <button className="portal-button" disabled={busy} onClick={() => open(booking, "completed")}>Mark completed</button>}
        {["requested", "confirmed"].includes(booking.status) && <button className="portal-button danger" disabled={busy} onClick={() => open(booking, "cancelled")}>Cancel appointment</button>}
      </div>
    </article>)}</div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
    <PortalDialog open={Boolean(action)} title={action ? `${action.status === "confirmed" ? "Confirm" : action.status === "completed" ? "Complete" : action.status === "rejected" ? "Reject" : "Cancel"} appointment?` : "Appointment"}
      message="The status changes only after you confirm." tone={action?.status === "cancelled" || action?.status === "rejected" ? "danger" : "default"}
      busy={busy} onCancel={() => { if (!submitting.current) setAction(null); }} onConfirm={() => void confirm()}>
      <div className="portal-form consultation-dialog-fields">
        {action?.status === "confirmed" && <><label>Confirmed date *<DateInput min={toDateInputValue()} value={date} onChange={(event) => setDate(event.target.value)} disabled={busy} required /></label>
          <label>Confirmed time *<input type="time" value={time} min={action.booking.slotStartTime} max={action.booking.slotEndTime} onChange={(event) => setTime(event.target.value)} disabled={busy} required /></label><p className="full">Choose a time inside the requested {action.booking.slotStartTime} to {action.booking.slotEndTime} window after coordinating availability.</p></>}
        {role === "admin" && <label className="full">Appointment notes (visible to the consumer)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} disabled={busy} /></label>}
        {error && <p className="portal-form-error full" role="alert">{error}</p>}
      </div>
    </PortalDialog>
  </PortalShell>;
}
