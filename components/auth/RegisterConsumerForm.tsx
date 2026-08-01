"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/hooks/useAuth";
import { AuthFormShell } from "@/components/auth/AuthFormShell";

export function RegisterConsumerForm() {
  const { registerConsumer, isLoading, error, clearError } = useAuth();
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setLocalError(null);
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") || "");
    if (password !== String(data.get("confirmPassword") || "")) {
      setLocalError("The passwords do not match.");
      return;
    }
    try {
      await registerConsumer({
        name: String(data.get("name") || ""),
        email: String(data.get("email") || ""),
        phone: String(data.get("phone") || ""),
        password,
      });
    } catch (caught) {
      if (!(caught instanceof Error)) setLocalError("Unable to create your account. Please try again.");
    }
  };

  return <AuthFormShell eyebrow="Consumer account" title="Begin your journey" description="Create a personal account for future retreat discovery and booking.">
    <form className="portal-auth-form" onSubmit={submit}>
      <label>Your name<input name="name" type="text" autoComplete="name" required /></label>
      <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
      <label>Phone number <span>(optional)</span><input name="phone" type="tel" autoComplete="tel" /></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" required minLength={6} /></label>
      <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={6} /></label>
      {(error || localError) && <p className="portal-form-error" role="alert">{localError || error?.message}</p>}
      <button type="submit" disabled={isLoading}>{isLoading ? "Creating account…" : "Create consumer account"}<span aria-hidden="true">→</span></button>
    </form>
    <div className="portal-auth-links"><Link href={ROUTES.consumer.login}>Already have an account? Sign in</Link></div>
  </AuthFormShell>;
}
