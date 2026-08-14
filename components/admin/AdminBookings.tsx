"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BookingDocument, BookingStatus, HospitalDocument } from "@/features/firestore/models";
import type { DocumentRecord, QueryPageOptions } from "@/services/firestore/firestoreService";
import { listAdminBookings } from "@/services/bookings/bookingService";
import { listAllHospitals } from "@/services/hospitals/hospitalService";
import { formatCurrency } from "@/utils/currency";
import { getCalendarMonthRange } from "@/utils/date";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { formatStatus } from "@/utils/text";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";
import { getTreatmentStatus } from "@/features/bookings/treatmentStatus";

const BOOKING_STATUSES: readonly BookingStatus[] = [
  "requested", "confirmed", "reschedule_requested", "completed", "cancelled", "rejected",
];

export function AdminBookings() {
  const [hospitalSearch, setHospitalSearch] = useState("");
  const [selectedHospital, setSelectedHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [hospitalResults, setHospitalResults] = useState<DocumentRecord<HospitalDocument>[]>([]);
  const [hospitalSearchError, setHospitalSearchError] = useState<string | null>(null);
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [month, setMonth] = useState("");

  useEffect(() => {
    const term = hospitalSearch.trim();
    if (selectedHospital?.name === term || term.length < 2) {
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void listAllHospitals({ pageSize: 8 }, term).then((page) => {
        if (!cancelled) {
          setHospitalResults(page.documents);
          setHospitalSearchError(null);
        }
      }).catch(() => {
        if (!cancelled) {
          setHospitalResults([]);
          setHospitalSearchError("We could not search hospitals. Try again.");
        }
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [hospitalSearch, selectedHospital]);

  const monthRange = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return null;
    const [year, monthNumber] = month.split("-").map(Number);
    return getCalendarMonthRange(new Date(year, monthNumber - 1, 1));
  }, [month]);

  const loader = useCallback((cursor: QueryPageOptions["cursor"]) =>
    listAdminBookings({
      hospitalId: selectedHospital?.id,
      status: status || undefined,
      createdFrom: monthRange?.start,
      createdBefore: monthRange?.end,
    }, { pageSize: 20, cursor }), [monthRange, selectedHospital, status]);
  const { items, error, isLoading, hasMore, loadMore } = usePaginatedList<BookingDocument>(
    loader,
    "We could not load the bookings. Refresh the page and try again.",
  );
  const hasFilters = Boolean(selectedHospital || status || month);

  function clearFilters() {
    setHospitalSearch("");
    setSelectedHospital(null);
    setHospitalResults([]);
    setHospitalSearchError(null);
    setStatus("");
    setMonth("");
  }

  return <PortalShell role="admin" title="Bookings">
    <PortalLoadGuard loading={isLoading} error={error} hasData={items.length > 0} fallbackHref="/admin" loadingMessage="Loading bookings…" />
    <section className="portal-card portal-booking-filters" aria-label="Booking filters">
      <div className="portal-filter-field portal-hospital-filter">
        <label htmlFor="booking-hospital-search">Hospital</label>
        <input id="booking-hospital-search" value={hospitalSearch} onChange={(event) => {
          const nextValue = event.target.value;
          setHospitalSearch(nextValue);
          if (selectedHospital?.name !== nextValue) setSelectedHospital(null);
          if (nextValue.trim().length < 2) {
            setHospitalResults([]);
            setHospitalSearchError(null);
          }
        }} placeholder="Type at least 2 letters" autoComplete="off" />
        {hospitalResults.length > 0 && <div className="portal-filter-results" role="listbox" aria-label="Hospital results">
          {hospitalResults.map((hospital) => <button key={hospital.id} type="button" role="option" aria-selected={selectedHospital?.id === hospital.id} onClick={() => {
            setSelectedHospital(hospital);
            setHospitalSearch(hospital.name);
            setHospitalResults([]);
          }}><strong>{hospital.name}</strong><small>{hospital.city}, {hospital.state}</small></button>)}
        </div>}
        {hospitalSearchError && <small className="portal-field-error">{hospitalSearchError}</small>}
      </div>
      <div className="portal-filter-field">
        <label htmlFor="booking-status-filter">Status</label>
        <select id="booking-status-filter" value={status} onChange={(event) => setStatus(event.target.value as BookingStatus | "")}>
          <option value="">All statuses</option>
          {BOOKING_STATUSES.map((value) => <option key={value} value={value}>{formatStatus(value)}</option>)}
        </select>
      </div>
      <div className="portal-filter-field">
        <label htmlFor="booking-month-filter">Month</label>
        <input id="booking-month-filter" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </div>
      <div className="portal-filter-actions">
        <button type="button" className="portal-button secondary" disabled={!hasFilters} onClick={clearFilters}>Clear filters</button>
      </div>
    </section>
    <PortalFeedback error={items.length > 0 ? error : null} empty={!error && !isLoading && items.length === 0
      ? (hasFilters ? "No bookings match these filters. Adjust or clear the filters and try again." : "No bookings yet. New appointment requests will appear here.")
      : undefined} />
    <div className="portal-list">{items.map((item) => <article className="portal-row" key={item.id}>
      <div><h3>{item.consumerName || "Consumer"} · {formatCurrency(item.servicePrice)}</h3><p>{item.consumerPhone || "No contact number"} · Estimated commission {formatCurrency(item.estimatedCommission)} · Hospital {selectedHospital?.id === item.hospitalId ? selectedHospital.name : item.hospitalId}</p>{item.status === "confirmed" || item.status === "completed" ? <p>Treatment: {formatStatus(getTreatmentStatus(item))}{item.rating ? ` · Consumer rating ${item.rating}/5` : ""}</p> : null}</div>
      <span className="portal-status" data-status={item.status}>{formatStatus(item.status)}</span>
    </article>)}</div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
