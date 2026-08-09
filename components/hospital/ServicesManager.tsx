"use client";

import { useCallback, useState, type FormEvent } from "react";
import type { ServiceDocument } from "@/features/firestore/models";
import { emptyQueryPage, type DocumentRecord, type QueryPageOptions } from "@/services/firestore/firestoreService";
import { createService, listHospitalServices, updateService } from "@/services/hospitals/serviceService";
import { formatCurrency } from "@/utils/currency";
import { useAuth } from "@/hooks/useAuth";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { usePaginatedList } from "@/hooks/usePaginatedList";

export function ServicesManager() {
  const { userProfile } = useAuth(); const id = userProfile?.hospitalId;
  const [actionError, setActionError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const loader = useCallback((cursor: QueryPageOptions["cursor"]) => id
    ? listHospitalServices(id, { pageSize: 20, cursor })
    : Promise.resolve(emptyQueryPage<ServiceDocument>()), [id]);
  const { items, error: loadError, isLoading, hasMore, reload, loadMore, patchItem } = usePaginatedList<ServiceDocument>(loader, "Services could not be loaded.");
  const error = actionError ?? loadError;
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!id) return; const form = event.currentTarget; const data = new FormData(form); setBusy(true); setActionError(null);
    try { await createService({ hospitalId: id, name: String(data.get("name")), description: String(data.get("description")), price: Number(data.get("price")), durationMinutes: data.get("duration") ? Number(data.get("duration")) : null, status: "active" }); form.reset(); await reload(); }
    catch { setActionError("Service could not be created."); } finally { setBusy(false); } }
  async function toggle(item: DocumentRecord<ServiceDocument>) { const status = item.status === "active" ? "inactive" : "active"; setBusy(true); try { await updateService(item.id, { status }, item); patchItem(item.id, { status }); } catch { setActionError("Service could not be updated."); } finally { setBusy(false); } }
  async function edit(item: DocumentRecord<ServiceDocument>) {
    const name = window.prompt("Service name", item.name); if (!name) return;
    const price = window.prompt("Price (INR)", String(item.price)); if (price === null || !Number.isFinite(Number(price))) return;
    const description = window.prompt("Description", item.description); if (description === null) return;
    setBusy(true); try { const changes = { name, price: Number(price), description }; await updateService(item.id, changes, item); patchItem(item.id, changes); }
    catch { setActionError("Service could not be updated."); } finally { setBusy(false); }
  }
  return <PortalShell role="hospital" title="Services"><form className="portal-card portal-form" onSubmit={submit} style={{ marginBottom: 26 }}>
    <label>Service name<input name="name" required /></label><label>Price (INR)<input name="price" type="number" min="0" step="0.01" required /></label>
    <label>Duration (minutes)<input name="duration" type="number" min="1" /></label><label className="full">Description<textarea name="description" required /></label>
    <div className="portal-actions full"><button className="portal-button" disabled={busy}>Add service</button></div></form>
    <PortalFeedback error={error} empty={!error && !isLoading && items.length === 0 ? "No services have been added." : undefined} /><div className="portal-list">{items.map((item) => <article className="portal-row" key={item.id}><div><h3>{item.name}</h3><p>{formatCurrency(item.price)} · {item.durationMinutes ? `${item.durationMinutes} minutes` : "Flexible duration"}</p></div><div><span className="portal-status">{item.status}</span><div className="portal-actions"><button className="portal-button secondary" disabled={busy} onClick={() => void edit(item)}>Edit</button><button className="portal-button secondary" disabled={busy} onClick={() => void toggle(item)}>{item.status === "active" ? "Deactivate" : "Activate"}</button></div></div></article>)}</div><PortalPagination hasMore={hasMore} isLoading={isLoading} onLoadMore={() => void loadMore()} />
  </PortalShell>;
}
