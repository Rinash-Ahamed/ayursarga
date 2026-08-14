"use client";

import { useCallback, useState } from "react";
import type { BookingDocument, TreatmentStatus } from "@/features/firestore/models";
import { emptyQueryPage, type DocumentRecord, type QueryPageOptions } from "@/services/firestore/firestoreService";
import { listHospitalBookings, updateHospitalBooking, updateTreatmentProgress, type HospitalBookingUpdate } from "@/services/bookings/bookingService";
import { getTreatmentStatus } from "@/features/bookings/treatmentStatus";
import { formatCurrency } from "@/utils/currency";
import { useAuth } from "@/hooks/useAuth";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { formatStatus } from "@/utils/text";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";

export function HospitalBookings() {
  const { userProfile } = useAuth(); const hospitalId = userProfile?.hospitalId;
  const [actionError, setActionError] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => hospitalId
    ? listHospitalBookings(hospitalId, { pageSize: 20, cursor })
    : Promise.resolve(emptyQueryPage<BookingDocument>()), [hospitalId]);
  const { items, error: loadError, isLoading, hasMore, reload, loadMore } = usePaginatedList<BookingDocument>(loader, "We could not load the bookings. Refresh the page and try again.");
  const error = actionError ?? loadError;
  async function act(item: DocumentRecord<BookingDocument>, status: HospitalBookingUpdate["status"]) {
    const update: HospitalBookingUpdate = { status };
    if (status === "confirmed" || status === "reschedule_requested") {
      const date = window.prompt("Confirmed/proposed date (YYYY-MM-DD)", item.preferredDate.toDate().toISOString().slice(0, 10));
      const time = window.prompt("Confirmed/proposed time (HH:MM)", item.preferredTime); if (!date || !time) return;
      update.confirmedDate = new Date(`${date}T00:00:00`); update.confirmedTime = time;
    }
    update.hospitalNotes = window.prompt("Hospital note (optional)", item.hospitalNotes ?? "") || null;
    setBusy(item.id); setActionError(null); setActionMessage(null); try { await updateHospitalBooking(item.id, update, item); await reload(); setActionMessage("The booking has been updated."); } catch { setActionError("We could not update this booking. Review the details and try again."); } finally { setBusy(null); }
  }
  async function markTreatment(item: DocumentRecord<BookingDocument>, status: Exclude<TreatmentStatus, "not_started">) {
    if (status === "completed" && !window.confirm("Mark this treatment as completed? This closes the booking.")) return;
    setBusy(item.id); setActionError(null); setActionMessage(null);
    try {
      await updateTreatmentProgress(item.id, status, item);
      await reload();
      setActionMessage(`Treatment marked as ${formatStatus(status)}.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not update the treatment status. Try again.");
    } finally {
      setBusy(null);
    }
  }
  return <PortalShell role="hospital" title="Bookings"><PortalLoadGuard loading={isLoading} error={loadError} hasData={items.length > 0} fallbackHref="/hospital" loadingMessage="Loading booking requests…" /><PortalFeedback error={error} empty={!error && !isLoading && items.length === 0 ? "No booking requests yet. New requests from consumers will appear here." : undefined} /><PortalToast message={actionMessage} /><div className="portal-list">{items.map((item) => <article className="portal-card" key={item.id}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><h3>{formatCurrency(item.servicePrice)}</h3><span className="portal-status" data-status={item.status}>{formatStatus(item.status)}</span></div>
    <p><strong>{item.consumerName || "Consumer"}</strong> · {item.consumerPhone || "Phone not recorded"} · {item.consumerEmail || "Email not recorded"}</p>
    <p>Address: {item.consumerAddress || "Not provided"}</p>
    <p>Preferred: {item.preferredDate.toDate().toLocaleDateString("en-IN")} at {item.preferredTime}</p>{item.consumerNotes && <p>Consumer note: {item.consumerNotes}</p>}
    {item.status === "confirmed" || item.status === "completed" ? <p>Treatment: <span className="portal-status" data-status={getTreatmentStatus(item)}>{formatStatus(getTreatmentStatus(item))}</span></p> : null}
    {item.rating ? <p>Consumer rating: {item.rating}/5 stars</p> : null}
    <div className="portal-actions">{item.status === "requested" && <><button className="portal-button" disabled={busy === item.id} onClick={() => void act(item, "confirmed")}>Confirm</button><button className="portal-button secondary" disabled={busy === item.id} onClick={() => void act(item, "reschedule_requested")}>Reschedule</button><button className="portal-button secondary" disabled={busy === item.id} onClick={() => void act(item, "rejected")}>Reject</button></>}{item.status === "reschedule_requested" && <button className="portal-button" disabled={busy === item.id} onClick={() => void act(item, "confirmed")}>Confirm</button>}{item.status === "confirmed" && getTreatmentStatus(item) === "not_started" && <><button className="portal-button" disabled={busy === item.id} onClick={() => void markTreatment(item, "started")}>Start treatment</button><button className="portal-button secondary" disabled={busy === item.id} onClick={() => void act(item, "reschedule_requested")}>Reschedule</button></>}{item.status === "confirmed" && getTreatmentStatus(item) === "started" && <><button className="portal-button" disabled={busy === item.id} onClick={() => void markTreatment(item, "ongoing")}>Mark ongoing</button><button className="portal-button secondary" disabled={busy === item.id} onClick={() => void markTreatment(item, "completed")}>Complete treatment</button></>}{item.status === "confirmed" && getTreatmentStatus(item) === "ongoing" && <button className="portal-button" disabled={busy === item.id} onClick={() => void markTreatment(item, "completed")}>Complete treatment</button>}</div>
  </article>)}</div><PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} /></PortalShell>;
}
