"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AvailabilityDocument, HospitalDocument } from "@/features/firestore/models";
import { formatAvailabilityRange } from "@/features/hospitals/availability";
import { emptyQueryPage, type DocumentRecord, type QueryPageOptions } from "@/services/firestore/firestoreService";
import { getHospital } from "@/services/hospitals/hospitalService";
import { listHospitalAvailabilityRequests, requestAvailabilityBlock } from "@/services/hospitals/availabilityService";
import { useAuth } from "@/hooks/useAuth";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalToast } from "@/components/portal/PortalToast";
import { formatStatus } from "@/utils/text";

export function HospitalAvailability() {
  const { userProfile } = useAuth();
  const hospitalId = userProfile?.hospitalId;
  const [hospital, setHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!hospitalId) return;
    let active = true;
    void getHospital(hospitalId).then((record) => { if (active) setHospital(record); }).catch(() => {
      if (active) setActionError("We could not load the hospital details. Refresh and try again.");
    });
    return () => { active = false; };
  }, [hospitalId]);

  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => hospitalId
    ? listHospitalAvailabilityRequests(hospitalId, { pageSize: 20, cursor })
    : Promise.resolve(emptyQueryPage<AvailabilityDocument>()), [hospitalId]);
  const { items, error: loadError, isLoading, hasMore, reload, loadMore } = usePaginatedList<AvailabilityDocument>(
    loader,
    "We could not load availability requests. Refresh and try again.",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hospitalId || !hospital) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setMessage(null); setActionError(null);
    try {
      await requestAvailabilityBlock({
        hospitalId,
        hospitalName: hospital.name,
        startDate: String(data.get("startDate") ?? ""),
        endDate: String(data.get("endDate") ?? ""),
        reason: String(data.get("reason") ?? ""),
      });
      form.reset();
      await reload();
      setMessage("The availability block request has been sent to Admin for approval.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not send the request. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <PortalShell role="hospital" title="Availability">
    <form className="portal-card portal-form" onSubmit={submit}>
      <div className="full portal-section-heading"><h2>Request unavailable dates</h2><p>Send dates when the hospital cannot accept new appointment requests. Admin will review the request before the dates are blocked.</p></div>
      <label>Start date *<input name="startDate" type="date" min={today} required /></label>
      <label>End date *<input name="endDate" type="date" min={today} required /></label>
      <label className="full">Reason *<textarea name="reason" minLength={3} maxLength={500} required placeholder="For example: rooms fully occupied or centre maintenance" /></label>
      <div className="portal-actions full"><button className="portal-button" disabled={busy || !hospital}>{busy ? "Sending..." : "Send request"}</button></div>
    </form>
    <PortalToast message={message} />
    <PortalToast message={actionError} tone="error" />
    <PortalFeedback error={items.length > 0 ? loadError : null} empty={!loadError && !isLoading && items.length === 0 ? "No availability requests yet." : undefined} />
    <div className="portal-list">
      {items.map((item) => <article className="portal-row" key={item.id}>
        <div><h3>{formatAvailabilityRange(item.startDate, item.endDate)}</h3><p>{item.reason}</p><small>{item.source === "admin_call" ? "Recorded by Admin" : "Requested through hospital portal"}</small></div>
        <span className="portal-status" data-status={item.status}>{formatStatus(item.status)}</span>
      </article>)}
    </div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
