"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookingDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { cancelConsumerBooking, listConsumerBookings } from "@/services/bookings/bookingService";
import { formatCurrency } from "@/utils/currency";
import { useAuth } from "@/hooks/useAuth";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";

export function ConsumerBookings() {
  const { firebaseUser } = useAuth(); const [items, setItems] = useState<DocumentRecord<BookingDocument>[]>([]);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => { if (!firebaseUser) return; try { setItems((await listConsumerBookings(firebaseUser.uid, { pageSize: 20 })).documents); } catch { setError("Bookings could not be loaded."); } }, [firebaseUser]);
  useEffect(() => { if (!firebaseUser) return; void listConsumerBookings(firebaseUser.uid, { pageSize: 20 }).then((page) => setItems(page.documents)).catch(() => setError("Bookings could not be loaded.")); }, [firebaseUser]);
  async function cancel(id: string) { setBusy(id); try { await cancelConsumerBooking(id); await load(); } catch { setError("This booking could not be cancelled."); } finally { setBusy(null); } }
  return <PortalShell role="consumer" title="My bookings"><PortalFeedback error={error} empty={!error && items.length === 0 ? "You have no booking requests yet." : undefined} />
    <div className="portal-list">{items.map((booking) => <article className="portal-row" key={booking.id}><div><h3>{formatCurrency(booking.servicePrice)}</h3><p>{booking.preferredDate.toDate().toLocaleDateString("en-IN")} at {booking.preferredTime}</p></div><div><span className="portal-status">{booking.status.replaceAll("_", " ")}</span>{["requested", "confirmed", "reschedule_requested"].includes(booking.status) && <div className="portal-actions"><button className="portal-button secondary" disabled={busy === booking.id} onClick={() => void cancel(booking.id)}>Cancel</button></div>}</div></article>)}</div>
  </PortalShell>;
}
