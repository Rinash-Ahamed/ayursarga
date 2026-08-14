"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { HospitalDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { getHospital, updateHospitalProfile } from "@/services/hospitals/hospitalService";
import { hospitalFormValues, validateHospitalFields, type HospitalValidationErrors } from "@/features/hospitals/validation";
import { useAuth } from "@/hooks/useAuth";
import { PortalShell } from "@/components/portal/PortalShell";
import { HospitalFormFields } from "@/components/forms/HospitalFormFields";
import { PortalToast } from "@/components/portal/PortalToast";

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
    <HospitalFormFields defaultValues={hospital} errors={fieldErrors} />
    <PortalToast message={error} tone="error" />
    <PortalToast message={message} />
    <div className="portal-actions full"><button className="portal-button" disabled={busy}>{busy ? "Saving..." : "Save profile"}</button></div>
  </form>}</PortalShell>;
}
