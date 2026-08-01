"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookingDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { listHospitalBookings, updateHospitalBooking, type HospitalBookingUpdate } from "@/services/bookings/bookingService";
import { formatCurrency } from "@/utils/currency";
import { useAuth } from "@/hooks/useAuth";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";

export function HospitalBookings() {
  const { userProfile } = useAuth(); const hospitalId = userProfile?.hospitalId;
  const [items, setItems] = useState<DocumentRecord<BookingDocument>[]>([]); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => { if (!hospitalId) return; try { setItems((await listHospitalBookings(hospitalId, { pageSize: 20 })).documents); } catch { setError("Bookings could not be loaded."); } }, [hospitalId]);
  useEffect(() => { if (!hospitalId) return; void listHospitalBookings(hospitalId, { pageSize: 20 }).then((page) => setItems(page.documents)).catch(() => setError("Bookings could not be loaded.")); }, [hospitalId]);
  async function act(item: DocumentRecord<BookingDocument>, status: HospitalBookingUpdate["status"]) {
    const update: HospitalBookingUpdate = { status };
    if (status === "confirmed" || status === "reschedule_requested") {
      const date = window.prompt("Confirmed/proposed date (YYYY-MM-DD)", item.preferredDate.toDate().toISOString().slice(0, 10));
      const time = window.prompt("Confirmed/proposed time (HH:MM)", item.preferredTime); if (!date || !time) return;
      update.confirmedDate = new Date(`${date}T00:00:00`); update.confirmedTime = time;
    }
    update.hospitalNotes = window.prompt("Hospital note (optional)", item.hospitalNotes ?? "") || null;
    setBusy(item.id); try { await updateHospitalBooking(item.id, update); await load(); } catch { setError("Booking status could not be updated."); } finally { setBusy(null); }
  }
  return <PortalShell role="hospital" title="Bookings"><PortalFeedback error={error} empty={!error && items.length === 0 ? "There are no booking requests." : undefined} /><div className="portal-list">{items.map((item) => <article className="portal-card" key={item.id}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><h3>{formatCurrency(item.servicePrice)}</h3><span className="portal-status">{item.status.replaceAll("_", " ")}</span></div>
    <p>Preferred: {item.preferredDate.toDate().toLocaleDateString("en-IN")} at {item.preferredTime}</p>{item.consumerNotes && <p>Consumer note: {item.consumerNotes}</p>}
    <div className="portal-actions">{item.status === "requested" && <><button className="portal-button" disabled={busy === item.id} onClick={() => void act(item, "confirmed")}>Confirm</button><button className="portal-button secondary" onClick={() => void act(item, "reschedule_requested")}>Reschedule</button><button className="portal-button secondary" onClick={() => void act(item, "rejected")}>Reject</button></>}{item.status === "reschedule_requested" && <button className="portal-button" onClick={() => void act(item, "confirmed")}>Confirm</button>}{item.status === "confirmed" && <><button className="portal-button" onClick={() => void act(item, "completed")}>Mark completed</button><button className="portal-button secondary" onClick={() => void act(item, "reschedule_requested")}>Reschedule</button></>}</div>
  </article>)}</div></PortalShell>;
}
