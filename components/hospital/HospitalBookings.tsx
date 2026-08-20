"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import type { BookingDocument, BookingStatus, TreatmentStatus } from "@/features/firestore/models";
import { getTreatmentStatus } from "@/features/bookings/treatmentStatus";
import { emptyQueryPage, type DocumentRecord, type QueryPageOptions } from "@/services/firestore/firestoreService";
import { listHospitalBookings, updateHospitalBooking, updateTreatmentProgress, type HospitalBookingUpdate } from "@/services/bookings/bookingService";
import { formatCurrency } from "@/utils/currency";
import { getCalendarMonthRange } from "@/utils/date";
import { formatStatus } from "@/utils/text";
import { useAuth } from "@/hooks/useAuth";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";
import { PortalDialog } from "@/components/portal/PortalDialog";

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

export function HospitalBookings() {
  const { userProfile } = useAuth();
  const hospitalId = userProfile?.hospitalId;
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingBookingAction, setPendingBookingAction] = useState<PendingBookingAction | null>(null);
  const [pendingTreatmentAction, setPendingTreatmentAction] = useState<PendingTreatmentAction | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [month, setMonth] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const monthRange = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return null;
    const [year, monthNumber] = month.split("-").map(Number);
    return getCalendarMonthRange(new Date(year, monthNumber - 1, 1));
  }, [month]);
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => hospitalId
    ? listHospitalBookings(hospitalId, {
      status: status || undefined,
      createdFrom: monthRange?.start,
      createdBefore: monthRange?.end,
    }, { pageSize: 20, cursor })
    : Promise.resolve(emptyQueryPage<BookingDocument>()), [hospitalId, monthRange, status]);
  const { items, error: loadError, isLoading, hasMore, reload, loadMore } = usePaginatedList<BookingDocument>(
    loader,
    "We could not load the bookings. Refresh the page and try again.",
  );
  const visible = useMemo(() => deferredSearch
    ? items.filter((item) => `${item.consumerName} ${item.consumerEmail} ${item.consumerPhone}`.toLowerCase().includes(deferredSearch))
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
      date: item.preferredDate.toDate().toISOString().slice(0, 10),
      time: item.preferredTime,
      notes: item.hospitalNotes ?? "",
    });
  }

  async function submitBookingAction() {
    if (!pendingBookingAction) return;
    const { item, nextStatus, date, time, notes } = pendingBookingAction;
    const update: HospitalBookingUpdate = { status: nextStatus, hospitalNotes: notes.trim() || null };
    if (nextStatus === "confirmed" || nextStatus === "reschedule_requested") {
      const confirmedDate = new Date(`${date}T00:00:00`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(confirmedDate.getTime()) || !time) {
        setActionError("Enter a valid proposed date and time before continuing.");
        return;
      }
      update.confirmedDate = confirmedDate;
      update.confirmedTime = time;
    }
    setBusy(item.id); setActionError(null); setActionMessage(null);
    setPendingBookingAction(null);
    try {
      await updateHospitalBooking(item.id, update, item);
      await reload();
      setActionMessage("The booking has been updated.");
    } catch {
      setActionError("We could not update this booking. Review the details and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function applyTreatmentUpdate(item: DocumentRecord<BookingDocument>, treatmentStatus: Exclude<TreatmentStatus, "not_started">) {
    setBusy(item.id); setActionError(null); setActionMessage(null);
    try {
      await updateTreatmentProgress(item.id, treatmentStatus, item);
      await reload();
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
    <PortalLoadGuard loading={isLoading} error={loadError} hasData={items.length > 0} fallbackHref="/hospital" loadingMessage="Loading booking requests…" />
    <section className="portal-card portal-booking-filters" aria-label="Booking search and filters">
      <div className="portal-filter-field">
        <label htmlFor="hospital-booking-search">Search bookings</label>
        <input id="hospital-booking-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Patient name, email, or phone" autoComplete="off" />
      </div>
      <div className="portal-filter-field">
        <label htmlFor="hospital-booking-status">Booking status</label>
        <select id="hospital-booking-status" value={status} onChange={(event) => setStatus(event.target.value as BookingStatus | "")}>
          <option value="">All statuses</option>
          {BOOKING_STATUSES.map((value) => <option value={value} key={value}>{formatStatus(value)}</option>)}
        </select>
      </div>
      <div className="portal-filter-field">
        <label htmlFor="hospital-booking-month">Booking month</label>
        <input id="hospital-booking-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </div>
      <div className="portal-filter-actions"><button type="button" className="portal-button secondary" disabled={!hasFilters} onClick={clearFilters}>Clear filters</button></div>
    </section>
    <PortalFeedback error={items.length > 0 ? loadError : null} empty={!loadError && !isLoading && visible.length === 0
      ? (hasFilters ? "No bookings match this search or filter. Adjust the selections and try again." : "No booking requests yet. New patient requests will appear here.")
      : undefined} />
    <PortalToast message={actionMessage} />
    <PortalToast message={actionError} tone="error" />
    <div className="portal-list">
      {visible.map((item) => <article className="portal-card" key={item.id}>
        <div className="portal-row-heading"><h3>{formatCurrency(item.servicePrice)}</h3><span className="portal-status" data-status={item.status}>{formatStatus(item.status)}</span></div>
        <p><strong>{item.consumerName || "Patient"}</strong> · {item.consumerPhone || "Phone not recorded"} · {item.consumerEmail || "Email not recorded"}</p>
        <p>Address: {item.consumerAddress || "Not provided"}</p>
        <p>Preferred: {item.preferredDate.toDate().toLocaleDateString("en-IN")} at {item.preferredTime}</p>
        {item.consumerNotes && <p>Patient note: {item.consumerNotes}</p>}
        {item.status === "confirmed" || item.status === "completed" ? <p>Treatment: <span className="portal-status" data-status={getTreatmentStatus(item)}>{formatStatus(getTreatmentStatus(item))}</span></p> : null}
        <div className="portal-actions">
          {item.status === "requested" && <><button className="portal-button" disabled={busy === item.id} onClick={() => void act(item, "confirmed")}>Confirm</button><button className="portal-button secondary" disabled={busy === item.id} onClick={() => void act(item, "reschedule_requested")}>Reschedule</button><button className="portal-button secondary" disabled={busy === item.id} onClick={() => void act(item, "rejected")}>Reject</button></>}
          {item.status === "reschedule_requested" && <button className="portal-button" disabled={busy === item.id} onClick={() => void act(item, "confirmed")}>Confirm</button>}
          {item.status === "confirmed" && getTreatmentStatus(item) === "not_started" && <><button className="portal-button" disabled={busy === item.id} onClick={() => void markTreatment(item, "started")}>Start treatment</button><button className="portal-button secondary" disabled={busy === item.id} onClick={() => void act(item, "reschedule_requested")}>Reschedule</button></>}
          {item.status === "confirmed" && getTreatmentStatus(item) === "started" && <><button className="portal-button" disabled={busy === item.id} onClick={() => void markTreatment(item, "ongoing")}>Mark ongoing</button><button className="portal-button secondary" disabled={busy === item.id} onClick={() => void markTreatment(item, "completed")}>Complete treatment</button></>}
          {item.status === "confirmed" && getTreatmentStatus(item) === "ongoing" && <button className="portal-button" disabled={busy === item.id} onClick={() => void markTreatment(item, "completed")}>Complete treatment</button>}
        </div>
      </article>)}
    </div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
    <PortalDialog open={Boolean(pendingBookingAction)} title={pendingBookingAction?.nextStatus === "rejected" ? "Reject this booking?" : "Update booking details"} message={pendingBookingAction?.nextStatus === "rejected" ? "The patient request will be marked as rejected." : "Confirm the proposed appointment details before sending the update."} tone={pendingBookingAction?.nextStatus === "rejected" ? "danger" : "default"} confirmLabel={pendingBookingAction?.nextStatus === "rejected" ? "Reject booking" : "Save booking update"} busy={busy === pendingBookingAction?.item.id} onCancel={() => setPendingBookingAction(null)} onConfirm={() => void submitBookingAction()}>
      {pendingBookingAction && <div className="portal-dialog-form">
        {(pendingBookingAction.nextStatus === "confirmed" || pendingBookingAction.nextStatus === "reschedule_requested") && <div className="portal-form">
          <label>Proposed date<input type="date" value={pendingBookingAction.date} onChange={(event) => setPendingBookingAction((current) => current ? { ...current, date: event.target.value } : current)} /></label>
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
