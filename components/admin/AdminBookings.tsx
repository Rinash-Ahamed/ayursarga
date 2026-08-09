"use client";

import { useCallback } from "react";
import type { BookingDocument } from "@/features/firestore/models";
import type { QueryPageOptions } from "@/services/firestore/firestoreService";
import { listAllBookings } from "@/services/bookings/bookingService";
import { formatCurrency } from "@/utils/currency";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { formatStatus } from "@/utils/text";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";

export function AdminBookings() {
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) =>
    listAllBookings({ pageSize: 20, cursor }), []);
  const { items, error, isLoading, hasMore, loadMore } = usePaginatedList<BookingDocument>(loader, "We could not load the bookings. Refresh the page and try again.");
  return <PortalShell role="admin" title="Bookings"><PortalFeedback error={error} empty={!error && !isLoading && items.length === 0 ? "No bookings yet. New appointment requests will appear here." : undefined} /><div className="portal-list">{items.map((item) => <article className="portal-row" key={item.id}><div><h3>{formatCurrency(item.servicePrice)}</h3><p>Estimated commission {formatCurrency(item.estimatedCommission)} · Hospital {item.hospitalId}</p></div><span className="portal-status" data-status={item.status}>{formatStatus(item.status)}</span></article>)}</div><PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} /></PortalShell>;
}
