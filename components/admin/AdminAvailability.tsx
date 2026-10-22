"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { AvailabilityDocument, HospitalDocument } from "@/features/firestore/models";
import { formatAvailabilityRange } from "@/features/hospitals/availability";
import type { DocumentRecord, QueryPageOptions } from "@/services/firestore/firestoreService";
import { listAllHospitals } from "@/services/hospitals/hospitalService";
import { createAdminAvailabilityBlock, listAdminAvailabilityRequests, reviewAvailabilityRequest } from "@/services/hospitals/availabilityService";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { DateInput } from "@/components/forms/DateInput";
import { toDateInputValue } from "@/utils/date";
import { formatStatus } from "@/utils/text";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";

export function AdminAvailability() {
  const [hospitalSearch, setHospitalSearch] = useState("");
  const deferredSearch = useDebouncedValue(hospitalSearch.trim(), 250);
  const [hospitalResults, setHospitalResults] = useState<DocumentRecord<HospitalDocument>[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const submitting = useRef(false);
  const [review, setReview] = useState<{ item: DocumentRecord<AvailabilityDocument>; action: "approve" | "reject" } | null>(null);
  const [message, setMessage, messageNotification] = useRepeatableMessage();
  const [actionError, setActionError, actionErrorNotification] = useRepeatableMessage();
  const today = toDateInputValue();

  useEffect(() => {
    if (!deferredSearch) return;
    let active = true;
    void listAllHospitals({ pageSize: 8 }, deferredSearch).then((page) => {
      if (active) setHospitalResults(page.documents.filter((hospital) => hospital.status !== "archived"));
    }).catch(() => { if (active) setHospitalResults([]); });
    return () => { active = false; };
  }, [deferredSearch]);

  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => listAdminAvailabilityRequests({ pageSize: 20, cursor }), []);
  const { errorNotification: loadErrorNotification, items, error: loadError, isLoading, hasMore, page, canGoBack, reload, reset, nextPage, previousPage } = useCursorPagination<AvailabilityDocument>(
    loader,
    "We could not load availability requests. Refresh and try again.",
  );

  async function createBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!selectedHospital) {
      setActionError("Search for and select the hospital first.");
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    submitting.current = true;
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
      reset();
      setMessage("The hospital's availability has been blocked for the selected dates.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not block these dates. Try again.");
    } finally {
      submitting.current = false;
      setBusy(null);
    }
  }

  async function act(item: DocumentRecord<AvailabilityDocument>, action: "approve" | "reject" | "cancel") {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(item.id); setMessage(null); setActionError(null);
    try {
      await reviewAvailabilityRequest(item, action);
      setReview(null);
      await reload();
      setMessage(action === "approve" ? "The requested dates are now blocked." : action === "reject" ? "The request has been rejected." : "The availability block has been removed.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not update this request. Try again.");
    } finally {
      submitting.current = false;
      setBusy(null);
    }
  }

  return <PortalShell role="admin" title="Availability">
    <form className="portal-card portal-form" onSubmit={createBlock}>
      <div className="full portal-section-heading"><h2>Block hospital dates</h2><p>Use this when a hospital requests an availability block by phone. Portal requests can be approved below.</p></div>
      <label className="full portal-availability-hospital-search">Hospital *
        <input type="search" value={hospitalSearch} onChange={(event) => { setHospitalSearch(event.target.value); setSelectedHospital(null); setHospitalResults([]); }} placeholder="Search hospital name" autoComplete="off" />
        {hospitalResults.length > 0 && !selectedHospital && <span className="portal-search-results">{hospitalResults.map((hospital) => <button type="button" key={hospital.id} onClick={() => { setSelectedHospital(hospital); setHospitalSearch(hospital.name); setHospitalResults([]); }}><strong>{hospital.name}</strong><small>{hospital.city}, {hospital.state}</small></button>)}</span>}
      </label>
      <label>Start date *<DateInput name="startDate" min={today} required /></label>
      <label>End date *<DateInput name="endDate" min={today} required /></label>
      <label className="full">Reason *<textarea name="reason" minLength={3} maxLength={500} required placeholder="Reason provided by the hospital" /></label>
      <div className="portal-actions full"><button className="portal-button" disabled={busy !== null}>{busy === "create" ? "Blocking..." : "Block dates"}</button></div>
    </form>
    <PortalToast message={message} notification={messageNotification} />
    <PortalToast message={actionError} notification={actionErrorNotification} tone="error" />
    <PortalFeedback notification={loadErrorNotification} error={loadError} emptyTitle="No availability activity yet" empty={!loadError && !isLoading && items.length === 0 ? "Hospital requests and date blocks recorded by Admin will appear here." : undefined} />
    <div className="portal-list portal-availability-list">
      {items.map((item) => <article className="portal-card portal-availability-record" key={item.id}>
        <div className="portal-availability-record-content">
          <h3>{item.hospitalName}</h3>
          <p className="portal-availability-dates">{formatAvailabilityRange(item.startDate, item.endDate)}</p>
          <p className="portal-availability-reason">{item.reason}</p>
          <small>{item.source === "admin_call" ? "Recorded from a call by Admin" : "Requested through the hospital portal"}</small>
        </div>
        <div className="portal-availability-record-side">
          <span className="portal-status" data-status={item.status}>{formatStatus(item.status)}</span>
          <div className="portal-actions">
            {item.status === "pending" && <><button className="portal-button" type="button" disabled={busy !== null || isLoading} onClick={() => { setActionError(null); setReview({ item, action: "approve" }); }}>Approve and block</button><button className="portal-button danger" type="button" disabled={busy !== null || isLoading} onClick={() => { setActionError(null); setReview({ item, action: "reject" }); }}>Reject</button></>}
            {item.status === "blocked" && <button className="portal-button danger" type="button" disabled={busy !== null || isLoading} onClick={() => void act(item, "cancel")}>Remove block</button>}
          </div>
        </div>
      </article>)}
    </div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} page={page} canGoBack={canGoBack} onPrevious={previousPage} onLoadMore={nextPage} />
    <PortalDialog open={review !== null} title={review?.action === "reject" ? "Reject availability request" : "Approve availability request"}
      message={`Are you sure you want to ${review?.action ?? "approve"} this availability request?`}
      tone={review?.action === "reject" ? "danger" : "default"} confirmLabel="Confirm" busy={busy !== null}
      onCancel={() => { if (!submitting.current) setReview(null); }}
      onConfirm={() => { if (review) void act(review.item, review.action); }}>
      {review && <p>{review.item.hospitalName} · {formatAvailabilityRange(review.item.startDate, review.item.endDate)}</p>}
      {actionError && <p className="portal-field-error" role="alert">{actionError}</p>}
    </PortalDialog>
  </PortalShell>;
}
