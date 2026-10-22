"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import type { BookingDocument, BookingStatus, TreatmentStatus } from "@/features/firestore/models";
import { bookingStatusLabel } from "@/features/bookings/display";
import { getTreatmentStatus } from "@/features/bookings/treatmentStatus";
import { emptyQueryPage, type DocumentRecord, type QueryPageOptions } from "@/services/firestore/firestoreService";
import { getPortalBooking, listHospitalBookings, updateHospitalBooking, updateTreatmentProgress, type HospitalBookingUpdate } from "@/services/bookings/bookingService";
import { getCalendarMonthRange, toDateInputValue, parseDateInputValue } from "@/utils/date";
import { DateInput } from "@/components/forms/DateInput";
import { formatStatus } from "@/utils/text";
import { useAuth } from "@/hooks/useAuth";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { withPortalBookingDetails } from "@/services/bookings/portalBookingDetails";
import { PortalBookingSummary } from "@/components/portal/PortalBookingSummary";
import { PortalResultCount } from "@/components/portal/PortalResultCount";

const BOOKING_STATUSES: readonly BookingStatus[] = [
  "requested", "confirmed", "reschedule_requested", "completed", "cancelled", "rejected",
];

type PendingBookingAction = {
  item: DocumentRecord<BookingDocument>;
  nextStatus: HospitalBookingUpdate["status"];
  date: string;
  time: string;
  notes: string;
};

type PendingTreatmentAction = {
  item: DocumentRecord<BookingDocument>;
  treatmentStatus: Exclude<TreatmentStatus, "not_started">;
};

export function HospitalBookings({ bookingId }: { bookingId?: string } = {}) {
  const { userProfile } = useAuth();
  const hospitalId = userProfile?.hospitalId;
  const [actionError, setActionError, actionErrorNotification] = useRepeatableMessage();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage, actionMessageNotification] = useRepeatableMessage();
  const [pendingBookingAction, setPendingBookingAction] = useState<PendingBookingAction | null>(null);
  const [pendingTreatmentAction, setPendingTreatmentAction] = useState<PendingTreatmentAction | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [month, setMonth] = useState("");
  const [detailsError, setDetailsError] = useState(false);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const monthRange = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return null;
    return getCalendarMonthRange(parseDateInputValue(`${month}-01`)!);
  }, [month]);
  const loader = useCallback(async (cursor: QueryPageOptions["cursor"]) => {
    if (!hospitalId) return emptyQueryPage<BookingDocument>();
    const booking = bookingId ? await getPortalBooking(bookingId) : null;
    const page = bookingId ? { documents: booking?.hospitalId === hospitalId ? [booking] : [], cursor: null, hasMore: false } : await listHospitalBookings(hospitalId, {
      status: status || undefined,
      createdFrom: monthRange?.start,
      createdBefore: monthRange?.end,
    }, { pageSize: 20, cursor });
    try {
      const resolved = await withPortalBookingDetails(page, hospitalId);
      setDetailsError(false);
      return resolved;
    } catch {
      setDetailsError(true);
      return page;
    }
  }, [bookingId, hospitalId, monthRange, status]);
  const { errorNotification: loadErrorNotification, items, error: loadError, isLoading, hasMore, loadMore, patchItem, removeItem } = usePaginatedList<BookingDocument>(
    loader,
    "We could not load the bookings. Refresh the page and try again.",
  );
  const visible = useMemo(() => deferredSearch
    ? items.filter((item) => `${item.bookingReference ?? ""} ${item.consumerName} ${item.consumerEmail} ${item.consumerPhone}`.toLowerCase().includes(deferredSearch))
    : items, [deferredSearch, items]);
  const hasFilters = Boolean(search.trim() || status || month);

  function clearFilters() {
    setSearch("");
    setStatus("");
    setMonth("");
  }

  function act(item: DocumentRecord<BookingDocument>, nextStatus: HospitalBookingUpdate["status"]) {
    setPendingBookingAction({
      item,
      nextStatus,
      date: toDateInputValue(item.preferredDate),
      time: /^\d{2}:\d{2}$/.test(item.preferredTime) ? item.preferredTime : "",
      notes: item.hospitalNotes ?? "",
    });
  }

  async function submitBookingAction() {
    if (!pendingBookingAction || busy) return;
    const { item, nextStatus, date, time, notes } = pendingBookingAction;
    const update: HospitalBookingUpdate = { status: nextStatus, hospitalNotes: notes.trim() || null };
    if (nextStatus === "confirmed" || nextStatus === "reschedule_requested") {
      const confirmedDate = parseDateInputValue(date);
      if (!confirmedDate || !time) {
        setActionError("Enter a valid proposed date and time before continuing.");
        return;
      }
      update.confirmedDate = confirmedDate;
      update.confirmedTime = time;
    }
    setBusy(item.id); setActionError(null); setActionMessage(null);
    setPendingBookingAction(null);
    try {
      const changes = await updateHospitalBooking(item.id, update);
      if (status && changes.status !== status) removeItem(item.id);
      else patchItem(item.id, changes);
      setActionMessage("The booking has been updated.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not update this booking. Review the details and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function applyTreatmentUpdate(item: DocumentRecord<BookingDocument>, treatmentStatus: Exclude<TreatmentStatus, "not_started">) {
    if (busy) return;
    setBusy(item.id); setActionError(null); setActionMessage(null);
    try {
      const changes = await updateTreatmentProgress(item.id, treatmentStatus, item);
      if (status && changes.status && changes.status !== status) removeItem(item.id);
      else patchItem(item.id, changes);
      setActionMessage(`Treatment marked as ${formatStatus(treatmentStatus)}.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not update the treatment status. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function markTreatment(item: DocumentRecord<BookingDocument>, treatmentStatus: Exclude<TreatmentStatus, "not_started">) {
    if (treatmentStatus === "completed") {
      setPendingTreatmentAction({ item, treatmentStatus });
      return;
    }
    void applyTreatmentUpdate(item, treatmentStatus);
  }

  return <PortalShell role="hospital" title="Bookings">
    <PortalLoadGuard notification={loadErrorNotification} loading={isLoading} error={loadError} hasData={items.length > 0} fallbackHref="/hospital" loadingMessage="Loading bookings…" />
    {bookingId && <nav className="portal-actions portal-booking-navigation" aria-label="Booking navigation"><Link className="portal-button secondary" href="/hospital/bookings">View all bookings</Link></nav>}
    {!bookingId && <section className="portal-card portal-booking-filters" aria-label="Booking search and filters">
      <span className="portal-filter-eyebrow">Filters</span>
      <div className="portal-filter-field">
        <label htmlFor="hospital-booking-search">Search bookings</label>
        <input id="hospital-booking-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Patient name, email, or phone" autoComplete="off" />
      </div>
      <div className="portal-filter-field">
        <label htmlFor="hospital-booking-status">Booking status</label>
        <select id="hospital-booking-status" value={status} onChange={(event) => setStatus(event.target.value as BookingStatus | "")}>
          <option value="">All statuses</option>
          {BOOKING_STATUSES.map((value) => <option value={value} key={value}>{bookingStatusLabel(value)}</option>)}
        </select>
      </div>
      <div className="portal-filter-field">
        <label htmlFor="hospital-booking-month">Booking month</label>
        <input id="hospital-booking-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </div>
      <div className="portal-filter-actions"><button type="button" className="portal-button secondary" disabled={!hasFilters} onClick={clearFilters}>Clear filters</button></div>
      {visible.length > 0 && <div className="portal-filter-summary"><PortalResultCount count={visible.length} singular="booking" hasMore={hasMore} /></div>}
    </section>}
    <PortalFeedback notification={loadErrorNotification} error={items.length > 0 ? loadError : null} emptyTitle={hasFilters ? "No matching bookings" : "No patient bookings yet"} empty={!loadError && !isLoading && visible.length === 0
      ? (hasFilters ? "No bookings match this search or filter. Adjust the selections and try again." : "No bookings yet. New patient bookings will appear here.")
      : undefined} />
    <PortalToast message={actionMessage} notification={actionMessageNotification} />
    <PortalToast message={actionError} notification={actionErrorNotification} tone="error" />
    {detailsError && <p className="portal-form-error" role="status">Some centre or package names could not be loaded. Booking details are still available. Refresh to retry.</p>}
    <div className="portal-list consumer-booking-list">
      {visible.map((item) => <PortalBookingSummary key={item.id} booking={item}>
        <div className="portal-actions">
          {item.status === "requested" && <><button className="portal-button" disabled={busy === item.id} onClick={() => void act(item, "confirmed")}>Confirm</button><button className="portal-button secondary" disabled={busy === item.id} onClick={() => void act(item, "reschedule_requested")}>Reschedule</button><button className="portal-button danger" disabled={busy === item.id} onClick={() => void act(item, "rejected")}>Reject</button></>}
          {item.status === "reschedule_requested" && <button className="portal-button" disabled={busy === item.id} onClick={() => void act(item, "confirmed")}>Confirm</button>}
          {item.status === "confirmed" && getTreatmentStatus(item) === "not_started" && <><button className="portal-button" disabled={busy === item.id} onClick={() => void markTreatment(item, "started")}>Start treatment</button><button className="portal-button secondary" disabled={busy === item.id} onClick={() => void act(item, "reschedule_requested")}>Reschedule</button></>}
          {item.status === "confirmed" && getTreatmentStatus(item) === "started" && <><button className="portal-button" disabled={busy === item.id} onClick={() => void markTreatment(item, "ongoing")}>Mark ongoing</button><button className="portal-button" disabled={busy === item.id} onClick={() => void markTreatment(item, "completed")}>Complete treatment</button></>}
          {item.status === "confirmed" && getTreatmentStatus(item) === "ongoing" && <button className="portal-button" disabled={busy === item.id} onClick={() => void markTreatment(item, "completed")}>Complete treatment</button>}
        </div>
      </PortalBookingSummary>)}
    </div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
    <PortalDialog open={Boolean(pendingBookingAction)} title={pendingBookingAction?.nextStatus === "rejected" ? "Reject this booking?" : "Update booking details"} message={pendingBookingAction?.nextStatus === "rejected" ? "The patient request will be marked as rejected." : "Confirm the proposed appointment details before sending the update."} tone={pendingBookingAction?.nextStatus === "rejected" ? "danger" : "default"} confirmLabel={pendingBookingAction?.nextStatus === "rejected" ? "Reject booking" : "Save booking update"} busy={busy === pendingBookingAction?.item.id} onCancel={() => setPendingBookingAction(null)} onConfirm={() => void submitBookingAction()}>
      {pendingBookingAction && <div className="portal-dialog-form">
        {(pendingBookingAction.nextStatus === "confirmed" || pendingBookingAction.nextStatus === "reschedule_requested") && <div className="portal-form">
          <label>Proposed date<DateInput value={pendingBookingAction.date} onChange={(event) => setPendingBookingAction((current) => current ? { ...current, date: event.target.value } : current)} /></label>
          <label>Proposed time<input type="time" value={pendingBookingAction.time} onChange={(event) => setPendingBookingAction((current) => current ? { ...current, time: event.target.value } : current)} /></label>
        </div>}
        <label className="portal-dialog-field">Hospital note (optional)<textarea value={pendingBookingAction.notes} onChange={(event) => setPendingBookingAction((current) => current ? { ...current, notes: event.target.value } : current)} /></label>
      </div>}
    </PortalDialog>
    <PortalDialog open={Boolean(pendingTreatmentAction)} title="Complete this treatment?" message="This closes the booking and marks the treatment as completed." confirmLabel="Complete treatment" busy={busy === pendingTreatmentAction?.item.id} onCancel={() => setPendingTreatmentAction(null)} onConfirm={() => {
      if (!pendingTreatmentAction) return;
      const action = pendingTreatmentAction;
      setPendingTreatmentAction(null);
      void applyTreatmentUpdate(action.item, action.treatmentStatus);
    }} />
  </PortalShell>;
}
