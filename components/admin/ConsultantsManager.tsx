"use client";

import { useCallback, useDeferredValue, useState, type FormEvent } from "react";
import type { ConsultantDocument } from "@/features/firestore/models";
import type { QueryPageOptions } from "@/services/firestore/firestoreService";
import { consultantFormValues, validateConsultantFields, type ConsultantValidationErrors } from "@/features/consultants/validation";
import { createConsultant, listConsultants, setConsultantStatus, updateConsultant } from "@/services/consultants/consultantService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalToast } from "@/components/portal/PortalToast";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";
import { ConsultantFormFields } from "@/components/forms/ConsultantFormFields";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { formatStatus } from "@/utils/text";

export function ConsultantsManager() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ConsultantValidationErrors>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useRepeatableMessage();
  const [message, setMessage] = useRepeatableMessage();
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => listConsultants({ pageSize: 20, cursor }, deferredSearch), [deferredSearch]);
  const { items, error: loadError, isLoading, hasMore, reload, loadMore } = usePaginatedList<ConsultantDocument>(loader, "We could not load the consultant list. Refresh and try again.");

  function resetEditor() {
    setEditingId(null);
    setFieldErrors({});
    setActionError(null);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const validation = validateConsultantFields(consultantFormValues(new FormData(form)));
    setFieldErrors(validation.errors);
    setActionError(null);
    setMessage(null);
    if (!validation.isValid) {
      setActionError("Please check the highlighted consultant details.");
      return;
    }
    setBusyId("create");
    try {
      const employeeId = await createConsultant(validation.data);
      form.reset();
      setShowCreateForm(false);
      setFieldErrors({});
      await reload();
      setMessage(`${employeeId} has been added to Our Consultants.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not add the consultant. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function edit(event: FormEvent<HTMLFormElement>, consultant: ConsultantDocument & { id: string }) {
    event.preventDefault();
    const validation = validateConsultantFields(consultantFormValues(new FormData(event.currentTarget)));
    setFieldErrors(validation.errors);
    setActionError(null);
    setMessage(null);
    if (!validation.isValid) {
      setActionError("Please check the highlighted consultant details.");
      return;
    }
    setBusyId(consultant.id);
    try {
      await updateConsultant(consultant.id, validation.data, consultant);
      await reload();
      resetEditor();
      setMessage(`${consultant.employeeId} has been updated.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not update the consultant. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(consultant: ConsultantDocument & { id: string }) {
    const nextStatus = consultant.status === "active" ? "inactive" : "active";
    setBusyId(consultant.id);
    setActionError(null);
    setMessage(null);
    try {
      await setConsultantStatus(consultant.id, nextStatus, consultant);
      await reload();
      setMessage(`${consultant.employeeId} is now ${nextStatus}.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not change the consultant status. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  const error = actionError ?? loadError;
  return <PortalShell role="admin" title="Our Consultants">
    <PortalLoadGuard loading={isLoading} error={loadError} hasData={items.length > 0} fallbackHref="/admin" loadingMessage="Loading consultants..." />
    <div className="portal-actions portal-page-actions"><button className="portal-button" type="button" aria-expanded={showCreateForm} onClick={() => {
      setShowCreateForm((current) => !current);
      resetEditor();
      setMessage(null);
    }}>{showCreateForm ? "Close form" : "Add New"}</button></div>

    {showCreateForm && <form className="portal-card portal-form" onSubmit={create} noValidate>
      <p className="full portal-form-note">Fields marked * are mandatory. The employee ID is generated automatically after saving.</p>
      <ConsultantFormFields errors={fieldErrors} />
      <div className="portal-actions full"><button className="portal-button" disabled={busyId === "create"}>{busyId === "create" ? "Adding..." : "Add consultant"}</button><button className="portal-button secondary" type="button" disabled={busyId === "create"} onClick={() => { setShowCreateForm(false); setFieldErrors({}); setActionError(null); }}>Cancel</button></div>
    </form>}

    <label className="portal-search">Search consultants
      <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by name or employee ID" autoComplete="off" />
    </label>

    <PortalFeedback error={error} empty={!error && !isLoading && items.length === 0 ? (deferredSearch.trim() ? "No consultants match your search." : "No consultants have been added yet.") : undefined} />
    <PortalToast message={message} />
    <div className="portal-list consultant-list">{items.map((consultant) => <article className="portal-card" key={consultant.id}>
      <div className="portal-row-heading"><div><h3>{consultant.name}</h3><strong className="consultant-employee-id">{consultant.employeeId}</strong></div><span className="portal-status" data-status={consultant.status}>{formatStatus(consultant.status)}</span></div>
      {editingId === consultant.id ? <form className="portal-form portal-edit-form" onSubmit={(event) => void edit(event, consultant)} noValidate>
        <ConsultantFormFields key={consultant.id} defaultValues={consultant} errors={fieldErrors} />
        <div className="portal-actions full"><button className="portal-button" disabled={busyId === consultant.id}>{busyId === consultant.id ? "Saving..." : "Save changes"}</button><button className="portal-button secondary" type="button" disabled={busyId === consultant.id} onClick={resetEditor}>Cancel</button></div>
      </form> : <>
        <dl className="consultant-details">
          <div><dt>Email</dt><dd>{consultant.email}</dd></div>
          <div><dt>Contact number</dt><dd>{consultant.contactNo}</dd></div>
          <div><dt>WhatsApp number</dt><dd>{consultant.whatsappNo}</dd></div>
          <div><dt>Qualification</dt><dd>{consultant.qualification}</dd></div>
          <div><dt>Experience</dt><dd>{consultant.yearsExperience} years</dd></div>
          {consultant.lastWorkedCompany && <div><dt>Last worked at</dt><dd>{consultant.lastWorkedCompany}</dd></div>}
          {consultant.address && <div className="consultant-detail-wide"><dt>Address</dt><dd>{consultant.address}</dd></div>}
          {consultant.emergencyContactNo && <div><dt>Emergency contact</dt><dd>{consultant.emergencyContactNo}</dd></div>}
        </dl>
        <div className="portal-actions"><button className="portal-button secondary" type="button" disabled={Boolean(busyId)} onClick={() => { setEditingId(consultant.id); setShowCreateForm(false); setFieldErrors({}); setActionError(null); setMessage(null); }}>Edit</button><button className="portal-button secondary" type="button" disabled={Boolean(busyId)} onClick={() => void toggleStatus(consultant)}>{consultant.status === "active" ? "Make inactive" : "Make active"}</button></div>
      </>}
    </article>)}</div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
