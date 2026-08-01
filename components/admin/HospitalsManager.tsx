"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { HospitalDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { createHospital, listAllHospitals, updateHospital } from "@/services/hospitals/hospitalService";
import { useAuth } from "@/hooks/useAuth";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";

export function HospitalsManager() {
  const { firebaseUser } = useAuth(); const [items, setItems] = useState<DocumentRecord<HospitalDocument>[]>([]);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setItems((await listAllHospitals({ pageSize: 20 })).documents); } catch { setError("Hospitals could not be loaded."); } }, []);
  useEffect(() => { void listAllHospitals({ pageSize: 20 }).then((page) => setItems(page.documents)).catch(() => setError("Hospitals could not be loaded.")); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!firebaseUser) return; const form = event.currentTarget; const data = new FormData(form); setBusy(true); setError(null);
    try { await createHospital({ name: String(data.get("name")), description: String(data.get("description")), email: String(data.get("email")), phone: String(data.get("phone")), address: String(data.get("address")), city: String(data.get("city")), state: String(data.get("state")), imageUrl: null, status: "pending", isPublic: false, commissionPercentage: Number(data.get("commission")) }, firebaseUser.uid); form.reset(); await load(); }
    catch { setError("Hospital could not be created."); } finally { setBusy(false); } }
  async function change(item: DocumentRecord<HospitalDocument>, changes: Partial<HospitalDocument>) { setBusy(true); try { await updateHospital(item.id, changes); await load(); } catch { setError("Hospital could not be updated."); } finally { setBusy(false); } }
  function setCommission(item: DocumentRecord<HospitalDocument>) { const value = window.prompt("Commission percentage", String(item.commissionPercentage)); if (value === null || !Number.isFinite(Number(value))) return; void change(item, { commissionPercentage: Number(value) }); }
  return <PortalShell role="admin" title="Hospitals"><form className="portal-card portal-form" onSubmit={submit} style={{ marginBottom: 26 }}>
    <label>Name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label><label>Phone<input name="phone" required /></label><label>City<input name="city" required /></label><label>State<input name="state" required /></label><label>Commission %<input name="commission" type="number" min="0" max="100" step="0.01" required /></label><label className="full">Address<input name="address" required /></label><label className="full">Description<textarea name="description" required /></label>
    <p className="full">New hospitals remain pending and private until explicitly activated.</p><div className="portal-actions full"><button className="portal-button" disabled={busy}>Create hospital</button></div></form>
    <PortalFeedback error={error} empty={!error && items.length === 0 ? "No hospitals have been created." : undefined} /><div className="portal-list">{items.map((item) => <article className="portal-card" key={item.id}><div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><h3>{item.name}</h3><span className="portal-status">{item.status} · {item.isPublic ? "public" : "private"}</span></div><p>{item.city}, {item.state} · Commission {item.commissionPercentage}%</p><div className="portal-actions"><button className="portal-button" disabled={busy} onClick={() => void change(item, { status: item.status === "active" ? "inactive" : "active", isPublic: item.status !== "active" })}>{item.status === "active" ? "Deactivate" : "Activate"}</button><button className="portal-button secondary" onClick={() => setCommission(item)}>Set commission</button></div></article>)}</div>
  </PortalShell>;
}
