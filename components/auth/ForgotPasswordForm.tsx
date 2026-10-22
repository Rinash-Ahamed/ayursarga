"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { APPROVED_ADMIN_EMAIL } from "@/features/auth/constants";
import type { PortalRole } from "@/features/auth/contracts";
import { getRoleLoginPath } from "@/features/auth/roles";
import { useAuth } from "@/hooks/useAuth";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { PortalToast } from "@/components/portal/PortalToast";

const RESET_ACKNOWLEDGEMENT = "If an eligible account exists, you will receive a password reset email. Check your inbox and spam folder.";

export function ForgotPasswordForm({ role }: { role: Exclude<PortalRole, "consumer"> }) {
  const { resetPassword, isLoading, error, clearError } = useAuth();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);
  const adminReset = role === "admin";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setSending(true);
    clearError();
    const data = new FormData(event.currentTarget);
    try {
      await resetPassword(adminReset ? APPROVED_ADMIN_EMAIL : String(data.get("email") || ""));
      setSent(true);
    } catch {
      setSent(false);
    } finally {
      submitting.current = false;
      setSending(false);
    }
  };

  return <AuthFormShell title="Reset your password" description={adminReset
    ? "We’ll send a secure reset link to the approved Ayursarga Admin account."
    : "We’ll send a secure reset link to the email connected to your account."}>
    {!sent && <form className="portal-auth-form" onSubmit={submit} aria-busy={sending}>
      {adminReset
        ? <div className="portal-auth-recipient"><span>Reset link recipient</span><strong>{APPROVED_ADMIN_EMAIL}</strong></div>
        : <label>Email address<input name="email" type="email" autoComplete="email" required readOnly={sending} /></label>}
      <PortalToast message={error?.message} source={error} tone="error" />
      {error && <p className="portal-form-error" role="alert">{error.message}</p>}
      <button type="submit" className={sending ? "portal-auth-sending" : undefined} disabled={sending || isLoading}>
        {sending && <span className="portal-auth-spinner" aria-hidden="true" />}
        {sending ? "Sending reset link…" : "Send reset link"}
        {!sending && <span aria-hidden="true">→</span>}
      </button>
      {sending && <p className="portal-auth-progress" role="status">This may take a few seconds. Please keep this page open until confirmation appears.</p>}
    </form>}
    {sent && <div className="portal-auth-confirmation" role="status">
      <span aria-hidden="true">✓</span>
      <div><strong>Reset request accepted</strong><p>{RESET_ACKNOWLEDGEMENT}</p></div>
    </div>}
    <div className="portal-auth-links"><Link href={getRoleLoginPath(role)}>Return to login</Link></div>
  </AuthFormShell>;
}
