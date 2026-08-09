"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useState, type FormEvent } from "react";
import type { HospitalDocument } from "@/features/firestore/models";
import type { QueryPageOptions } from "@/services/firestore/firestoreService";
import { createHospital, listAllHospitals } from "@/services/hospitals/hospitalService";
import { hospitalFormValues, validateHospitalFields, type HospitalField, type HospitalValidationErrors } from "@/features/hospitals/validation";
import { useAuth } from "@/hooks/useAuth";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { formatStatus } from "@/utils/text";
import { IndiaStateSelect } from "@/components/forms/IndiaStateSelect";

function FieldError({ field, errors }: { field: HospitalField; errors: HospitalValidationErrors }) {
  return errors[field] ? <span className="portal-field-error" role="alert">{errors[field]}</span> : null;
}

export function HospitalsManager() {
  const { firebaseUser } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<HospitalValidationErrors>({});
  const [busy, setBusy] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => listAllHospitals({ pageSize: 20, cursor }, deferredSearch), [deferredSearch]);
  const { items, error: loadError, isLoading, hasMore, reload, loadMore } = usePaginatedList<HospitalDocument>(loader, "We could not load the hospital list. Refresh the page and try again.");
  const error = actionError ?? loadError;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser) return;
    const form = event.currentTarget;
    const validation = validateHospitalFields(hospitalFormValues(new FormData(form)));
    setFieldErrors(validation.errors);
    setActionError(null);
    if (!validation.isValid) {
      setActionError("Please check the highlighted fields, then try creating the hospital again.");
      return;
    }

    setBusy(true);
    try {
      await createHospital(validation.data, firebaseUser.uid);
      form.reset();
      setFieldErrors({});
      await reload();
      setShowCreateForm(false);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not create the hospital. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <PortalShell role="admin" title="Hospitals">
    <div className="portal-actions portal-page-actions">
      <button
        className="portal-button"
        type="button"
        aria-expanded={showCreateForm}
        aria-controls="add-hospital-form"
        onClick={() => {
          setShowCreateForm((visible) => !visible);
          setActionError(null);
          setFieldErrors({});
        }}
      >{showCreateForm ? "Close form" : "Add Hospital"}</button>
    </div>

    {showCreateForm && <form id="add-hospital-form" className="portal-card portal-form" onSubmit={submit} noValidate style={{ marginBottom: 26 }}>
      <p className="full portal-form-note">Complete every field marked with * before creating the hospital.</p>
      <label>Hospital name *<input name="name" required minLength={2} maxLength={120} aria-invalid={Boolean(fieldErrors.name)} /><FieldError field="name" errors={fieldErrors} /></label>
      <label>Official email *<input name="email" type="email" required maxLength={160} aria-invalid={Boolean(fieldErrors.email)} /><FieldError field="email" errors={fieldErrors} /></label>
      <label>Phone *<input name="phone" type="tel" required minLength={7} maxLength={25} aria-invalid={Boolean(fieldErrors.phone)} /><FieldError field="phone" errors={fieldErrors} /></label>
      <label>City / locality *<input name="city" required minLength={2} maxLength={80} aria-invalid={Boolean(fieldErrors.city)} /><FieldError field="city" errors={fieldErrors} /></label>
      <label>State *<IndiaStateSelect name="state" required aria-invalid={Boolean(fieldErrors.state)} /><FieldError field="state" errors={fieldErrors} /></label>
      <label>Commission % *<input name="commission" type="number" min="0" max="100" step="0.01" required aria-invalid={Boolean(fieldErrors.commissionPercentage)} /><FieldError field="commissionPercentage" errors={fieldErrors} /></label>
      <label className="full">Complete address *<input name="address" required minLength={10} maxLength={300} aria-invalid={Boolean(fieldErrors.address)} /><FieldError field="address" errors={fieldErrors} /></label>
      <label className="full">Description<textarea name="description" maxLength={2000} aria-invalid={Boolean(fieldErrors.description)} /><FieldError field="description" errors={fieldErrors} /></label>
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

    <PortalFeedback error={error} empty={!error && !isLoading && items.length === 0 ? "No hospitals yet. Select Add Hospital to create the first one." : undefined} />
    <div className="portal-list">{items.map((item) => <article className="portal-card" key={item.id}>
      <div className="portal-row-heading"><h3>{item.name}</h3><span className="portal-status" data-status={item.status}>{formatStatus(item.status)}</span></div>
      <p>{item.city}, {item.state} · Commission {item.commissionPercentage}% · {item.isPublic ? "Public" : "Private"}</p>
      <div className="portal-actions">
        <Link className="portal-button" href={`/admin/hospitals/${encodeURIComponent(item.id)}`}>View details</Link>
      </div>
    </article>)}</div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
