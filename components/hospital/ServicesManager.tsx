"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import type { ServiceDocument } from "@/features/firestore/models";
import { emptyQueryPage, type DocumentRecord, type QueryPageOptions } from "@/services/firestore/firestoreService";
import { archiveService, createService, listHospitalServices, updateService } from "@/services/hospitals/serviceService";
import {
  PACKAGE_DURATIONS,
  PACKAGE_PROCEDURE_GROUPS,
  packageProcedureEntries,
  packageTitle,
  readPackageForm,
} from "@/features/hospitals/packages";
import { formatStatus } from "@/utils/text";
import { useAuth } from "@/hooks/useAuth";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";
import { PortalDialog } from "@/components/portal/PortalDialog";

type UsedProcedureMap = Map<string, string[]>;

function PackageFields({ service, usedIn }: { service?: DocumentRecord<ServiceDocument>; usedIn: UsedProcedureMap }) {
  const initialSelected = Object.keys(service?.procedures ?? {});
  if (service?.otherProcedureName) initialSelected.push("other");
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const [duration, setDuration] = useState<number>(service?.packageDurationDays ?? PACKAGE_DURATIONS[0]);

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return <>
    <label className="full">Package duration
      <select name="packageDurationDays" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
        {PACKAGE_DURATIONS.map((days) => <option value={days} key={days}>{days} days</option>)}
      </select>
    </label>
    <fieldset className="portal-package-procedures full">
      <legend>Included procedures</legend>
      <p className="portal-form-note">Select each procedure included in this package and enter how many days it will be provided.</p>
      <div className="portal-package-procedure-groups">
        {PACKAGE_PROCEDURE_GROUPS.map((group, groupIndex) => <section key={`${group.title ?? "general"}-${groupIndex}`}>
          {group.title && <h3>{group.title}</h3>}
          <div className="portal-package-procedure-list">
            {group.options.map(([id, label]) => {
              const includedElsewhere = usedIn.get(id) ?? [];
              const checked = selected.has(id);
              return <label className="portal-package-procedure" data-selected={checked || undefined} key={id}>
                <span className="portal-package-procedure-choice">
                  <input type="checkbox" name={`procedure_${id}`} checked={checked} onChange={(event) => toggle(id, event.target.checked)} />
                  <span><strong>{label}</strong>{includedElsewhere.length > 0 && <small>Also in {includedElsewhere.join(", ")}</small>}</span>
                </span>
                <span className="portal-package-days"><input type="number" name={`procedureDays_${id}`} min="1" max={duration} step="1" defaultValue={service?.procedures?.[id] ?? ""} disabled={!checked} required={checked} aria-label={`Number of days for ${label}`} /><small>days</small></span>
              </label>;
            })}
          </div>
        </section>)}
        <section>
          <h3>Other procedure</h3>
          <label className="portal-package-procedure portal-package-procedure-other" data-selected={selected.has("other") || undefined}>
            <span className="portal-package-procedure-choice">
              <input type="checkbox" name="procedure_other" checked={selected.has("other")} onChange={(event) => toggle("other", event.target.checked)} />
              <span><strong>Others</strong><small>Add a centre-specific procedure</small></span>
            </span>
            <span className="portal-package-other-fields">
              <input name="otherProcedureName" maxLength={100} defaultValue={service?.otherProcedureName ?? ""} disabled={!selected.has("other")} required={selected.has("other")} placeholder="Procedure name" />
              <span className="portal-package-days"><input type="number" name="otherProcedureDays" min="1" max={duration} step="1" defaultValue={service?.otherProcedureDays ?? ""} disabled={!selected.has("other")} required={selected.has("other")} aria-label="Number of days for the other procedure" /><small>days</small></span>
            </span>
          </label>
        </section>
      </div>
    </fieldset>
    <label className="full">Package notes <small>Optional</small><textarea name="description" defaultValue={service?.description ?? ""} maxLength={2_000} placeholder="Add any helpful information about this package." /></label>
  </>;
}

function usedProcedures(items: DocumentRecord<ServiceDocument>[], excludingId?: string) {
  const map: UsedProcedureMap = new Map();
  for (const item of items) {
    if (item.id === excludingId || item.status === "archived") continue;
    for (const procedure of packageProcedureEntries(item)) {
      if (procedure.id === "other") continue;
      const packages = map.get(procedure.id) ?? [];
      const title = packageTitle(item);
      if (!packages.includes(title)) packages.push(title);
      map.set(procedure.id, packages);
    }
  }
  return map;
}

export function ServicesManager() {
  const { userProfile } = useAuth();
  const hospitalId = userProfile?.hospitalId;
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [serviceToRemove, setServiceToRemove] = useState<DocumentRecord<ServiceDocument> | null>(null);
  const [serviceToToggle, setServiceToToggle] = useState<DocumentRecord<ServiceDocument> | null>(null);
  const [search, setSearch] = useState("");
  const [createFormKey, setCreateFormKey] = useState(0);
  const deferredSearch = useDebouncedValue(search.trim(), 300);
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => hospitalId
    ? listHospitalServices(hospitalId, { pageSize: 20, cursor }, deferredSearch)
    : Promise.resolve(emptyQueryPage<ServiceDocument>()), [deferredSearch, hospitalId]);
  const { items, error: loadError, isLoading, hasMore, reload, loadMore, patchItem, removeItem } = usePaginatedList<ServiceDocument>(
    loader,
    "We could not load your packages. Refresh the page and try again.",
  );
  const usedInCreate = useMemo(() => usedProcedures(items), [items]);

  function beginAction(id: string) {
    setBusyId(id);
    setActionError(null);
    setActionMessage(null);
  }

  async function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hospitalId) return;
    beginAction("create");
    try {
      await createService({ hospitalId, ...readPackageForm(event.currentTarget), status: "active" });
      setCreateFormKey((current) => current + 1);
      await reload();
      setActionMessage("The package has been added.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not add the package. Check the details and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function saveService(event: FormEvent<HTMLFormElement>, item: DocumentRecord<ServiceDocument>) {
    event.preventDefault();
    beginAction(item.id);
    try {
      const changes = readPackageForm(event.currentTarget);
      await updateService(item.id, changes, item);
      patchItem(item.id, changes);
      setEditingId(null);
      setActionMessage("The package has been updated.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "We could not save the package. Check the details and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function applyStatusChange(item: DocumentRecord<ServiceDocument>) {
    const status = item.status === "active" ? "inactive" : "active";
    beginAction(item.id);
    try {
      await updateService(item.id, { status }, item);
      patchItem(item.id, { status });
      setActionMessage(`The package is now ${status}.`);
    } catch {
      setActionError("We could not change this package's status. Refresh the page and try again.");
    } finally {
      setBusyId(null);
    }
  }

  function toggleStatus(item: DocumentRecord<ServiceDocument>) {
    if (item.status === "active") {
      setServiceToToggle(item);
      return;
    }
    void applyStatusChange(item);
  }

  async function removeService(item: DocumentRecord<ServiceDocument>) {
    beginAction(item.id);
    try {
      await archiveService(item.id, item);
      removeItem(item.id);
      if (editingId === item.id) setEditingId(null);
      setActionMessage("The package has been deleted from normal views and safely archived.");
      setServiceToRemove(null);
    } catch {
      setActionError("We could not delete this package. Refresh the page and try again.");
    } finally {
      setBusyId(null);
    }
  }

  return <PortalShell role="hospital" title="Services">
    <PortalLoadGuard loading={isLoading} error={loadError} hasData={items.length > 0} fallbackHref="/hospital" loadingMessage="Loading hospital packages..." />
    <form className="portal-card portal-form portal-service-form" onSubmit={addService} noValidate key={createFormKey}>
      <PackageFields usedIn={usedInCreate} />
      <div className="portal-actions full"><button className="portal-button" disabled={busyId !== null}>{busyId === "create" ? "Adding..." : "Add package"}</button></div>
    </form>
    <label className="portal-search">Search packages
      <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by package duration" autoComplete="off" />
    </label>
    <PortalFeedback error={items.length > 0 ? loadError : null} empty={!loadError && !isLoading && items.length === 0 ? (deferredSearch ? "No packages match this search." : "No packages yet. Complete the form above to add your first package.") : undefined} />
    <PortalToast message={actionMessage} />
    <PortalToast message={actionError} tone="error" />
    <div className="portal-list">
      {items.map((item) => editingId === item.id
        ? <article className="portal-card portal-service-edit" key={item.id}>
          <div className="portal-row-heading"><h2>{packageTitle(item)}</h2><span className="portal-status portal-service-status" data-status={item.status}>{formatStatus(item.status)}</span></div>
          <form className="portal-form" onSubmit={(event) => void saveService(event, item)} noValidate>
            <PackageFields service={item} usedIn={usedProcedures(items, item.id)} />
            <div className="portal-actions full"><button className="portal-button" disabled={busyId !== null}>{busyId === item.id ? "Saving..." : "Save changes"}</button><button className="portal-button secondary" type="button" disabled={busyId !== null} onClick={() => setEditingId(null)}>Cancel</button></div>
          </form>
        </article>
        : <article className="portal-row portal-service-row" key={item.id}>
          <div><h3>{packageTitle(item)}</h3><p>{packageProcedureEntries(item).length} procedures included</p>{item.description && <p>{item.description}</p>}<ul className="portal-package-summary">{packageProcedureEntries(item).slice(0, 4).map((procedure) => <li key={procedure.id}>{procedure.label} <span>{procedure.days} days</span></li>)}</ul></div>
          <div className="portal-service-controls"><span className="portal-status portal-service-status" data-status={item.status}>{formatStatus(item.status)}</span><div className="portal-actions"><button className="portal-button secondary" type="button" disabled={busyId !== null} onClick={() => { setEditingId(item.id); setActionError(null); setActionMessage(null); }}>Edit package</button><button className="portal-button secondary" type="button" disabled={busyId !== null} onClick={() => void toggleStatus(item)}>{item.status === "active" ? "Deactivate" : "Activate"}</button><button className="portal-button danger" type="button" disabled={busyId !== null} onClick={() => setServiceToRemove(item)}>Delete</button></div></div>
        </article>)}
    </div>
    <PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
    <PortalDialog open={Boolean(serviceToRemove)} tone="danger" title="Delete this package?" message={serviceToRemove ? `${packageTitle(serviceToRemove)} will be removed from normal package views. Its history will remain safely archived.` : undefined} confirmLabel="Delete package" busy={busyId !== null} onCancel={() => setServiceToRemove(null)} onConfirm={() => { if (serviceToRemove) void removeService(serviceToRemove); }} />
    <PortalDialog open={Boolean(serviceToToggle)} title="Deactivate this package?" message={serviceToToggle ? `${packageTitle(serviceToToggle)} will be hidden from public views until it is activated again.` : undefined} confirmLabel="Deactivate package" busy={busyId !== null} onCancel={() => setServiceToToggle(null)} onConfirm={() => { if (serviceToToggle) { const item = serviceToToggle; setServiceToToggle(null); void applyStatusChange(item); } }} />
  </PortalShell>;
}
