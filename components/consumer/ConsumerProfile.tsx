"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalToast } from "@/components/portal/PortalToast";
import { getSafeRoleRedirect } from "@/features/auth/roles";
import { validateConsumerContact } from "@/features/consumers/profileValidation";
import { hasCurrentConsumerPrivacyConsent } from "@/features/consumers/privacyConsent";
import { useAuth } from "@/hooks/useAuth";
import { updateUserProfile } from "@/services/users/userService";

export function ConsumerProfile({ completion = false, requestedPath }: { completion?: boolean; requestedPath?: string }) {
  const router = useRouter();
  const { firebaseUser, userProfile, refreshUserProfile } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"name" | "phone" | "address" | "privacyConsent", string>>>({});
  const [busy, setBusy] = useState(false);
  const needsPrivacyConsent = !hasCurrentConsumerPrivacyConsent(userProfile);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseUser) return;
    const data = new FormData(event.currentTarget);
    const validation = validateConsumerContact({
      name: data.get("name"),
      phone: data.get("phone"),
      address: data.get("address"),
      privacyConsent: data.get("privacyConsent"),
    }, needsPrivacyConsent);
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
      {needsPrivacyConsent ? <fieldset className="portal-consent full">
        <legend>Privacy consent *</legend>
        <p>Ayursarga will process your name, Google email, phone number, optional address, wellness preferences, and booking information to provide your account, personal guidance, center discovery, and appointment-request services. Your contact and booking details are shared only with the center you choose when you request an appointment. You may withdraw consent by contacting <a href="mailto:info@ayursarga.com">info@ayursarga.com</a>.</p>
        <label className="portal-consent-choice">
          <input name="privacyConsent" type="checkbox" required aria-invalid={Boolean(fieldErrors.privacyConsent)} />
          <span>I have read this notice and consent to the processing of my personal data for these purposes.</span>
        </label>
        {fieldErrors.privacyConsent && <span className="portal-field-error">{fieldErrors.privacyConsent}</span>}
      </fieldset> : <p className="portal-consent-recorded full">Privacy consent is recorded for this Consumer profile. To withdraw it, contact <a href="mailto:info@ayursarga.com">info@ayursarga.com</a>.</p>}
      <PortalToast message={error} tone="error" />
      <PortalToast message={message} />
      <div className="portal-actions full"><button className="portal-button" disabled={busy}>{busy ? "Saving..." : completion ? "Save and continue" : "Save profile"}</button></div>
    </form>
  </PortalShell>;
}
