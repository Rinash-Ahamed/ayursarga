"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { PortalRole } from "@/features/auth/contracts";
import { getRoleLoginPath } from "@/features/auth/roles";
import { useAuth } from "@/hooks/useAuth";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { PortalToast } from "@/components/portal/PortalToast";

export function ForgotPasswordForm({ role }: { role: Exclude<PortalRole, "consumer"> }) {
  const { resetPassword, isLoading, error, clearError } = useAuth();
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    const data = new FormData(event.currentTarget);
    try {
      await resetPassword(String(data.get("email") || ""));
      setSent(true);
    } catch {
      setSent(false);
    }
  };

  return <AuthFormShell eyebrow="Account recovery" title="Reset your password" description="We’ll send a secure reset link to the email connected to your account.">
    <PortalToast message={sent ? "If an account exists for that email, a reset link has been sent." : null} />
    {!sent && <form className="portal-auth-form" onSubmit={submit}>
      <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
      <PortalToast message={error?.message} tone="error" />
      <button type="submit" disabled={isLoading}>{isLoading ? "Sending…" : "Send reset link"}<span aria-hidden="true">→</span></button>
    </form>}
    <div className="portal-auth-links"><Link href={getRoleLoginPath(role)}>Return to login</Link></div>
  </AuthFormShell>;
}
