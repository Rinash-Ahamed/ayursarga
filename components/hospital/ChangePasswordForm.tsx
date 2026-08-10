"use client";

import { useState, type FormEvent } from "react";
import { PasswordField } from "@/components/auth/PasswordField";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalToast } from "@/components/portal/PortalToast";
import { isValidPassword } from "@/features/auth/password";
import { useAuth } from "@/hooks/useAuth";

export function HospitalChangePasswordForm() {
  const { changePassword, isLoading, error, clearError } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    setMessage(null);
    setLocalError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");
    if (!isValidPassword(newPassword)) {
      setLocalError("Use at least 8 characters, including one letter and one digit.");
      return;
    }
    if (newPassword !== confirmation) {
      setLocalError("The new passwords do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setLocalError("Choose a new password that is different from your current password.");
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      form.reset();
      setMessage("Your password has been changed securely.");
    } catch {
      // The shared authentication context displays a safe, friendly error.
    }
  }

  return <PortalShell role="hospital" title="Change Password" eyebrow="Account security">
    <form className="portal-card portal-form portal-security-form" onSubmit={submit} noValidate>
      <p className="portal-form-note full">Enter your current password, then choose a new password for your Hospital portal account.</p>
      <div className="full"><PasswordField label="Current password" name="currentPassword" autoComplete="current-password" required /></div>
      <div><PasswordField label="New password" name="newPassword" autoComplete="new-password" showRequirements required /></div>
      <div><PasswordField label="Confirm new password" name="confirmation" autoComplete="new-password" required /></div>
      <PortalToast message={localError || error?.message} tone="error" />
      <PortalToast message={message} />
      <div className="portal-actions full"><button className="portal-button" disabled={isLoading}>{isLoading ? "Changing..." : "Change password"}</button></div>
    </form>
  </PortalShell>;
}
