"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { HospitalDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { getHospital, updateHospitalProfile } from "@/services/hospitals/hospitalService";
import { useAuth } from "@/hooks/useAuth";
import { PortalShell } from "@/components/portal/PortalShell";

export function HospitalProfile() {
  const { userProfile } = useAuth(); const id = userProfile?.hospitalId;
  const [hospital, setHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [message, setMessage] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (id) void getHospital(id).then(setHospital).catch(() => setMessage("Profile could not be loaded.")); }, [id]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!id) return;
    const data = new FormData(event.currentTarget); setBusy(true); setMessage(null);
    try { await updateHospitalProfile(id, { name: String(data.get("name")), description: String(data.get("description")), email: String(data.get("email")), phone: String(data.get("phone")), address: String(data.get("address")), city: String(data.get("city")), state: String(data.get("state")), imageUrl: String(data.get("imageUrl") || "") || null }); setMessage("Hospital profile updated."); }
    catch { setMessage("Profile could not be updated."); } finally { setBusy(false); } }
  return <PortalShell role="hospital" title="Hospital Profile">{hospital && <form className="portal-card portal-form" onSubmit={submit}>
    <label>Name<input name="name" defaultValue={hospital.name} required /></label><label>Email<input name="email" type="email" defaultValue={hospital.email} required /></label>
    <label>Phone<input name="phone" defaultValue={hospital.phone} required /></label><label>City<input name="city" defaultValue={hospital.city} required /></label>
    <label>State<input name="state" defaultValue={hospital.state} required /></label><label>Image URL<input name="imageUrl" type="url" defaultValue={hospital.imageUrl ?? ""} /></label>
    <label className="full">Address<input name="address" defaultValue={hospital.address} required /></label><label className="full">Description<textarea name="description" defaultValue={hospital.description} required /></label>
    <p className="full">Commission: {hospital.commissionPercentage}% · Visibility and commission are controlled by Ayursarga admin.</p>
    {message && <p className="portal-form-success full">{message}</p>}<div className="portal-actions full"><button className="portal-button" disabled={busy}>Save profile</button></div>
  </form>}</PortalShell>;
}
