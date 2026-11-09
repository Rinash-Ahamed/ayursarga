"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/config/routes";
import type { ConsumerBooking } from "@/features/bookings/consumerBooking";
import { getTreatmentProgress, getTreatmentStatus } from "@/features/bookings/treatmentStatus";
import { type DocumentRecord, type QueryPage } from "@/services/firestore/firestoreService";
import { getConsumerBookingDetails, getConsumerBooking, listConsumerBookings } from "@/services/bookings/bookingService";
import { HospitalCancellationDialog } from "@/components/bookings/HospitalCancellationDialog";
import { CancellationDetails } from "@/components/bookings/CancellationDetails";
import { bookingDateFacts, bookingReferenceLabel, bookingStatusLabel } from "@/features/bookings/display";
import { formatBystanders } from "@/features/hospitals/searchContext";
import { formatCurrency } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import { useAuth } from "@/hooks/useAuth";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";

export function ConsumerBookings({ bookingId }: { bookingId?: string } = {}) {
  const { firebaseUser } = useAuth();
  const [pendingCancellation, setPendingCancellation] = useState<DocumentRecord<ConsumerBooking> | null>(null);
  const [actionMessage, setActionMessage, actionMessageNotification] = useRepeatableMessage();
  const [detailsError, setDetailsError] = useState(false);
  const loader = useCallback(async (cursor: string | null): Promise<QueryPage<ConsumerBooking, string>> => {
    if (!firebaseUser) return { documents: [], cursor: null, hasMore: false };
    const selected = bookingId ? await getConsumerBooking(bookingId) : null;
    const page = bookingId ? { documents: selected ? [selected] : [], cursor: null, hasMore: false }
      : await listConsumerBookings({ pageSize: 20, cursor });
    const legacy = page.documents.filter((booking) => !booking.hospitalName || !booking.serviceName);
    if (legacy.length) {
      try {
        const { details } = await getConsumerBookingDetails(legacy.map((booking) => booking.id));
        page.documents = page.documents.map((booking) => ({ ...booking, ...details[booking.id] }));
        setDetailsError(false);
      } catch { setDetailsError(true); }
    }
    return page;
  }, [firebaseUser, bookingId]);
  const { errorNotification: loadErrorNotification, items, error: loadError, isLoading, hasMore, loadMore, patchItem } = usePaginatedList<ConsumerBooking, string>(
    loader,
    "We could not load your bookings. Refresh the page and try again.",
  );
  const error = loadError;

  return <PortalShell role="consumer" title="My bookings">
    <div className="consumer-booking-toolbar">
      <div>
        <span>Your care journey</span>
        <p>Review your booking details and follow your care journey.</p>
      </div>
      <nav className="consumer-booking-nav" aria-label="Consumer booking navigation">
        <Link className="portal-button secondary" href="/app/bookings/consultations">Online consultations</Link>
        <Link className="portal-button" href={ROUTES.public.centers}>Search hospitals</Link>
        <Link className="portal-button secondary" href={ROUTES.public.home}>Back to home</Link>
      </nav>
    </div>
    {bookingId && <p className="consumer-selected-booking"><Link href="/app/bookings">View all bookings</Link></p>}
    <PortalLoadGuard notification={loadErrorNotification} loading={isLoading} error={loadError} hasData={items.length > 0} fallbackHref="/" loadingMessage="Loading your bookings…" />
    <PortalFeedback notification={loadErrorNotification} error={items.length > 0 ? loadError : null} emptyTitle="No hospital bookings yet" empty={!error && !isLoading && items.length === 0 ? "Bookings placed through Search hospitals will appear here with their centre, package, care dates and current status." : undefined} />
    <PortalToast message={actionMessage} notification={actionMessageNotification} />
    {detailsError && <p className="portal-form-error" role="status">Centre and package names could not be loaded. Your booking dates and status are still shown. Refresh to try again.</p>}
    <div className="portal-list consumer-booking-list">
      {items.map((booking) => <article className="portal-row consumer-booking-row" key={booking.id}>
        <div className="consumer-booking-copy">
          <span className="consumer-booking-reference">Booking ID: {bookingReferenceLabel(booking)}</span>
          <h3>{booking.hospitalName || "Centre details unavailable"}</h3>
          {booking.hospitalLocation && <p className="consumer-booking-location">{booking.hospitalLocation}</p>}
          <p className="consumer-booking-package">{booking.serviceName || `Package reference: ${booking.serviceId}`}</p>
          <dl className="consumer-booking-facts">
            <div><dt>Requested care dates</dt><dd>{formatDisplayDate(booking.preferredDate)}{booking.preferredEndDate && formatDisplayDate(booking.preferredEndDate) !== formatDisplayDate(booking.preferredDate) ? ` to ${formatDisplayDate(booking.preferredEndDate)}` : ""}</dd></div>
            <div><dt>Accompanying</dt><dd>{formatBystanders(booking.bystanderCount ?? 1)}{(booking.additionalBystanderTotal ?? 0) > 0 && <small>{formatCurrency(booking.additionalBystanderTotal!)} additional</small>}</dd></div>
            {bookingDateFacts(booking).map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
          </dl>
          <CancellationDetails booking={booking} />
          {booking.hospitalNotes && <div className="consumer-booking-note"><strong>Centre response</strong><p>{booking.hospitalNotes}</p></div>}
          {booking.consumerNotes && <details className="consumer-booking-notes"><summary>Your request notes</summary><p>{booking.consumerNotes}</p></details>}
          {booking.status === "requested" && <p className="consumer-booking-pending">Your booking has been placed and is awaiting the centre&apos;s confirmation. Your appointment is not confirmed yet.</p>}
          {(booking.status === "confirmed" || booking.status === "completed") && <>
            {booking.status === "confirmed" && <p className="consumer-booking-treatment">Your booking is confirmed.</p>}
            <p className="consumer-booking-treatment">Treatment: {getTreatmentProgress(getTreatmentStatus(booking)).label}</p>
          </>}
        </div>
        <div className="consumer-booking-meta">
          <span className="portal-status" data-status={booking.status}>{bookingStatusLabel(booking.status)}</span>
          <div className="consumer-booking-cost"><span>Package amount</span><strong className="consumer-booking-price">{formatCurrency(booking.servicePrice)}</strong><small>At time of request</small></div>
          {["requested", "confirmed", "reschedule_requested"].includes(booking.status) && getTreatmentStatus(booking) === "not_started" && <div className="portal-actions">
            <button className="portal-button danger" disabled={pendingCancellation !== null} onClick={() => setPendingCancellation(booking)}>Cancel booking</button>
          </div>}
        </div>
      </article>)}
    </div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
    {pendingCancellation && <HospitalCancellationDialog key={pendingCancellation.id} booking={pendingCancellation} onClose={() => setPendingCancellation(null)} onSaved={changes => {
      patchItem(pendingCancellation.id, changes); setPendingCancellation(null); setActionMessage("The booking has been cancelled.");
    }} />}
  </PortalShell>;
}
