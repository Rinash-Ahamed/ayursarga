"use client";

import { useRef, useState, type FormEvent } from "react";
import { prepareAdminMfaEnrollment, requestAdminEmailVerification } from "@/services/auth/adminMfaService";
import { toAuthenticationError } from "@/features/auth/errors";
import type { buildTotpQr } from "@/features/auth/totpQr";

export function AdminMfaEnrollment({ onComplete, onCancel }: {
  onComplete: (code: string) => Promise<unknown>; onCancel: () => Promise<unknown>;
}) {
  const [setup, setSetup] = useState<{ key: string; email: string; qr: ReturnType<typeof buildTotpQr> | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  async function prepare() {
    const details = await prepareAdminMfaEnrollment();
    let qr: ReturnType<typeof buildTotpQr> | null = null;
    try {
      const { buildTotpQr } = await import("@/features/auth/totpQr");
      qr = buildTotpQr(details.qrUri);
    } catch { /* Manual setup remains available if the QR chunk or renderer fails. */ }
    setSetup({ key: details.key, email: details.email, qr });
  }
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
    <p>Connect your authenticator app once. You’ll use its code whenever you sign in.</p>
    {!setup ? <>
      <p>Not verified your email yet? Verify it first, then continue with setup.</p>
      <div className="portal-auth-form portal-mfa-actions">
        <button type="button" disabled={busy} onClick={() => void run(prepare)}>{busy ? "Please wait..." : "Set up authenticator"}</button>
        <button type="button" className="portal-button secondary" disabled={busy} onClick={() => void run(async () => {
          const alreadyVerified = await requestAdminEmailVerification();
          setMessage(alreadyVerified ? "Your email is already verified. Continue with setup." : "Check your inbox for the verification link, then return here to continue.");
        })}>Send email verification</button>
      </div>
    </> : <>
      <ol><li>Open Google Authenticator or your preferred authenticator app.</li><li>Choose <strong>Add account → Scan a QR code</strong> and scan below.</li><li>Enter the six-digit code from your app to finish.</li></ol>
      {setup.qr ? <div className="portal-mfa-qr">
        <svg viewBox={`0 0 ${setup.qr.size} ${setup.qr.size}`} role="img" aria-label="Authenticator setup QR code" shapeRendering="crispEdges">
          <rect width={setup.qr.size} height={setup.qr.size} fill="#fff" />
          <path d={setup.qr.path} fill="#000" />
        </svg>
        <small>Keep this QR code private. Do not share it.</small>
      </div> : <p role="status">The QR code could not be displayed. Use the setup key below.</p>}
      <details className="portal-mfa-manual" open={!setup.qr}>
        <summary>Can’t scan? Enter setup key</summary>
        <div className="portal-mfa-key"><span>Your setup key</span><code>{setup.key}</code><small>Choose <strong>Enter a setup key</strong> in your app. Use <strong>{setup.email}</strong> as the account name and choose <strong>Time based</strong>. Keep the key private.</small></div>
      </details>
      <form className="portal-auth-form" onSubmit={submit}>
        <label>Authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy} /></label>
        <button type="submit" disabled={busy}>{busy ? "Verifying..." : "Verify and enable MFA"}</button>
      </form>
    </>}
    {error && <p className="portal-form-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <p className="portal-mfa-help">Keep a secure backup of your authenticator so you don’t lose access to your account.</p>
    <button type="button" className="portal-button secondary" disabled={busy} onClick={() => void run(onCancel)}>Cancel sign-in</button>
  </div>;
}
