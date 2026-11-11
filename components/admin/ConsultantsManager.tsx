"use client";
import { ConsultantSchedule } from "@/components/admin/ConsultantSchedule";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ConsultantDocument } from "@/features/firestore/models";
import type { StatusOrderedCursor } from "@/services/firestore/statusOrderedQuery";
import { CONSULTANT_WEEK_DAYS, CONSULTANT_DAY_LABELS, consultantFormValues, validateConsultantFields, formatConsultantTimeSlot, type ConsultantValidationErrors } from "@/features/consultants/validation";
import { createConsultant, listConsultants, setConsultantStatus, updateConsultant, uploadConsultantPhoto } from "@/services/consultants/consultantService";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalToast } from "@/components/portal/PortalToast";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";
import { ConsultantFormFields } from "@/components/forms/ConsultantFormFields";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { formatStatus } from "@/utils/text";
import { focusFirstInvalidField } from "@/utils/formFocus";
import { formatCurrency } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import { CONSULTATION_SERVICES, consultationService, type ConsultationServiceId } from "@/features/consultations/catalog";
import { orderConsultants } from "@/features/consultants/listOrder";
import { getConsultantPricing } from "@/features/consultants/pricing";
import { ConsultantPhoto } from "@/components/consultants/ConsultantPhoto";
import { ConsultantPhotoUpload } from "@/components/admin/ConsultantPhotoUpload";
import { consultantDisplayName } from "@/features/consultants/name";

export function ConsultantsManager() {
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingSnapshot = useRef<(ConsultantDocument & { id: string }) | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ConsultantValidationErrors>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const saving = useRef(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [actionError, setActionError, actionErrorNotification] = useRepeatableMessage();
  const [message, setMessage, messageNotification] = useRepeatableMessage();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [serviceFilter, setServiceFilter] = useState<"" | ConsultationServiceId>("");
  const deferredSearch = useDeferredValue(searchTerm);
  const loader = useCallback((cursor: StatusOrderedCursor | null) => listConsultants({ pageSize: 20, cursor, status: statusFilter || undefined }, deferredSearch, serviceFilter || undefined), [deferredSearch, statusFilter, serviceFilter]);
  const { errorNotification: loadErrorNotification, items, error: loadError, isLoading, hasMore, reload, loadMore, patchItem, prependItem } = usePaginatedList<ConsultantDocument, StatusOrderedCursor>(loader, "We could not load the consultant list. Refresh and try again.");
  const listView = useRef({ search: deferredSearch, statusFilter, serviceFilter, isLoading, hasMore, reload });
  useEffect(() => { listView.current = { search: deferredSearch, statusFilter, serviceFilter, isLoading, hasMore, reload }; }, [deferredSearch, statusFilter, serviceFilter, isLoading, hasMore, reload]);
  const visibleItems = useMemo(() => orderConsultants(items.filter(item => (!statusFilter || item.status === statusFilter)
    && (!serviceFilter || item.consultationServices?.includes(serviceFilter)))), [items, statusFilter, serviceFilter]);
  const filtered = Boolean(deferredSearch.trim() || statusFilter || serviceFilter);

  function resetEditor() {
    setEditingId(null);
    editingSnapshot.current = null;
    setSelectedPhoto(null);
    setFieldErrors({});
    setActionError(null);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyId || saving.current) return;
    const form = event.currentTarget;
    const validation = validateConsultantFields(consultantFormValues(new FormData(form)));
    setFieldErrors(validation.errors);
    setActionError(null);
    setMessage(null);
    if (!validation.isValid) {
      setActionError("Please check the highlighted consultant details.");
      focusFirstInvalidField(form);
      return;
    }
    saving.current = true;
    setBusyId("create");
    try {
      const { employeeId, consultant: created } = await createConsultant(validation.data);
      let photoError: string | null = null;
      if (selectedPhoto) {
        try { await uploadConsultantPhoto(employeeId, selectedPhoto); }
        catch (caught) { photoError = caught instanceof Error ? caught.message : "The photo could not be saved."; }
      }
      form.reset();
      setSelectedPhoto(null);
      setShowCreateForm(false);
      setFieldErrors({});
      const view = listView.current;
      if (created && !selectedPhoto && !view.search.trim() && !view.statusFilter && !view.serviceFilter && !view.hasMore && !view.isLoading) prependItem(created);
      else await view.reload();
      if (photoError) setActionError(`${employeeId} was added, but the photo could not be saved. Do not add the consultant again. Click Edit on their card to check the photo before trying again. ${photoError}`);
      else setMessage(`${employeeId} has been added to Our Consultants.`);
    } catch (caught) {
      if (caught instanceof Error && "status" in caught && caught.status === 409) {
        setFieldErrors({ email: caught.message });
        focusFirstInvalidField(form);
      }
      setActionError(caught instanceof Error ? caught.message : "We could not add the consultant. Try again.");
    } finally {
      setBusyId(null);
      saving.current = false;
    }
  }

  async function edit(event: FormEvent<HTMLFormElement>, consultant: ConsultantDocument & { id: string }) {
    event.preventDefault();
    if (busyId || saving.current) return;
    const form = event.currentTarget;
    const validation = validateConsultantFields(consultantFormValues(new FormData(form)));
    setFieldErrors(validation.errors);
    setActionError(null);
    setMessage(null);
    if (!validation.isValid) {
      setActionError("Please check the highlighted consultant details.");
      focusFirstInvalidField(form);
      return;
    }
    saving.current = true;
    setBusyId(consultant.id);
    try {
      const original = editingSnapshot.current?.id === consultant.id ? editingSnapshot.current : consultant;
      const saved = await updateConsultant(consultant.id, validation.data, original);
      let imageUrl = consultant.imageUrl;
      let photoError: string | null = null;
      if (selectedPhoto) {
        try { imageUrl = await uploadConsultantPhoto(consultant.id, selectedPhoto, consultant.imageUrl); }
        catch (caught) { photoError = caught instanceof Error ? caught.message : "The photo could not be saved."; }
      }
      if (filtered || selectedPhoto || photoError) await reload();
      else patchItem(consultant.id, { ...validation.data, lastAuditId: saved.lastAuditId, ...(imageUrl !== undefined ? { imageUrl } : {}) });
      resetEditor();
      if (photoError) setActionError(`${consultant.employeeId}'s details were saved, but the photo could not be confirmed. Click Edit to check the photo before trying again. ${photoError}`);
      else setMessage(`${consultant.employeeId} has been updated.`);
    } catch (caught) {
      if (caught instanceof Error && "status" in caught && caught.status === 409) {
        setFieldErrors({ email: caught.message });
        focusFirstInvalidField(form);
      }
      setActionError(caught instanceof Error ? caught.message : "We could not update the consultant. Try again.");
    } finally {
      setBusyId(null);
      saving.current = false;
    }
  }

  async function toggleStatus(consultant: ConsultantDocument & { id: string }) {
    if (busyId || saving.current) return;
    const nextStatus = consultant.status === "active" ? "inactive" : "active";
    saving.current = true;
    setBusyId(consultant.id);
    setActionError(null);
    setMessage(null);
    try {
      const saved = await setConsultantStatus(consultant.id, nextStatus, consultant);
      if (statusFilter || hasMore) await reload();
      else patchItem(consultant.id, { status: nextStatus, lastAuditId: saved.lastAuditId });
      setMessage(`${consultant.employeeId} is now ${nextStatus}.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not change the consultant status. Try again.");
    } finally {
      setBusyId(null);
      saving.current = false;
    }
  }

  const error = actionError ?? loadError;
  return <PortalShell role="admin" title="Our Consultants">
    <PortalLoadGuard notification={loadErrorNotification} loading={isLoading} error={loadError} hasData={items.length > 0} fallbackHref="/admin" loadingMessage="Loading consultants..." />
    <div className="portal-actions portal-page-actions"><button className="portal-button" type="button" disabled={Boolean(busyId)} aria-expanded={showCreateForm} onClick={() => {
      setShowCreateForm((current) => !current);
      resetEditor();
      setMessage(null);
    }}>{showCreateForm ? "Close form" : "Add New"}</button></div>

    {showCreateForm && <form className="portal-card portal-form" onSubmit={create} noValidate>
      <p className="full portal-form-note">Complete the fields marked *. We’ll assign a consultant ID when you save.</p>
      <ConsultantFormFields errors={fieldErrors} />
      <ConsultantPhotoUpload file={selectedPhoto} disabled={Boolean(busyId)} onChange={setSelectedPhoto} />
      <div className="portal-actions full"><button className="portal-button" disabled={Boolean(busyId)}>{busyId === "create" ? "Adding..." : "Add consultant"}</button><button className="portal-button secondary" type="button" disabled={Boolean(busyId)} onClick={() => { setShowCreateForm(false); setSelectedPhoto(null); setFieldErrors({}); setActionError(null); }}>Cancel</button></div>
    </form>}

    <section className="portal-consultant-filters" aria-label="Consultant filters">
      <label className="portal-filter-field">Search consultants
        <input type="search" value={searchTerm} disabled={Boolean(busyId)} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by name or employee ID" autoComplete="off" />
      </label>
      <label className="portal-filter-field">Status<select value={statusFilter} disabled={Boolean(busyId)} onChange={event => { setStatusFilter(event.target.value as typeof statusFilter); resetEditor(); setScheduleId(null); }}>
        <option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
      </select></label>
      <label className="portal-filter-field">Online service<select value={serviceFilter} disabled={Boolean(busyId)} onChange={event => { setServiceFilter(event.target.value as typeof serviceFilter); resetEditor(); setScheduleId(null); }}>
        <option value="">All services</option>{CONSULTATION_SERVICES.map(service => <option key={service.id} value={service.id}>{service.label}</option>)}
      </select></label>
      <button className="portal-button secondary" type="button" disabled={Boolean(busyId) || !(searchTerm || statusFilter || serviceFilter)} onClick={() => { setSearchTerm(""); setStatusFilter(""); setServiceFilter(""); resetEditor(); setScheduleId(null); }}>Clear filters</button>
    </section>

    <PortalFeedback error={error} notification={actionError ? actionErrorNotification : loadErrorNotification} emptyTitle={filtered ? "No matching consultants" : "No consultants yet"} empty={!error && !isLoading && visibleItems.length === 0 ? (filtered ? "No consultants match these filters. Change or clear the filters to try again." : "Select Add New to create the first consultant record.") : undefined} />
    <PortalToast message={message} notification={messageNotification} />
    {scheduleId && <ConsultantSchedule key={scheduleId} consultantId={scheduleId} services={items.find(item => item.id === scheduleId)?.consultationServices ?? []} onClose={() => setScheduleId(null)} />}
    <div className="portal-list consultant-list admin-record-grid portal-record-grid" aria-busy={isLoading}>{visibleItems.map((consultant) => <article className="portal-card" key={consultant.id} data-editing={editingId === consultant.id}>
      <div className="portal-row-heading"><div className="consultant-profile-heading"><ConsultantPhoto name={consultantDisplayName(consultant)} imageUrl={consultant.imageUrl} /><div><h3>{consultantDisplayName(consultant)}</h3>{consultant.designation && <p>{consultant.designation}</p>}<strong className="consultant-employee-id">{consultant.employeeId}</strong></div></div><span className="portal-status" data-status={consultant.status}>{formatStatus(consultant.status)}</span></div>
      {editingId === consultant.id ? <form className="portal-form portal-edit-form" onSubmit={(event) => void edit(event, consultant)} noValidate>
        <ConsultantFormFields key={`fields-${consultant.id}`} defaultValues={consultant} errors={fieldErrors} />
        <ConsultantPhotoUpload key={`photo-${consultant.id}`} file={selectedPhoto} imageUrl={consultant.imageUrl} disabled={Boolean(busyId)} onChange={setSelectedPhoto} />
        <div className="portal-actions full"><button className="portal-button" disabled={busyId === consultant.id}>{busyId === consultant.id ? "Saving..." : "Save changes"}</button><button className="portal-button secondary" type="button" disabled={busyId === consultant.id} onClick={resetEditor}>Cancel</button></div>
      </form> : <>
        <dl className="consultant-details">
          <div className="consultant-detail-wide"><dt>Preferred days</dt><dd>{consultant.preferredDays?.length ? CONSULTANT_WEEK_DAYS.filter((day) => consultant.preferredDays?.includes(day)).map((day) => CONSULTANT_DAY_LABELS[day]).join(" · ") : "Days not specified"}</dd></div>
          {Boolean(consultant.availableDates?.length) && <div className="consultant-detail-wide"><dt>Available dates</dt><dd>{consultant.availableDates?.map((date) => formatDisplayDate(date)).join(", ")}</dd></div>}
          <div className="consultant-detail-wide"><dt>Preferred availability</dt><dd>{consultant.preferredTimeSlots?.length ? consultant.preferredTimeSlots.map((slot) => <span className="consultant-slot" key={slot}>{formatConsultantTimeSlot(slot, consultant.preferredSlotTimings)}</span>) : "Not specified"}</dd></div>
          <div><dt>Email</dt><dd>{consultant.email}</dd></div>
          <div><dt>Contact number</dt><dd>{consultant.contactNo}</dd></div>
          <div><dt>WhatsApp number</dt><dd>{consultant.whatsappNo}</dd></div>
          <div><dt>Qualification</dt><dd>{consultant.qualification}</dd></div>
          <div><dt>Experience</dt><dd>{consultant.yearsExperience} years</dd></div>
          <div><dt>Consultant Charge</dt><dd>{consultant.consultantCharge != null ? formatCurrency(consultant.consultantCharge) : "Not specified"}</dd></div>
          <div><dt>Ayursarga Commission</dt><dd>{consultant.ayursargaCommissionPercentage != null ? `${consultant.ayursargaCommissionPercentage}%` : "Not specified"}</dd></div>
          <div><dt>Consumer total</dt><dd>{(() => {
            const pricing = getConsultantPricing(consultant.consultantCharge, consultant.ayursargaCommissionPercentage ?? 0);
            return pricing ? formatCurrency(pricing.totalCharge) : "Not specified";
          })()}</dd></div>
          <div className="consultant-detail-wide"><dt>Online services</dt><dd>{consultant.consultationServices?.length ? consultant.consultationServices.map((id) => consultationService(id)?.label).filter(Boolean).join(" · ") : "Not assigned"}</dd></div>
          {consultant.lastWorkedCompany && <div><dt>Previous Hospital</dt><dd>{consultant.lastWorkedCompany}</dd></div>}
          {consultant.address && <div className="consultant-detail-wide"><dt>Address</dt><dd>{consultant.address}</dd></div>}
          {consultant.emergencyContactNo && <div><dt>Emergency contact</dt><dd>{consultant.emergencyContactNo}</dd></div>}
        </dl>
        <div className="portal-actions consultant-card-actions">
          <button className="portal-button secondary" type="button" disabled={Boolean(busyId)} onClick={() => { editingSnapshot.current = consultant; setEditingId(consultant.id); setSelectedPhoto(null); setShowCreateForm(false); setFieldErrors({}); setActionError(null); setMessage(null); }}>Edit</button>
          <button className={`portal-button${consultant.status === "active" ? " danger" : ""}`} type="button" disabled={Boolean(busyId)} onClick={() => void toggleStatus(consultant)}>{consultant.status === "active" ? "Make inactive" : "Make active"}</button>
          <button className="portal-button secondary consultant-card-schedule-action" type="button" onClick={() => setScheduleId(consultant.id)}>View appointment slots</button>
        </div>
      </>}
    </article>)}</div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
