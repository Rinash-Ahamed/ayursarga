"use client";

import { useRef, useState, type FormEvent } from "react";
import { prepareAdminMfaEnrollment, requestAdminEmailVerification } from "@/services/auth/adminMfaService";
import { toAuthenticationError } from "@/features/auth/errors";

export function AdminMfaEnrollment({ onComplete, onCancel }: {
  onComplete: (code: string) => Promise<unknown>; onCancel: () => Promise<unknown>;
}) {
  const [setup, setSetup] = useState<{ key: string; email: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  async function run(action: () => Promise<unknown>) {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (caught) {
      setError(caught instanceof Error && !("code" in caught) ? caught.message : toAuthenticationError(caught).message);
    } finally { submitting.current = false; setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    void run(() => onComplete(code));
  }
  return <div className="portal-mfa-setup">
    <p>Admin requires a password and a code from your authenticator app. Hospital and Consumer sign-in are unchanged.</p>
    {!setup ? <>
      <p>If your Admin email is not verified, request a verification email first. After verifying it, return here and continue.</p>
      <div className="portal-auth-form">
        <button type="button" disabled={busy} onClick={() => void run(async () => { setSetup(await prepareAdminMfaEnrollment()); })}>{busy ? "Please wait..." : "Set up authenticator"}</button>
        <button type="button" className="portal-button secondary" disabled={busy} onClick={() => void run(async () => {
          await requestAdminEmailVerification(); setMessage("Verification request completed. Check your inbox for the link if your email was not already verified, then return here and select Set up authenticator.");
        })}>Send email verification</button>
      </div>
    </> : <>
      <ol><li>Open Google Authenticator or another TOTP authenticator app.</li><li>Choose <strong>Add account → Enter a setup key</strong>.</li><li>Use account <strong>{setup.email}</strong>, paste the key below and choose <strong>Time based</strong>.</li></ol>
      <div className="portal-mfa-key"><span>Private setup key</span><code>{setup.key}</code><small>Keep this key private. Never send it to support or share a screenshot.</small></div>
      <form className="portal-auth-form" onSubmit={submit}>
        <label>Authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy} /></label>
        <button type="submit" disabled={busy}>{busy ? "Verifying..." : "Verify and enable MFA"}</button>
      </form>
    </>}
    {error && <p className="portal-form-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <p className="portal-mfa-help">Keep your authenticator backed up securely. If you lose access, recovery requires the trusted Firebase project owner; password reset does not bypass MFA.</p>
    <button type="button" className="portal-button secondary" disabled={busy} onClick={() => void run(onCancel)}>Cancel sign-in</button>
  </div>;
}
