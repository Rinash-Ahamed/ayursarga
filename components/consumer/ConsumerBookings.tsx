"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/config/routes";
import type { BookingDocument } from "@/features/firestore/models";
import { getTreatmentStatus } from "@/features/bookings/treatmentStatus";
import { emptyQueryPage, type DocumentRecord, type QueryPageOptions } from "@/services/firestore/firestoreService";
import { cancelConsumerBooking, getConsumerBookingDetails, getPortalBooking, listConsumerBookings } from "@/services/bookings/bookingService";
import { bookingReferenceLabel, bookingStatusLabel } from "@/features/bookings/display";
import { formatBystanders } from "@/features/hospitals/searchContext";
import { formatCurrency } from "@/utils/currency";
import { formatStatus } from "@/utils/text";
import { formatDisplayDate } from "@/utils/date";
import { useAuth } from "@/hooks/useAuth";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";

function TreatmentTrail({ status }: { status: string }) {
  const steps = ["started", "ongoing", "completed"];
  const currentIndex = steps.indexOf(status);
  if (currentIndex === -1 && status !== "not_started") return null;
  return <div className="portal-treatment-trail">
    {steps.map((step, index) => <div className="portal-treatment-step" key={step}>
      <div className="portal-treatment-dot" data-done={currentIndex > index ? "true" : undefined} data-active={currentIndex === index ? "true" : undefined} />
      <span>{formatStatus(step)}</span>
    </div>)}
  </div>;
}

export function ConsumerBookings({ bookingId }: { bookingId?: string } = {}) {
  const { firebaseUser } = useAuth();
  const [actionError, setActionError, actionErrorNotification] = useRepeatableMessage();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage, actionMessageNotification] = useRepeatableMessage();
  const [detailsError, setDetailsError] = useState(false);
  const loader = useCallback(async (cursor: QueryPageOptions["cursor"]) => {
    if (!firebaseUser) return emptyQueryPage<BookingDocument>();
    const selected = bookingId ? await getPortalBooking(bookingId) : null;
    const page = bookingId ? { documents: selected?.consumerId === firebaseUser.uid ? [selected] : [], cursor: null, hasMore: false }
      : await listConsumerBookings(firebaseUser.uid, { pageSize: 20, cursor });
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
  const { errorNotification: loadErrorNotification, items, error: loadError, isLoading, hasMore, loadMore, patchItem } = usePaginatedList<BookingDocument>(
    loader,
    "We could not load your bookings. Refresh the page and try again.",
  );
  const error = actionError ?? loadError;

  async function cancel(item: DocumentRecord<BookingDocument>) {
    if (busy) return;
    setBusy(item.id); setActionError(null); setActionMessage(null);
    try {
      await cancelConsumerBooking(item.id, item);
      patchItem(item.id, { status: "cancelled" });
      setActionMessage("The booking has been cancelled.");
    } catch {
      setActionError("We could not cancel this booking. Refresh the page and try again.");
    } finally {
      setBusy(null);
    }
  }

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
    <PortalFeedback notification={loadErrorNotification} error={items.length > 0 ? loadError : null} empty={!error && !isLoading && items.length === 0 ? "You have no bookings yet." : undefined} />
    <PortalToast message={actionMessage} notification={actionMessageNotification} />
    <PortalToast message={actionError} notification={actionErrorNotification} tone="error" />
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
            {booking.confirmedDate && <div><dt>{booking.status === "reschedule_requested" ? "Proposed appointment" : "Confirmed appointment"}</dt><dd>{formatDisplayDate(booking.confirmedDate)}{booking.confirmedTime ? ` · ${booking.confirmedTime}` : ""}</dd></div>}
          </dl>
          {booking.hospitalNotes && <div className="consumer-booking-note"><strong>Centre response</strong><p>{booking.hospitalNotes}</p></div>}
          {booking.consumerNotes && <details className="consumer-booking-notes"><summary>Your request notes</summary><p>{booking.consumerNotes}</p></details>}
          {booking.status === "requested" && <p className="consumer-booking-pending">Your booking has been placed and is awaiting the centre&apos;s confirmation. Your appointment is not confirmed yet.</p>}
          {(booking.status === "confirmed" || booking.status === "completed") && <>
            {booking.status === "confirmed" && <p className="consumer-booking-treatment">Your booking is confirmed.</p>}
            <p className="consumer-booking-treatment">Treatment: {formatStatus(getTreatmentStatus(booking))}</p>
            <TreatmentTrail status={getTreatmentStatus(booking)} />
          </>}
        </div>
        <div className="consumer-booking-meta">
          <span className="portal-status" data-status={booking.status}>{bookingStatusLabel(booking.status)}</span>
          <div className="consumer-booking-cost"><span>Package amount</span><strong className="consumer-booking-price">{formatCurrency(booking.servicePrice)}</strong><small>At time of request</small></div>
          {["requested", "confirmed", "reschedule_requested"].includes(booking.status) && getTreatmentStatus(booking) === "not_started" && <div className="portal-actions">
            <button className="portal-button secondary" disabled={busy !== null} onClick={() => void cancel(booking)}>{busy === booking.id ? "Cancelling…" : "Cancel booking"}</button>
          </div>}
        </div>
      </article>)}
    </div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
