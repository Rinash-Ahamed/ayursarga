"use client";

import { useRef, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { PasswordField } from "@/components/auth/PasswordField";
import { replaceAdminAuthenticator } from "@/services/auth/adminMfaReplacementService";
import { toAuthenticationError } from "@/features/auth/errors";

export function AdminSecurity({ enabled }: { enabled: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setConfirm(true);
  }
  async function replace() {
    if (submitting.current || !form.current) return;
    submitting.current = true; setBusy(true); setError("");
    const data = new FormData(form.current);
    try { await replaceAdminAuthenticator(String(data.get("password") ?? ""), String(data.get("code") ?? "")); }
    catch (caught) { setError(toAuthenticationError(caught).message); setConfirm(false); }
    finally { form.current?.reset(); submitting.current = false; setBusy(false); }
  }
  return <PortalShell role="admin" title="Settings">
    <section className="portal-card">
      <h2>Account security</h2>
      <p className="portal-form-note">Use this only when you still have access to your current authenticator. Your existing key will stop working on every device using this account. You will be signed out and must set up a new authenticator at your next sign-in.</p>
      {!enabled ? <p role="status">Authenticator replacement is currently disabled. Contact your trusted project owner if you need help.</p> : <form ref={form} className="portal-form portal-security-form" onSubmit={submit}>
        <div className="full"><PasswordField label="Current password" name="password" autoComplete="current-password" required disabled={busy} /></div>
        <label className="full">Current authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy} /></label>
        {error && <p className="portal-form-error full" role="alert">{error}</p>}
        <div className="portal-actions full"><button type="submit" className="portal-button danger" disabled={busy}>Replace authenticator</button></div>
      </form>}
    </section>
    <PortalDialog open={confirm} title="Replace your authenticator?" message="This invalidates the existing setup key for everyone sharing this Admin account and signs out existing sessions. Sign in again with your password to scan a new QR code. No password or account data will be changed." tone="danger" confirmLabel="Replace and sign out" busy={busy} onConfirm={() => void replace()} onCancel={() => { if (!busy) setConfirm(false); }} />
  </PortalShell>;
}
