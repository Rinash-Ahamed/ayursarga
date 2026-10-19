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
import { focusFirstInvalidField } from "@/utils/formFocus";
import { HospitalImageManager } from "@/components/hospital/HospitalImageManager";
import { getHospitalImageUrls } from "@/features/hospitals/images";

export function HospitalProfile() {
  const { userProfile } = useAuth();
  const id = userProfile?.hospitalId;
  const [hospital, setHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [message, setMessage, messageNotification] = useRepeatableMessage();
  const [error, setError, errorNotification] = useRepeatableMessage();
  const [fieldErrors, setFieldErrors] = useState<HospitalValidationErrors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (id) void getHospital(id).then((record) => { if (active) setHospital(record); }).catch(() => {
      if (active) setError("We could not load the hospital profile. Refresh the page and try again.");
    });
    return () => { active = false; };
  }, [id, setError]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !hospital || busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
      focusFirstInvalidField(formElement);
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
        registeredAddress: validation.data.registeredAddress,
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
      await updateHospitalProfile(id, profile);
      setHospital((current) => current ? { ...current, ...profile } : current);
      setMessage("The hospital profile has been updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save the hospital profile. Check the details and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <PortalShell role="hospital" title="Profile">{hospital && <form className="portal-card portal-form" onSubmit={submit} noValidate>
    <p className="full portal-form-note">Complete every field marked with * before saving the hospital profile.</p>
    <HospitalFormFields defaultValues={hospital} errors={fieldErrors} />
    <BystanderPolicyFields hospital={hospital} />
    <CentreGuidelineFields hospital={hospital} />
    <PortalToast message={error} notification={errorNotification} tone="error" />
    <PortalToast message={message} notification={messageNotification} />
    <div className="portal-actions full">{error && <p className="portal-form-error">{error}</p>}<button className="portal-button" disabled={busy}>{busy ? "Saving..." : "Save profile"}</button></div>
  </form>}{hospital && <section className="portal-card portal-hospital-media-card">
    <h2>Centre images</h2>
    <HospitalImageManager hospitalId={hospital.id} hospitalName={hospital.name} imageUrls={getHospitalImageUrls(hospital)} disabled={busy} onChange={(imageUrls) => setHospital((current) => current ? { ...current, imageUrls, imageUrl: null } : current)} />
  </section>}</PortalShell>;
}
