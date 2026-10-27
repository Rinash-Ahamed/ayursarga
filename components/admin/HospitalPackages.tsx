"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ServiceDocument } from "@/features/firestore/models";
import type { QueryPageOptions } from "@/services/firestore/firestoreService";
import { listHospitalServices, reviewHospitalPackages } from "@/services/hospitals/serviceService";
import { hasPublishedPackage, workingPackage, packageReviewLabel } from "@/features/hospitals/packageReview";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { formatStatus } from "@/utils/text";
import { packageProcedureEntries, packageTitle, sortPackagesByDuration } from "@/features/hospitals/packages";
import { formatCurrency } from "@/utils/currency";

export function AdminHospitalPackages({ hospitalId }: { hospitalId: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [review, setReview] = useState<{ action: "approve" | "request_changes"; packages: { id: string; auditId: string }[] } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const processing = useRef(false);
  const [message, setMessage, messageNotification] = useRepeatableMessage();
  const [actionError, setActionError, errorNotification] = useRepeatableMessage();
  const loader = useCallback(
    (cursor: QueryPageOptions["cursor"]) => listHospitalServices(hospitalId, { pageSize: 20, cursor }),
    [hospitalId],
  );
  const { errorNotification: loadErrorNotification, items, error, isLoading, hasMore, loadMore, patchItem } = usePaginatedList<ServiceDocument>(
    loader,
    "We could not load this hospital's packages. Refresh the page and try again.",
  );
  const orderedItems = useMemo(() => sortPackagesByDuration(items.map(workingPackage)), [items]);
  const pending = items.filter((item) => item.reviewStatus === "pending");
  const selectedPending = pending.filter((item) => selected.includes(item.id));

  function openReview(action: "approve" | "request_changes", ids: string[]) {
    setActionError(null);
    setMessage(null);
    setReason("");
    setReview({ action, packages: pending.filter((item) => ids.includes(item.id)).slice(0, 20).map((item) => ({ id: item.id, auditId: item.lastAuditId })) });
  }
  async function confirmReview() {
    if (!review || processing.current || !review.packages.length) return;
    if (review.action === "request_changes" && !reason.trim()) { setActionError("Enter a reason so the hospital knows what to change."); return; }
    processing.current = true;
    setBusy(true);
    setActionError(null);
    try {
      const saved = await reviewHospitalPackages(hospitalId, review.packages, review.action, reason);
      Object.entries(saved.packages ?? {}).forEach(([id, changes]) => patchItem(id, changes));
      setSelected((current) => current.filter((id) => !review.packages.some((entry) => entry.id === id)));
      setMessage(review.action === "approve" ? "Selected packages approved and published." : "Changes requested. The hospital can edit and resubmit these packages.");
      setReview(null);
    } catch (caught) { setActionError(caught instanceof Error ? caught.message : "We could not save this review."); }
    finally { processing.current = false; setBusy(false); }
  }

  return <section className="portal-detail-section" aria-labelledby="hospital-packages-title">
    <div className="portal-row-heading">
      <div>
        <h2 id="hospital-packages-title">Packages and services</h2>
      </div>
      {!isLoading && <span className="portal-status">{items.length}{hasMore ? "+" : ""} listed</span>}
    </div>
    <p className="portal-form-note">Review the submitted package details below. Approved versions stay public while changes await approval.</p>
    {pending.length > 0 && <div className="portal-card portal-package-review-toolbar">
      <label className="portal-checkbox-label"><input type="checkbox" checked={selectedPending.length === Math.min(pending.length, 20)} disabled={busy} onChange={(event) => setSelected(event.target.checked ? pending.slice(0, 20).map((item) => item.id) : [])} />Select up to 20 pending packages</label>
      <span className="portal-status" data-status="pending">{pending.length}{hasMore ? "+" : ""} pending review</span>
      <button className="portal-button" type="button" disabled={busy || !selectedPending.length} onClick={() => openReview("approve", selectedPending.map((item) => item.id))}>Approve selected ({selectedPending.length})</button>
      <small>Bulk approval applies only to selected packages from this hospital. Load more to review further requests.</small>
    </div>}
    <PortalFeedback
      notification={loadErrorNotification}
      error={error}
      emptyTitle="No packages yet"
      empty={!error && !isLoading && items.length === 0
        ? "This hospital has not added any packages or services yet."
        : undefined}
    />
    <div className="portal-list">
      {orderedItems.map((service) => <article className="portal-row portal-package-review-row" key={service.id}>
        <div>
          {service.reviewStatus === "pending" && <label className="portal-checkbox-label"><input type="checkbox" aria-label={`Select ${packageTitle(service)} for approval`} checked={selected.includes(service.id)} disabled={busy || (!selected.includes(service.id) && selectedPending.length >= 20)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, service.id] : current.filter((id) => id !== service.id))} />Select for approval</label>}
          <h3>{packageTitle(service)}</h3>
          <p><strong>{packageReviewLabel(service)}</strong>{service.draftPackage && hasPublishedPackage(service) ? " · Showing proposed changes; the approved version remains unchanged." : ""}</p>
          {service.reviewNote && <p>Review feedback: {service.reviewNote}</p>}
          <p>{service.description || "No description provided."}</p>
          <div className="portal-card-meta">
            <span>{service.packageDurationDays ? `${service.packageDurationDays} days` : "Legacy service"}</span>
            {typeof service.price === "number" && <span>{formatCurrency(service.price)}</span>}
            <span>{packageProcedureEntries(service).length} procedures</span>
          </div>
          {packageProcedureEntries(service).length > 0 && <ul className="portal-package-summary">{packageProcedureEntries(service).map((procedure) => <li key={procedure.id}>{procedure.label} {procedure.days !== null && <span>{procedure.days} days</span>}</li>)}</ul>}
        </div>
        <span className="portal-status" data-status={service.status}>{formatStatus(service.status)}</span>
        {service.reviewStatus === "pending" && <div className="portal-actions"><button className="portal-button" type="button" disabled={busy} onClick={() => openReview("approve", [service.id])}>Approve package</button><button className="portal-button secondary" type="button" disabled={busy} onClick={() => openReview("request_changes", [service.id])}>Request changes</button></div>}
      </article>)}
    </div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
    <PortalToast message={message} notification={messageNotification} />
    <PortalToast message={actionError} notification={errorNotification} tone="error" />
    <PortalDialog open={Boolean(review)} title={review?.action === "approve" ? "Approve these packages?" : "Request package changes?"} message={review?.action === "approve" ? `${review.packages.length} selected package(s) will be published with the details you reviewed.` : "The draft will be returned to the hospital. Any approved version will remain unchanged."} confirmLabel={review?.action === "approve" ? "Approve and publish" : "Send feedback"} busy={busy} onCancel={() => { if (!processing.current) setReview(null); }} onConfirm={() => void confirmReview()}>
      {review?.action === "request_changes" && <div className="portal-form"><label className="full">Reason for changes<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} required /></label></div>}
      {actionError && <p className="portal-form-error" role="alert">{actionError}</p>}
    </PortalDialog>
  </section>;
}
