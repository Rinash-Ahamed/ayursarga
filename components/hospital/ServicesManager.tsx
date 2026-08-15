"use client";

import { useCallback, useState, type FormEvent } from "react";
import type { ServiceDocument } from "@/features/firestore/models";
import { emptyQueryPage, type DocumentRecord, type QueryPageOptions } from "@/services/firestore/firestoreService";
import { archiveService, createService, listHospitalServices, updateService } from "@/services/hospitals/serviceService";
import { formatCurrency } from "@/utils/currency";
import { durationToMinutes, durationValueFromMinutes, formatServiceDuration, inferDurationUnit, isDurationUnit } from "@/utils/duration";
import { formatStatus } from "@/utils/text";
import { useAuth } from "@/hooks/useAuth";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";

type ServiceValues = Pick<ServiceDocument, "name" | "description" | "price" | "durationMinutes" | "durationUnit">;

function readServiceValues(form: HTMLFormElement): ServiceValues {
  const data = new FormData(form);
  const name = String(data.get("name") ?? "").trim();
  const description = String(data.get("description") ?? "").trim();
  const priceText = String(data.get("price") ?? "").trim();
  const durationText = String(data.get("duration") ?? "").trim();
  const durationUnit = data.get("durationUnit");
  if (name.length < 2) throw new Error("Enter a service name with at least 2 characters.");
  if (!description) throw new Error("Enter a description for this service.");
  if (!priceText || !Number.isFinite(Number(priceText)) || Number(priceText) < 0) throw new Error("Enter a valid service price.");
  if (!isDurationUnit(durationUnit)) throw new Error("Choose minutes, hours, or days for the duration.");
  return {
    name,
    description,
    price: Number(priceText),
    durationMinutes: durationText ? durationToMinutes(Number(durationText), durationUnit) : null,
    durationUnit: durationText ? durationUnit : null,
  };
}

function ServiceFields({ service }: { service?: DocumentRecord<ServiceDocument> }) {
  const durationUnit = service?.durationUnit
    ?? (service?.durationMinutes ? inferDurationUnit(service.durationMinutes) : "minutes");
  const duration = service?.durationMinutes
    ? durationValueFromMinutes(service.durationMinutes, durationUnit)
    : "";
  return <>
    <label>Service name<input name="name" defaultValue={service?.name ?? ""} required /></label>
    <label>Price (INR)<input name="price" type="number" min="0" step="0.01" defaultValue={service?.price ?? ""} required /></label>
    <label>Duration amount<input name="duration" type="number" min="0.01" step="0.01" defaultValue={duration} placeholder="Optional" /></label>
    <label>Duration unit<select name="durationUnit" defaultValue={durationUnit}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></label>
    <label className="full">Description<textarea name="description" defaultValue={service?.description ?? ""} required /></label>
  </>;
}

export function ServicesManager() {
  const { userProfile } = useAuth();
  const hospitalId = userProfile?.hospitalId;
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDebouncedValue(search.trim(), 300);
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => hospitalId
    ? listHospitalServices(hospitalId, { pageSize: 20, cursor }, deferredSearch)
    : Promise.resolve(emptyQueryPage<ServiceDocument>()), [deferredSearch, hospitalId]);
  const { items, error: loadError, isLoading, hasMore, reload, loadMore, patchItem, removeItem } = usePaginatedList<ServiceDocument>(
    loader,
    "We could not load your services. Refresh the page and try again.",
  );

  function beginAction(id: string) {
    setBusyId(id);
    setActionError(null);
    setActionMessage(null);
  }

  async function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hospitalId) return;
    const form = event.currentTarget;
    beginAction("create");
    try {
      await createService({ hospitalId, ...readServiceValues(form), status: "active" });
      form.reset();
      await reload();
      setActionMessage("The service has been added.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not add the service. Check the details and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function saveService(event: FormEvent<HTMLFormElement>, item: DocumentRecord<ServiceDocument>) {
    event.preventDefault();
    beginAction(item.id);
    try {
      const changes = readServiceValues(event.currentTarget);
      await updateService(item.id, changes, item);
      patchItem(item.id, changes);
      setEditingId(null);
      setActionMessage("The complete service details have been updated.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not save the service changes. Check the details and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(item: DocumentRecord<ServiceDocument>) {
    const status = item.status === "active" ? "inactive" : "active";
    beginAction(item.id);
    try {
      await updateService(item.id, { status }, item);
      patchItem(item.id, { status });
      setActionMessage(`The service is now ${status}.`);
    } catch {
      setActionError("We could not change this service's status. Refresh the page and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeService(item: DocumentRecord<ServiceDocument>) {
    if (!window.confirm(`Delete “${item.name}” from normal service views? Its history will remain safely archived.`)) return;
    beginAction(item.id);
    try {
      await archiveService(item.id, item);
      removeItem(item.id);
      if (editingId === item.id) setEditingId(null);
      setActionMessage("The service has been deleted from normal views and safely archived.");
    } catch {
      setActionError("We could not delete this service. Refresh the page and try again.");
    } finally {
      setBusyId(null);
    }
  }

  return <PortalShell role="hospital" title="Services">
    <PortalLoadGuard loading={isLoading} error={loadError} hasData={items.length > 0} fallbackHref="/hospital" loadingMessage="Loading hospital services…" />
    <form className="portal-card portal-form portal-service-form" onSubmit={addService} noValidate>
      <ServiceFields />
      <div className="portal-actions full"><button className="portal-button" disabled={busyId !== null}>{busyId === "create" ? "Adding..." : "Add service"}</button></div>
    </form>
    <label className="portal-search">Search services
      <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by service name" autoComplete="off" />
    </label>
    <PortalFeedback error={items.length > 0 ? loadError : null} empty={!loadError && !isLoading && items.length === 0 ? (deferredSearch ? "No services match this search." : "No services yet. Complete the form above to add your first service.") : undefined} />
    <PortalToast message={actionMessage} />
    <PortalToast message={actionError} tone="error" />
    <div className="portal-list">
      {items.map((item) => editingId === item.id
        ? <article className="portal-card portal-service-edit" key={item.id}>
          <div className="portal-row-heading"><div><span className="portal-eyebrow">Editing service</span><h2>{item.name}</h2></div><span className="portal-status portal-service-status" data-status={item.status}>{formatStatus(item.status)}</span></div>
          <form className="portal-form" onSubmit={(event) => void saveService(event, item)} noValidate>
            <ServiceFields service={item} />
            <div className="portal-actions full"><button className="portal-button" disabled={busyId !== null}>{busyId === item.id ? "Saving..." : "Save all changes"}</button><button className="portal-button secondary" type="button" disabled={busyId !== null} onClick={() => setEditingId(null)}>Cancel</button></div>
          </form>
        </article>
        : <article className="portal-row portal-service-row" key={item.id}>
          <div><h3>{item.name}</h3><p>{formatCurrency(item.price)} · {formatServiceDuration(item.durationMinutes, item.durationUnit)}</p><p>{item.description}</p></div>
          <div className="portal-service-controls"><span className="portal-status portal-service-status" data-status={item.status}>{formatStatus(item.status)}</span><div className="portal-actions"><button className="portal-button secondary" type="button" disabled={busyId !== null} onClick={() => { setEditingId(item.id); setActionError(null); setActionMessage(null); }}>Edit details</button><button className="portal-button secondary" type="button" disabled={busyId !== null} onClick={() => void toggleStatus(item)}>{item.status === "active" ? "Deactivate" : "Activate"}</button><button className="portal-button danger" type="button" disabled={busyId !== null} onClick={() => void removeService(item)}>Delete</button></div></div>
        </article>)}
    </div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
