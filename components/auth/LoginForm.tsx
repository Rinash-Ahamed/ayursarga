"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ROUTES } from "@/config/routes";
import type { PortalRole } from "@/features/auth/contracts";
import { useAuth } from "@/hooks/useAuth";
import { AuthFormShell } from "@/components/auth/AuthFormShell";

const COPY = {
  admin: { eyebrow: "Administration", title: "Admin login", description: "Secure access for authorised Ayursarga administrators." },
  hospital: { eyebrow: "Hospital portal", title: "Hospital login", description: "Access your centre, care team and future booking operations." },
  consumer: { eyebrow: "Your Ayursarga", title: "Welcome back", description: "Sign in to continue your personal wellness journey." },
} as const;

export function LoginForm({ role, requestedPath }: { role: PortalRole; requestedPath?: string | null }) {
  const { login, isLoading, error, clearError } = useAuth();
  const [localError, setLocalError] = useState<string | null>(null);
  const copy = COPY[role];
  const forgotPath = role === "admin" ? ROUTES.admin.forgotPassword
    : role === "hospital" ? ROUTES.hospital.forgotPassword
      : ROUTES.consumer.forgotPassword;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setLocalError(null);
    const data = new FormData(event.currentTarget);
    try {
      await login({ email: String(data.get("email") || ""), password: String(data.get("password") || "") }, role, requestedPath);
    } catch (caught) {
      if (!(caught instanceof Error)) setLocalError("Unable to sign in. Please try again.");
    }
  };

  return <AuthFormShell eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
    <form className="portal-auth-form" onSubmit={submit}>
      <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required minLength={6} /></label>
      {(error || localError) && <p className="portal-form-error" role="alert">{localError || error?.message}</p>}
      <button type="submit" disabled={isLoading}>{isLoading ? "Signing in…" : "Sign in"}<span aria-hidden="true">→</span></button>
    </form>
    <div className="portal-auth-links">
      <Link href={forgotPath}>Forgot password?</Link>
      {role === "consumer" && <Link href={ROUTES.consumer.register}>Create an account</Link>}
    </div>
  </AuthFormShell>;
}
