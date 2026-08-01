"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { updateUserProfile } from "@/services/users/userService";
import { PortalShell } from "@/components/portal/PortalShell";

export function ConsumerProfile() {
  const { firebaseUser, userProfile, refreshUserProfile } = useAuth();
  const [message, setMessage] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!firebaseUser) return;
    const data = new FormData(event.currentTarget); setBusy(true); setMessage(null);
    try { await updateUserProfile(firebaseUser.uid, { name: String(data.get("name")), phone: String(data.get("phone") || "") }); await refreshUserProfile(); setMessage("Profile updated."); }
    catch { setMessage("Profile could not be updated."); } finally { setBusy(false); } }
  return <PortalShell role="consumer" title="Profile"><form className="portal-card portal-form" onSubmit={submit}>
    <label>Name<input name="name" defaultValue={userProfile?.name} required /></label>
    <label>Phone<input name="phone" type="tel" defaultValue={userProfile?.phone ?? ""} /></label>
    <label className="full">Email<input value={userProfile?.email ?? ""} disabled /></label>
    {message && <p className="portal-form-success full">{message}</p>}
    <div className="portal-actions full"><button className="portal-button" disabled={busy}>Save profile</button></div>
  </form></PortalShell>;
}
