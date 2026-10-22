"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { completePasswordAction, passwordActionError, verifyPasswordAction } from "@/services/auth/passwordActionService";

export function PasswordActionForm() {
  const [phase, setPhase] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [role, setRole] = useState<"admin" | "hospital">("hospital");
  const [invitation, setInvitation] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const actionCode = useRef("");
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    actionCode.current = params.get("oobCode") ?? "";
    void verifyPasswordAction(actionCode.current).then(() => {
      if (active) setPhase("ready");
    }).catch((caught: unknown) => {
      if (active) { setError(passwordActionError(caught)); setPhase("invalid"); }
    }).finally(() => {
      if (active) {
        setRole(params.get("role") === "admin" ? "admin" : "hospital");
        setInvitation(params.get("kind") === "invite");
      }
    });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || phase !== "ready") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get("password") !== data.get("confirmPassword")) {
      setError("The passwords do not match. Please enter them again.");
      form.querySelector<HTMLInputElement>('[name="confirmPassword"]')?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await completePasswordAction(actionCode.current, String(data.get("password") ?? ""));
      form.reset();
      actionCode.current = "";
      window.history.replaceState(null, "", window.location.pathname);
      setPhase("done");
    } catch (caught) {
      setError(passwordActionError(caught));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <AuthFormShell title={phase === "done" ? "Your password is ready" : invitation ? "Set your password" : "Reset your password"}
    description={phase === "done" ? "You can now sign in to your Ayursarga account with your new password." : "Choose a secure password for your Ayursarga account."}>
    {phase === "checking" && <p className="portal-auth-description" role="status">Checking your secure link…</p>}
    {phase === "ready" && <form className="portal-auth-form" onSubmit={submit}>
      <PasswordField label="New password" name="password" autoComplete="new-password" showRequirements required disabled={busy} />
      <PasswordField label="Confirm password" name="confirmPassword" autoComplete="new-password" required disabled={busy} />
      {error && <p className="portal-form-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? "Saving…" : invitation ? "Set password" : "Reset password"}</button>
    </form>}
    {phase === "invalid" && <div className="portal-auth-confirmation" role="alert"><p>{error}</p></div>}
    {phase === "done" && <div className="portal-auth-confirmation" role="status"><span aria-hidden="true">✓</span><div><strong>Password saved successfully</strong><p>Sign in to continue.</p></div></div>}
    <div className="portal-auth-links">
      {phase === "invalid" && <Link href={`/${role}/forgot-password`}>Request a new reset link</Link>}
      <Link href={`/${role}/login`}>Return to {role === "admin" ? "Admin" : "Hospital"} login</Link>
    </div>
  </AuthFormShell>;
}
