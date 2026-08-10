"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { HospitalDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { getHospital, updateHospitalProfile } from "@/services/hospitals/hospitalService";
import { hospitalFormValues, validateHospitalFields, type HospitalValidationErrors } from "@/features/hospitals/validation";
import { useAuth } from "@/hooks/useAuth";
import { PortalShell } from "@/components/portal/PortalShell";
import { IndiaStateSelect } from "@/components/forms/IndiaStateSelect";

export function HospitalProfile() {
  const { userProfile } = useAuth();
  const id = userProfile?.hospitalId;
  const [hospital, setHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<HospitalValidationErrors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id) void getHospital(id).then(setHospital).catch(() => setError("We could not load the hospital profile. Refresh the page and try again."));
  }, [id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !hospital) return;
    const values = hospitalFormValues(new FormData(event.currentTarget));
    const validation = validateHospitalFields({ ...values, commissionPercentage: hospital.commissionPercentage });
    setFieldErrors(validation.errors);
    setMessage(null);
    setError(null);
    if (!validation.isValid) {
      setError("Please check the highlighted fields, then save the profile again.");
      return;
    }

    setBusy(true);
    try {
      const profile = {
        name: validation.data.name,
        email: validation.data.email,
        phone: validation.data.phone,
        address: validation.data.address,
        city: validation.data.city,
        state: validation.data.state,
        description: validation.data.description,
      };
      await updateHospitalProfile(id, profile, hospital);
      setHospital((current) => current ? { ...current, ...profile } : current);
      setMessage("The hospital profile has been updated.");
    } catch {
      setError("We could not save the hospital profile. Check the details and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <PortalShell role="hospital" title="Hospital Profile">{hospital && <form className="portal-card portal-form" onSubmit={submit} noValidate>
    <p className="full portal-form-note">Complete every field marked with * before saving the hospital profile.</p>
    <label>Hospital name *<input name="name" defaultValue={hospital.name} required minLength={2} maxLength={120} aria-invalid={Boolean(fieldErrors.name)} />{fieldErrors.name && <span className="portal-field-error">{fieldErrors.name}</span>}</label>
    <label>Official email *<input name="email" type="email" defaultValue={hospital.email} required maxLength={160} aria-invalid={Boolean(fieldErrors.email)} />{fieldErrors.email && <span className="portal-field-error">{fieldErrors.email}</span>}</label>
    <label>Phone *<input name="phone" type="tel" defaultValue={hospital.phone} required minLength={7} maxLength={25} aria-invalid={Boolean(fieldErrors.phone)} />{fieldErrors.phone && <span className="portal-field-error">{fieldErrors.phone}</span>}</label>
    <label>City / locality *<input name="city" defaultValue={hospital.city} required minLength={2} maxLength={80} aria-invalid={Boolean(fieldErrors.city)} />{fieldErrors.city && <span className="portal-field-error">{fieldErrors.city}</span>}</label>
    <label>State *<IndiaStateSelect name="state" defaultValue={hospital.state} required aria-invalid={Boolean(fieldErrors.state)} />{fieldErrors.state && <span className="portal-field-error">{fieldErrors.state}</span>}</label>
    <label className="full">Complete address *<input name="address" defaultValue={hospital.address} required minLength={10} maxLength={300} aria-invalid={Boolean(fieldErrors.address)} />{fieldErrors.address && <span className="portal-field-error">{fieldErrors.address}</span>}</label>
    <label className="full">Description<textarea name="description" defaultValue={hospital.description} maxLength={2000} aria-invalid={Boolean(fieldErrors.description)} />{fieldErrors.description && <span className="portal-field-error">{fieldErrors.description}</span>}</label>
    {error && <p className="portal-form-error full" role="alert">{error}</p>}
    {message && <p className="portal-form-success full">{message}</p>}
    <div className="portal-actions full"><button className="portal-button" disabled={busy}>{busy ? "Saving..." : "Save profile"}</button></div>
  </form>}</PortalShell>;
}
