"use client";

import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import type { HospitalDocument } from "@/features/firestore/models";
import type { DocumentRecord, QueryPageOptions } from "@/services/firestore/firestoreService";
import { createHospital, listAllHospitals, updateHospital } from "@/services/hospitals/hospitalService";
import { hospitalFormValues, validateHospitalFields, type HospitalField, type HospitalValidationErrors } from "@/features/hospitals/validation";
import { useAuth } from "@/hooks/useAuth";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { formatStatus } from "@/utils/text";

function FieldError({ field, errors }: { field: HospitalField; errors: HospitalValidationErrors }) {
  return errors[field] ? <span className="portal-field-error" role="alert">{errors[field]}</span> : null;
}

export function HospitalsManager() {
  const { firebaseUser } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<HospitalValidationErrors>({});
  const [busy, setBusy] = useState(false);
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => listAllHospitals({ pageSize: 20, cursor }), []);
  const { items, error: loadError, isLoading, hasMore, reload, loadMore, patchItem } = usePaginatedList<HospitalDocument>(loader, "Hospitals could not be loaded.");
  const error = actionError ?? loadError;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser) return;
    const form = event.currentTarget;
    const validation = validateHospitalFields(hospitalFormValues(new FormData(form)));
    setFieldErrors(validation.errors);
    setActionError(null);
    if (!validation.isValid) {
      setActionError("Review the highlighted hospital details before creating the record.");
      return;
    }

    setBusy(true);
    try {
      await createHospital(validation.data, firebaseUser.uid);
      form.reset();
      setFieldErrors({});
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Hospital could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function change(item: DocumentRecord<HospitalDocument>, changes: Partial<HospitalDocument>) {
    setBusy(true);
    setActionError(null);
    try {
      await updateHospital(item.id, changes, item);
      patchItem(item.id, changes);
    } catch {
      setActionError("Hospital could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  function setCommission(item: DocumentRecord<HospitalDocument>) {
    const value = window.prompt("Commission percentage (0 to 100)", String(item.commissionPercentage));
    if (value === null) return;
    const commissionPercentage = Number(value);
    if (!Number.isFinite(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) {
      setActionError("Commission must be between 0 and 100 percent.");
      return;
    }
    void change(item, { commissionPercentage });
  }

  return <PortalShell role="admin" title="Hospitals">
    <form className="portal-card portal-form" onSubmit={submit} noValidate style={{ marginBottom: 26 }}>
      <p className="full portal-form-note">Fields marked * are mandatory.</p>
      <label>Hospital name *<input name="name" required minLength={2} maxLength={120} aria-invalid={Boolean(fieldErrors.name)} /><FieldError field="name" errors={fieldErrors} /></label>
      <label>Official email *<input name="email" type="email" required maxLength={160} aria-invalid={Boolean(fieldErrors.email)} /><FieldError field="email" errors={fieldErrors} /></label>
      <label>Phone *<input name="phone" type="tel" required minLength={7} maxLength={25} aria-invalid={Boolean(fieldErrors.phone)} /><FieldError field="phone" errors={fieldErrors} /></label>
      <label>City / locality *<input name="city" required minLength={2} maxLength={80} aria-invalid={Boolean(fieldErrors.city)} /><FieldError field="city" errors={fieldErrors} /></label>
      <label>State *<input name="state" required minLength={2} maxLength={80} aria-invalid={Boolean(fieldErrors.state)} /><FieldError field="state" errors={fieldErrors} /></label>
      <label>Commission % *<input name="commission" type="number" min="0" max="100" step="0.01" required aria-invalid={Boolean(fieldErrors.commissionPercentage)} /><FieldError field="commissionPercentage" errors={fieldErrors} /></label>
      <label className="full">Complete address *<input name="address" required minLength={10} maxLength={300} aria-invalid={Boolean(fieldErrors.address)} /><FieldError field="address" errors={fieldErrors} /></label>
      <label className="full">Description<textarea name="description" maxLength={2000} aria-invalid={Boolean(fieldErrors.description)} /><FieldError field="description" errors={fieldErrors} /></label>
      <div className="portal-actions full"><button className="portal-button" disabled={busy}>{busy ? "Creating..." : "Create hospital"}</button></div>
    </form>

    <PortalFeedback error={error} empty={!error && !isLoading && items.length === 0 ? "No hospitals have been created." : undefined} />
    <div className="portal-list">{items.map((item) => <article className="portal-card" key={item.id}>
      <div className="portal-row-heading"><h3>{item.name}</h3><span className="portal-status">{formatStatus(item.status)}</span></div>
      <p>{item.city}, {item.state} · Commission {item.commissionPercentage}% · {item.isPublic ? "Public" : "Private"}</p>
      <div className="portal-actions">
        <Link className="portal-button" href={`/admin/hospitals/${encodeURIComponent(item.id)}`}>View details</Link>
        <button className="portal-button secondary" type="button" disabled={busy} onClick={() => setCommission(item)}>Set commission</button>
      </div>
    </article>)}</div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
