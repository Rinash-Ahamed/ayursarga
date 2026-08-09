"use client";

import { useCallback, useState } from "react";
import type { BookingDocument } from "@/features/firestore/models";
import { emptyQueryPage, type DocumentRecord, type QueryPageOptions } from "@/services/firestore/firestoreService";
import { cancelConsumerBooking, listConsumerBookings } from "@/services/bookings/bookingService";
import { formatCurrency } from "@/utils/currency";
import { useAuth } from "@/hooks/useAuth";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { formatStatus } from "@/utils/text";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";

export function ConsumerBookings() {
  const { firebaseUser } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => firebaseUser
    ? listConsumerBookings(firebaseUser.uid, { pageSize: 20, cursor })
    : Promise.resolve(emptyQueryPage<BookingDocument>()), [firebaseUser]);
  const { items, error: loadError, isLoading, hasMore, loadMore, patchItem } = usePaginatedList<BookingDocument>(loader, "We could not load your bookings. Refresh the page and try again.");
  const error = actionError ?? loadError;
  async function cancel(item: DocumentRecord<BookingDocument>) { setBusy(item.id); try { await cancelConsumerBooking(item.id, item); patchItem(item.id, { status: "cancelled" }); } catch { setActionError("We could not cancel this booking. Refresh the page and try again."); } finally { setBusy(null); } }
  return <PortalShell role="consumer" title="My bookings"><PortalFeedback error={error} empty={!error && !isLoading && items.length === 0 ? "You have no bookings yet. Find a hospital to request your first appointment." : undefined} />
    <div className="portal-list">{items.map((booking) => <article className="portal-row" key={booking.id}><div><h3>{formatCurrency(booking.servicePrice)}</h3><p>{booking.preferredDate.toDate().toLocaleDateString("en-IN")} at {booking.preferredTime}</p></div><div><span className="portal-status">{formatStatus(booking.status)}</span>{["requested", "confirmed", "reschedule_requested"].includes(booking.status) && <div className="portal-actions"><button className="portal-button secondary" disabled={busy === booking.id} onClick={() => void cancel(booking)}>Cancel</button></div>}</div></article>)}</div><PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
