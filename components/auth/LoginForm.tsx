"use client";

import Link from "next/link";
import { useRef, type FormEvent } from "react";
import { ROUTES } from "@/config/routes";
import type { PortalRole } from "@/features/auth/contracts";
import { useAuth } from "@/hooks/useAuth";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { PortalToast } from "@/components/portal/PortalToast";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";

const COPY = {
  admin: { title: "Admin login", description: "Secure access for authorised Ayursarga administrators." },
  hospital: { title: "Hospital login", description: "Sign in with the official email connected to your activated Ayursarga hospital account." },
} as const;

export function LoginForm({ role, requestedPath }: { role: Exclude<PortalRole, "consumer">; requestedPath?: string | null }) {
  const { login, isLoading, error, clearError } = useAuth();
  const [localError, setLocalError, localErrorNotification] = useRepeatableMessage();
  const submitting = useRef(false);
  const copy = COPY[role];
  const forgotPath = role === "admin" ? ROUTES.admin.forgotPassword : ROUTES.hospital.forgotPassword;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    clearError();
    setLocalError(null);
    const data = new FormData(event.currentTarget);
    try {
      await login({ email: String(data.get("email") || ""), password: String(data.get("password") || "") }, role, requestedPath);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Unable to sign in. Please try again.");
    } finally {
      submitting.current = false;
    }
  };

  return <AuthFormShell title={copy.title} description={copy.description}>
    <form className="portal-auth-form" onSubmit={submit}>
      <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
      <PasswordField label="Password" name="password" autoComplete="current-password" required />
      <PortalToast message={localError || error?.message} notification={localError ? localErrorNotification : undefined} source={localError ? undefined : error} tone="error" />
      {(localError || error?.message) && <p className="portal-form-error" role="alert">{localError || error?.message}</p>}
      <button type="submit" className="portal-login-submit" disabled={isLoading}>
        <span>{isLoading ? "Signing in..." : "Sign in"}</span>
        <span aria-hidden="true">→</span>
      </button>
    </form>
    <div className="portal-auth-links">
      <Link href={forgotPath}>Forgot password?</Link>
      {role === "hospital" && <Link href="/contact?interest=partnership">Need hospital access? Contact Ayursarga</Link>}
    </div>
  </AuthFormShell>;
}
