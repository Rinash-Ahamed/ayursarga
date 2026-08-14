"use client";

import { useCallback, useState } from "react";
import type { BookingDocument } from "@/features/firestore/models";
import { getTreatmentStatus } from "@/features/bookings/treatmentStatus";
import { emptyQueryPage, type DocumentRecord, type QueryPageOptions } from "@/services/firestore/firestoreService";
import { cancelConsumerBooking, listConsumerBookings, rateCompletedBooking } from "@/services/bookings/bookingService";
import { formatCurrency } from "@/utils/currency";
import { formatStatus } from "@/utils/text";
import { useAuth } from "@/hooks/useAuth";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";

export function ConsumerBookings() {
  const { firebaseUser } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => firebaseUser
    ? listConsumerBookings(firebaseUser.uid, { pageSize: 20, cursor })
    : Promise.resolve(emptyQueryPage<BookingDocument>()), [firebaseUser]);
  const { items, error: loadError, isLoading, hasMore, loadMore, patchItem } = usePaginatedList<BookingDocument>(
    loader,
    "We could not load your bookings. Refresh the page and try again.",
  );
  const error = actionError ?? loadError;

  async function cancel(item: DocumentRecord<BookingDocument>) {
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

  async function rate(item: DocumentRecord<BookingDocument>, rating: number) {
    setBusy(item.id); setActionError(null); setActionMessage(null);
    try {
      await rateCompletedBooking(item.id, rating);
      patchItem(item.id, { rating });
      setActionMessage(`Thank you. Your ${rating}-star rating has been recorded.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not save your rating. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return <PortalShell role="consumer" title="My bookings">
    <PortalLoadGuard loading={isLoading} error={loadError} hasData={items.length > 0} fallbackHref="/app" loadingMessage="Loading your bookings…" />
    <PortalFeedback error={items.length > 0 ? loadError : null} empty={!error && !isLoading && items.length === 0 ? "You have no bookings yet. Find a hospital to request your first appointment." : undefined} />
    <PortalToast message={actionMessage} />
    <PortalToast message={actionError} tone="error" />
    <div className="portal-list">
      {items.map((booking) => <article className="portal-row" key={booking.id}>
        <div>
          <h3>{formatCurrency(booking.servicePrice)}</h3>
          <p>{booking.preferredDate.toDate().toLocaleDateString("en-IN")} at {booking.preferredTime}</p>
          {booking.status === "confirmed" || booking.status === "completed"
            ? <p>Treatment: {formatStatus(getTreatmentStatus(booking))}</p>
            : null}
          {booking.status === "completed" && booking.rating
            ? <p className="portal-rating-summary" aria-label={`${booking.rating} out of 5 stars`}>{"★".repeat(booking.rating)}<span>{booking.rating}/5</span></p>
            : null}
        </div>
        <div>
          <span className="portal-status" data-status={booking.status}>{formatStatus(booking.status)}</span>
          {["requested", "confirmed", "reschedule_requested"].includes(booking.status) && getTreatmentStatus(booking) === "not_started" && <div className="portal-actions">
            <button className="portal-button secondary" disabled={busy === booking.id} onClick={() => void cancel(booking)}>Cancel</button>
          </div>}
          {booking.status === "completed" && !booking.rating && <div className="portal-rating-control" aria-label="Rate this completed treatment">
            <span>Rate your treatment</span>
            <div>{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" disabled={busy === booking.id} aria-label={`${rating} star${rating === 1 ? "" : "s"}`} onClick={() => void rate(booking, rating)}>★</button>)}</div>
          </div>}
        </div>
      </article>)}
    </div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
