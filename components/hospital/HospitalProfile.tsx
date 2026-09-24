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
import { hospitalGuidelineFormValues } from "@/features/hospitals/guidelines";
import { CentreGuidelineFields } from "@/components/forms/CentreGuidelineFields";
import { BystanderPolicyFields } from "@/components/forms/BystanderPolicyFields";
import { hospitalBystanderFormValues } from "@/features/hospitals/bystanders";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";

export function HospitalProfile() {
  const { userProfile } = useAuth();
  const id = userProfile?.hospitalId;
  const [hospital, setHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [message, setMessage] = useRepeatableMessage();
  const [error, setError] = useRepeatableMessage();
  const [fieldErrors, setFieldErrors] = useState<HospitalValidationErrors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id) void getHospital(id).then(setHospital).catch(() => setError("We could not load the hospital profile. Refresh the page and try again."));
  }, [id, setError]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !hospital) return;
    const form = new FormData(event.currentTarget);
    const values = hospitalFormValues(form);
    const validation = validateHospitalFields({ ...values, commissionPercentage: hospital.commissionPercentage });
    const guidelines = hospitalGuidelineFormValues(form);
    const bystanderPolicy = hospitalBystanderFormValues(form);
    setFieldErrors(validation.errors);
    const profileError = guidelines.error ?? bystanderPolicy.error;
    setMessage(null);
    setError(null);
    if (!validation.isValid || profileError || !bystanderPolicy.data) {
      setError(profileError ?? "Please check the highlighted fields, then save the profile again.");
      return;
    }

    setBusy(true);
    try {
      const profile = {
        name: validation.data.name,
        email: validation.data.email,
        phone: validation.data.phone,
        hospitalPhone1: validation.data.hospitalPhone1,
        hospitalPhone2: validation.data.hospitalPhone2,
        address: validation.data.address,
        city: validation.data.city,
        district: validation.data.district,
        state: validation.data.state,
        description: validation.data.description,
        centreGuidelines: guidelines.centreGuidelines,
        additionalCentreRules: guidelines.additionalCentreRules,
        facilities: guidelines.facilities,
        legalPolicies: guidelines.legalPolicies,
        ...bystanderPolicy.data,
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

  return <PortalShell role="hospital" title="Profile">{hospital && <form className="portal-card portal-form" onSubmit={submit} noValidate>
    <p className="full portal-form-note">Complete every field marked with * before saving the hospital profile.</p>
    <HospitalFormFields defaultValues={hospital} errors={fieldErrors} />
    <BystanderPolicyFields hospital={hospital} />
    <CentreGuidelineFields hospital={hospital} />
    <PortalToast message={error} tone="error" />
    <PortalToast message={message} />
    <div className="portal-actions full"><button className="portal-button" disabled={busy}>{busy ? "Saving..." : "Save profile"}</button></div>
  </form>}</PortalShell>;
}
