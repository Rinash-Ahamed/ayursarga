"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useRef, useState, type FormEvent } from "react";
import type { HospitalDocument } from "@/features/firestore/models";
import type { StatusOrderedCursor } from "@/services/firestore/statusOrderedQuery";
import { createHospital, listAllHospitals, getHospitalPackageSummaries } from "@/services/hospitals/hospitalService";
import type { HospitalPackageSummary } from "@/features/hospitals/packageSummary";
import { formatDisplayDateTime } from "@/utils/date";
import { hospitalFormValues, validateHospitalFields, type HospitalValidationErrors } from "@/features/hospitals/validation";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { formatStatus } from "@/utils/text";
import { HospitalFormFields } from "@/components/forms/HospitalFormFields";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { focusFirstInvalidField } from "@/utils/formFocus";

export function HospitalsManager() {
  const [actionError, setActionError, actionErrorNotification] = useRepeatableMessage();
  const [actionMessage, setActionMessage, actionMessageNotification] = useRepeatableMessage();
  const [fieldErrors, setFieldErrors] = useState<HospitalValidationErrors>({});
  const [busy, setBusy] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const loader = useCallback((cursor: StatusOrderedCursor | null) => listAllHospitals({ pageSize: 20, cursor }, deferredSearch), [deferredSearch]);
  const { errorNotification: loadErrorNotification, items, error: loadError, isLoading, hasMore, reload, loadMore } = usePaginatedList<HospitalDocument, StatusOrderedCursor>(loader, "We could not load the hospital list. Refresh the page and try again.");
  const error = actionError ?? loadError;
  const summaryCache = useRef<Record<string, HospitalPackageSummary>>(Object.create(null));
  const [summaries, setSummaries] = useState<Record<string, HospitalPackageSummary>>({});
  const [summaryError, setSummaryError] = useState(false);
  const [summaryRetry, setSummaryRetry] = useState(0);
  const summaryLoading = !summaryError && items.some(item => !Object.hasOwn(summaries, item.id));
  const hospitalIds = JSON.stringify(items.map(item => item.id));
  useEffect(() => {
    const controller = new AbortController();
    const ids = (JSON.parse(hospitalIds) as string[]).filter(id => !Object.hasOwn(summaryCache.current, id));
    void (async () => {
      try {
        for (let offset = 0; offset < ids.length; offset += 20) {
          const result = await getHospitalPackageSummaries(ids.slice(offset, offset + 20), controller.signal);
          if (controller.signal.aborted) return;
          Object.assign(summaryCache.current, result.summaries);
          setSummaries({ ...summaryCache.current });
          setSummaryError(false);
        }
      } catch { if (!controller.signal.aborted) setSummaryError(true); }
    })();
    return () => controller.abort();
  }, [hospitalIds, summaryRetry]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const validation = validateHospitalFields(hospitalFormValues(new FormData(form)));
    setFieldErrors(validation.errors);
    setActionError(null);
    setActionMessage(null);
    if (!validation.isValid) {
      setActionError("Please check the highlighted fields, then try creating the hospital again.");
      focusFirstInvalidField(form);
      return;
    }

    setBusy(true);
    try {
      await createHospital(validation.data);
      form.reset();
      setFieldErrors({});
      await reload();
      setShowCreateForm(false);
      setActionMessage("The hospital has been created with Pending status.");
    } catch (caught) {
      if (caught instanceof Error && "status" in caught && caught.status === 409) {
        setFieldErrors({ email: caught.message });
        focusFirstInvalidField(form);
      }
      setActionError(caught instanceof Error ? caught.message : "We could not create the hospital. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <PortalShell role="admin" title="Hospitals">
    <PortalLoadGuard notification={loadErrorNotification} loading={isLoading} error={loadError} hasData={items.length > 0} fallbackHref="/admin" loadingMessage="Loading hospitals…" />
    <div className="portal-actions portal-page-actions">
      <button
        className="portal-button"
        type="button"
        aria-expanded={showCreateForm}
        aria-controls="add-hospital-form"
        onClick={() => {
          setShowCreateForm((visible) => !visible);
          setActionError(null);
          setActionMessage(null);
          setFieldErrors({});
        }}
      >{showCreateForm ? "Close form" : "Add Hospital"}</button>
    </div>

    {showCreateForm && <form id="add-hospital-form" className="portal-card portal-form" onSubmit={submit} noValidate style={{ marginBottom: 26 }}>
      <p className="full portal-form-note">Complete every field marked with * before creating the hospital.</p>
      <HospitalFormFields errors={fieldErrors} includeCommission includeLegalName />
      <div className="portal-actions full">
        <button className="portal-button" disabled={busy}>{busy ? "Creating..." : "Create hospital"}</button>
        <button className="portal-button secondary" type="button" disabled={busy} onClick={(event) => {
          event.currentTarget.form?.reset();
          setFieldErrors({});
          setActionError(null);
          setShowCreateForm(false);
        }}>Cancel</button>
      </div>
    </form>}

    <label className="portal-search">Search hospitals
      <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by hospital name" />
    </label>

    <PortalFeedback error={error} notification={actionError ? actionErrorNotification : loadErrorNotification} emptyTitle="No hospitals yet" empty={!error && !isLoading && items.length === 0 ? "Choose Add Hospital to set up your first centre." : undefined} />
    <PortalToast message={actionMessage} notification={actionMessageNotification} />
    {items.length > 0 && <div className="portal-actions portal-hospital-status-toolbar"><button className="portal-button secondary" type="button" disabled={summaryLoading} onClick={() => { summaryCache.current = Object.create(null); setSummaries({}); setSummaryError(false); setSummaryRetry(value => value + 1); }}>Refresh package status</button>{summaryError && <p className="portal-form-error" role="alert">Package status could not be loaded. Choose Refresh package status to try again.</p>}</div>}
    <div className="admin-card-layout"><div className="portal-list admin-card-grid admin-hospital-grid">{items.map((item) => <Link className="portal-card portal-card-link admin-hospital-card" href={`/admin/hospitals/${encodeURIComponent(item.id)}`} key={item.id}>
      <div className="admin-hospital-header">
      <h3>{item.name}</h3>
      <div className="admin-package-status" aria-label={`Hospital and package status for ${item.name}`}>
        <span className="portal-status" data-status={item.status}>{formatStatus(item.status)}</span>
        {!Object.hasOwn(summaries, item.id) ? <span className="portal-status">{summaryError ? "Package status unavailable" : "Checking package status…"}</span> : summaries[item.id].total === 0 ? <span className="portal-status">No packages added</span> : <>
          {summaries[item.id].pending > 0 && <span className="portal-status" data-status="pending">Package Approval Pending · {summaries[item.id].pending}</span>}
          {summaries[item.id].approved > 0 && <span className="portal-status" data-status="active">Packages Approved · {summaries[item.id].approved}</span>}
          {summaries[item.id].changesRequested > 0 && <span className="portal-status" data-status="pending">Changes Requested · {summaries[item.id].changesRequested}</span>}
          {summaries[item.id].draft > 0 && <span className="portal-status">Package Drafts · {summaries[item.id].draft}</span>}
        </>}
      </div>
      </div>
      <dl className="admin-card-facts">
        {item.legalName && item.legalName !== item.name && <div className="admin-hospital-fact-wide"><dt>Legal name</dt><dd>{item.legalName}</dd></div>}
        <div className="admin-hospital-fact-wide"><dt>Location</dt><dd>{[...new Set([item.city, item.district, item.state].filter(Boolean))].join(", ") || "Not provided"}</dd></div>
        <div><dt>Email</dt><dd>{item.email || "Not provided"}</dd></div>
        <div><dt>Owner WhatsApp</dt><dd>{item.phone || "Not provided"}</dd></div>
        <div><dt>Hospital phone</dt><dd>{item.hospitalPhone1 || item.phone || "Not provided"}{item.hospitalPhone2 && <span className="admin-card-secondary-contact">{item.hospitalPhone2}</span>}</dd></div>
        <div><dt>Created</dt><dd>{formatDisplayDateTime(item.createdAt, "Not recorded")}{item.createdAt && " IST"}</dd></div>
        <div><dt>Commission</dt><dd>{item.commissionPercentage}%</dd></div>
      </dl>
      <div className="portal-actions">
        <span className="portal-button">View details</span>
      </div>
    </Link>)}</div></div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
