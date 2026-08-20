"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalToast } from "@/components/portal/PortalToast";
import { getSafeRoleRedirect } from "@/features/auth/roles";
import { validateConsumerContact } from "@/features/consumers/profileValidation";
import { useAuth } from "@/hooks/useAuth";
import { updateUserProfile } from "@/services/users/userService";

export function ConsumerProfile({ completion = false, requestedPath }: { completion?: boolean; requestedPath?: string }) {
  const router = useRouter();
  const { firebaseUser, userProfile, refreshUserProfile } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"name" | "phone" | "address", string>>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser) return;
    const data = new FormData(event.currentTarget);
    const validation = validateConsumerContact({
      name: data.get("name"),
      phone: data.get("phone"),
      address: data.get("address"),
    });
    setFieldErrors(validation.errors);
    setMessage(null);
    setError(null);
    if (!validation.isValid) {
      setError("Complete the highlighted contact details before continuing.");
      return;
    }
    setBusy(true);
    try {
      await updateUserProfile(firebaseUser.uid, validation.data);
      await refreshUserProfile();
      if (completion) {
        router.replace(getSafeRoleRedirect(requestedPath, "consumer"));
      } else {
        setMessage("Your contact details have been updated.");
      }
    } catch {
      setError("We could not update your contact details. Check the information and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <PortalShell
    role="consumer"
    title={completion ? "Complete Your Profile" : "Profile"}
    eyebrow={completion ? "One final step" : undefined}
  >
    <form className="portal-card portal-form" onSubmit={submit} noValidate>
      {completion && <p className="portal-form-note full">Add the contact details that a Hospital may use after you request an appointment.</p>}
      <label>Name *<input name="name" defaultValue={userProfile?.name} required minLength={2} maxLength={120} aria-invalid={Boolean(fieldErrors.name)} />{fieldErrors.name && <span className="portal-field-error">{fieldErrors.name}</span>}</label>
      <label>Phone *<input name="phone" type="tel" autoComplete="tel" defaultValue={userProfile?.phone ?? ""} required minLength={7} maxLength={25} aria-invalid={Boolean(fieldErrors.phone)} />{fieldErrors.phone && <span className="portal-field-error">{fieldErrors.phone}</span>}</label>
      <label className="full">Address<textarea name="address" autoComplete="street-address" defaultValue={userProfile?.address ?? ""} maxLength={300} aria-invalid={Boolean(fieldErrors.address)} />{fieldErrors.address && <span className="portal-field-error">{fieldErrors.address}</span>}</label>
      <label className="full">Google account email<input value={userProfile?.email ?? ""} disabled /></label>
      <PortalToast message={error} tone="error" />
      <PortalToast message={message} />
      <div className="portal-actions full"><button className="portal-button" disabled={busy}>{busy ? "Saving..." : completion ? "Save and continue" : "Save profile"}</button></div>
    </form>
  </PortalShell>;
}
