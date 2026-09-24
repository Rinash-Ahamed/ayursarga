"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AvailabilityDocument, HospitalDocument } from "@/features/firestore/models";
import { formatAvailabilityRange } from "@/features/hospitals/availability";
import type { DocumentRecord, QueryPageOptions } from "@/services/firestore/firestoreService";
import { listAllHospitals } from "@/services/hospitals/hospitalService";
import { createAdminAvailabilityBlock, listAdminAvailabilityRequests, reviewAvailabilityRequest } from "@/services/hospitals/availabilityService";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalToast } from "@/components/portal/PortalToast";
import { formatStatus } from "@/utils/text";

export function AdminAvailability() {
  const [hospitalSearch, setHospitalSearch] = useState("");
  const deferredSearch = useDebouncedValue(hospitalSearch.trim(), 250);
  const [hospitalResults, setHospitalResults] = useState<DocumentRecord<HospitalDocument>[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!deferredSearch) return;
    let active = true;
    void listAllHospitals({ pageSize: 8 }, deferredSearch).then((page) => {
      if (active) setHospitalResults(page.documents.filter((hospital) => hospital.status !== "archived"));
    }).catch(() => { if (active) setHospitalResults([]); });
    return () => { active = false; };
  }, [deferredSearch]);

  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => listAdminAvailabilityRequests({ pageSize: 20, cursor }), []);
  const { items, error: loadError, isLoading, hasMore, reload, loadMore } = usePaginatedList<AvailabilityDocument>(
    loader,
    "We could not load availability requests. Refresh and try again.",
  );

  async function createBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedHospital) {
      setActionError("Search for and select the hospital first.");
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("create"); setMessage(null); setActionError(null);
    try {
      await createAdminAvailabilityBlock({
        hospitalId: selectedHospital.id,
        startDate: String(data.get("startDate") ?? ""),
        endDate: String(data.get("endDate") ?? ""),
        reason: String(data.get("reason") ?? ""),
      });
      form.reset();
      setSelectedHospital(null); setHospitalSearch(""); setHospitalResults([]);
      await reload();
      setMessage("The hospital's availability has been blocked for the selected dates.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not block these dates. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function act(item: DocumentRecord<AvailabilityDocument>, action: "approve" | "reject" | "cancel") {
    setBusy(item.id); setMessage(null); setActionError(null);
    try {
      await reviewAvailabilityRequest(item, action);
      await reload();
      setMessage(action === "approve" ? "The requested dates are now blocked." : action === "reject" ? "The request has been rejected." : "The availability block has been removed.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not update this request. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return <PortalShell role="admin" title="Availability">
    <form className="portal-card portal-form" onSubmit={createBlock}>
      <div className="full portal-section-heading"><h2>Block hospital dates</h2><p>Use this when a hospital requests an availability block by phone. Portal requests can be approved below.</p></div>
      <label className="full portal-availability-hospital-search">Hospital *
        <input type="search" value={hospitalSearch} onChange={(event) => { setHospitalSearch(event.target.value); setSelectedHospital(null); }} placeholder="Search hospital name" autoComplete="off" />
        {hospitalResults.length > 0 && !selectedHospital && <span className="portal-search-results">{hospitalResults.map((hospital) => <button type="button" key={hospital.id} onClick={() => { setSelectedHospital(hospital); setHospitalSearch(hospital.name); setHospitalResults([]); }}><strong>{hospital.name}</strong><small>{hospital.city}, {hospital.state}</small></button>)}</span>}
      </label>
      <label>Start date *<input name="startDate" type="date" min={today} required /></label>
      <label>End date *<input name="endDate" type="date" min={today} required /></label>
      <label className="full">Reason *<textarea name="reason" minLength={3} maxLength={500} required placeholder="Reason provided by the hospital" /></label>
      <div className="portal-actions full"><button className="portal-button" disabled={busy !== null}>{busy === "create" ? "Blocking..." : "Block dates"}</button></div>
    </form>
    <PortalToast message={message} />
    <PortalToast message={actionError} tone="error" />
    <PortalFeedback error={items.length > 0 ? loadError : null} empty={!loadError && !isLoading && items.length === 0 ? "No availability requests or blocks yet." : undefined} />
    <div className="portal-list">
      {items.map((item) => <article className="portal-card portal-availability-record" key={item.id}>
        <div className="portal-row-heading"><div><h3>{item.hospitalName}</h3><p>{formatAvailabilityRange(item.startDate, item.endDate)}</p></div><span className="portal-status" data-status={item.status}>{formatStatus(item.status)}</span></div>
        <p>{item.reason}</p>
        <small>{item.source === "admin_call" ? "Recorded from a call by Admin" : "Requested through the hospital portal"}</small>
        <div className="portal-actions">
          {item.status === "pending" && <><button className="portal-button" type="button" disabled={busy !== null} onClick={() => void act(item, "approve")}>Approve and block</button><button className="portal-button secondary" type="button" disabled={busy !== null} onClick={() => void act(item, "reject")}>Reject</button></>}
          {item.status === "blocked" && <button className="portal-button secondary" type="button" disabled={busy !== null} onClick={() => void act(item, "cancel")}>Remove block</button>}
        </div>
      </article>)}
    </div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
