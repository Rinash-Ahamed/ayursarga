"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ServiceDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { createService, listHospitalServices, updateService } from "@/services/hospitals/serviceService";
import { formatCurrency } from "@/utils/currency";
import { useAuth } from "@/hooks/useAuth";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";

export function ServicesManager() {
  const { userProfile } = useAuth(); const id = userProfile?.hospitalId;
  const [items, setItems] = useState<DocumentRecord<ServiceDocument>[]>([]); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { if (!id) return; try { setItems((await listHospitalServices(id, { pageSize: 20 })).documents); } catch { setError("Services could not be loaded."); } }, [id]);
  useEffect(() => { void load(); }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!id) return; const form = event.currentTarget; const data = new FormData(form); setBusy(true); setError(null);
    try { await createService({ hospitalId: id, name: String(data.get("name")), description: String(data.get("description")), price: Number(data.get("price")), durationMinutes: data.get("duration") ? Number(data.get("duration")) : null, status: "active" }); form.reset(); await load(); }
    catch { setError("Service could not be created."); } finally { setBusy(false); } }
  async function toggle(item: DocumentRecord<ServiceDocument>) { setBusy(true); try { await updateService(item.id, { status: item.status === "active" ? "inactive" : "active" }); await load(); } catch { setError("Service could not be updated."); } finally { setBusy(false); } }
  return <PortalShell role="hospital" title="Services"><form className="portal-card portal-form" onSubmit={submit} style={{ marginBottom: 26 }}>
    <label>Service name<input name="name" required /></label><label>Price (INR)<input name="price" type="number" min="0" step="0.01" required /></label>
    <label>Duration (minutes)<input name="duration" type="number" min="1" /></label><label className="full">Description<textarea name="description" required /></label>
    <div className="portal-actions full"><button className="portal-button" disabled={busy}>Add service</button></div></form>
    <PortalFeedback error={error} empty={!error && items.length === 0 ? "No services have been added." : undefined} /><div className="portal-list">{items.map((item) => <article className="portal-row" key={item.id}><div><h3>{item.name}</h3><p>{formatCurrency(item.price)} · {item.durationMinutes ? `${item.durationMinutes} minutes` : "Flexible duration"}</p></div><div><span className="portal-status">{item.status}</span><div className="portal-actions"><button className="portal-button secondary" disabled={busy} onClick={() => void toggle(item)}>{item.status === "active" ? "Deactivate" : "Activate"}</button></div></div></article>)}</div>
  </PortalShell>;
}
