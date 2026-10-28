"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { ROUTES } from "@/config/routes";
import type { PortalRole } from "@/features/auth/contracts";
import { useAuth } from "@/hooks/useAuth";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { PortalToast } from "@/components/portal/PortalToast";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import dynamic from "next/dynamic";

const AdminMfaEnrollment = dynamic(() => import("@/components/auth/AdminMfaEnrollment").then(module => module.AdminMfaEnrollment), {
  loading: () => <p role="status">Loading authenticator setup...</p>,
});

const COPY = {
  admin: { title: "Admin login", description: "Secure access for authorised Ayursarga administrators." },
  hospital: { title: "Hospital login", description: "Sign in with the official email connected to your activated Ayursarga hospital account." },
} as const;

export function LoginForm({ role, requestedPath, recoveryEnabled = false, replacementNotice }: { role: Exclude<PortalRole, "consumer">; requestedPath?: string | null; recoveryEnabled?: boolean; replacementNotice?: "setup" | "check" }) {
  const { login, completeAdminMfa, completeAdminMfaEnrollment, logout, isLoading, error, clearError } = useAuth();
  const [stage, setStage] = useState<"password" | "verify" | "enroll">("password");
  const [localError, setLocalError, localErrorNotification] = useRepeatableMessage();
  const submitting = useRef(false);
  const copy = COPY[role];
  const forgotPath = role === "admin" ? ROUTES.admin.forgotPassword : ROUTES.hospital.forgotPassword;
  const enrolling = role === "admin" && (stage === "enroll" || error?.code === "mfa-enrollment-required");
  const verifying = role === "admin" && stage === "verify";
  const displayedError = localError || (error?.code === "mfa-required" || error?.code === "mfa-enrollment-required" ? undefined : error?.message);
  function handleError(caught: unknown) {
    const code = caught && typeof caught === "object" && "code" in caught ? caught.code : "";
    if (role === "admin" && code === "mfa-required") { setStage("verify"); setLocalError(null); return; }
    if (role === "admin" && code === "mfa-enrollment-required") { setStage("enroll"); setLocalError(null); return; }
    if (code === "mfa-sign-in-required" || code === "mfa-session-expired") setStage("password");
    setLocalError(caught instanceof Error ? caught.message : "Unable to sign in. Please try again.");
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    clearError();
    setLocalError(null);
    const data = new FormData(event.currentTarget);
    try {
      if (verifying) await completeAdminMfa(String(data.get("code") ?? ""), requestedPath);
      else await login({ email: String(data.get("email") || ""), password: String(data.get("password") || "") }, role, requestedPath);
    } catch (caught) {
      handleError(caught);
    } finally {
      submitting.current = false;
    }
  };

  return <AuthFormShell title={enrolling ? "Secure your Admin account" : verifying ? "Verify Admin sign-in" : copy.title} description={enrolling ? "Set up two-step verification for your account." : verifying ? "Enter the six-digit code from your authenticator app." : copy.description}>
    {role === "admin" && stage === "password" && replacementNotice && <p role="status" className="portal-form-note">{replacementNotice === "setup" ? "Sign in with your password to set up your new authenticator." : "Replacement could not be confirmed. Sign in to check your authenticator setup. If you cannot continue, contact your trusted project owner before retrying."}</p>}
    {enrolling ? <AdminMfaEnrollment onCancel={logout} onComplete={async (code) => {
      setStage("enroll");
      try { return await completeAdminMfaEnrollment(code, requestedPath); }
      catch (caught) { handleError(caught); throw caught; }
    }} /> : <form className="portal-auth-form" onSubmit={submit}>
      {verifying ? <label>Authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required /></label> : <>
        <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
        <PasswordField label="Password" name="password" autoComplete="current-password" required />
      </>}
      <PortalToast message={displayedError} notification={localError ? localErrorNotification : undefined} source={localError ? undefined : error} tone="error" />
      {displayedError && <p className="portal-form-error" role="alert">{displayedError}</p>}
      <button type="submit" className="portal-login-submit" disabled={isLoading}>
        <span>{isLoading ? "Signing in..." : verifying ? "Verify and sign in" : "Sign in"}</span>
        <span aria-hidden="true">→</span>
      </button>
      {verifying && <p className="portal-mfa-help">Can’t access your authenticator? Contact your account administrator for help.</p>}
      {verifying && <button type="button" className="portal-button secondary" disabled={isLoading} onClick={() => void logout()}>Cancel sign-in</button>}
    </form>}
    {!enrolling && !verifying && <div className="portal-auth-links">
      <Link href={forgotPath}>Forgot password?</Link>
      {role === "hospital" && <Link href="/contact?interest=partnership">Need hospital access? Contact Ayursarga</Link>}
    </div>}
    {role === "admin" && recoveryEnabled && !enrolling && <details className="portal-mfa-manual">
      <summary>Lost access to your authenticator?</summary>
      <p className="portal-mfa-help">Contact your trusted Firebase project owner to verify your identity and recover access. A password reset does not remove two-step verification.</p>
      <a className="portal-button secondary" href="mailto:info@ayursarga.com?subject=Admin%20authenticator%20recovery%20request&body=I%20need%20help%20recovering%20my%20Admin%20authenticator.%20Please%20arrange%20identity%20verification.%20I%20will%20not%20send%20passwords%2C%20setup%20keys%20or%20codes.">Request recovery help by email</a>
      <p className="portal-mfa-help">This opens your email app. No reset happens automatically. Never include passwords, setup keys or verification codes.</p>
    </details>}
  </AuthFormShell>;
}
