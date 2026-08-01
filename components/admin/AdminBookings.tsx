"use client";

import { useEffect, useState } from "react";
import type { BookingDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { listAllBookings } from "@/services/bookings/bookingService";
import { formatCurrency } from "@/utils/currency";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";

export function AdminBookings() {
  const [items, setItems] = useState<DocumentRecord<BookingDocument>[]>([]); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void listAllBookings({ pageSize: 20 }).then((page) => setItems(page.documents)).catch(() => setError("Bookings could not be loaded.")); }, []);
  return <PortalShell role="admin" title="Bookings"><PortalFeedback error={error} empty={!error && items.length === 0 ? "No bookings are available." : undefined} /><div className="portal-list">{items.map((item) => <article className="portal-row" key={item.id}><div><h3>{formatCurrency(item.servicePrice)}</h3><p>Estimated commission {formatCurrency(item.estimatedCommission)} · Hospital {item.hospitalId}</p></div><span className="portal-status">{item.status.replaceAll("_", " ")}</span></article>)}</div></PortalShell>;
}
