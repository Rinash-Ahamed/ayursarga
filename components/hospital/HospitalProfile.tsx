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
import { HospitalImageFields } from "@/components/forms/HospitalImageFields";
import { HospitalImageGallery } from "@/components/hospital/HospitalImageGallery";
import { getHospitalImageUrls, validateHospitalImageUrls } from "@/features/hospitals/images";
import { hospitalGuidelineFormValues } from "@/features/hospitals/guidelines";
import { CentreGuidelineFields } from "@/components/forms/CentreGuidelineFields";
import { HospitalLocationField } from "@/components/forms/HospitalLocationField";
import { validateHospitalLocationUrl } from "@/features/hospitals/location";

export function HospitalProfile() {
  const { userProfile } = useAuth();
  const id = userProfile?.hospitalId;
  const [hospital, setHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<HospitalValidationErrors>({});
  const [imageError, setImageError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id) void getHospital(id).then(setHospital).catch(() => setError("We could not load the hospital profile. Refresh the page and try again."));
  }, [id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !hospital) return;
    const form = new FormData(event.currentTarget);
    const values = hospitalFormValues(form);
    const validation = validateHospitalFields({ ...values, commissionPercentage: hospital.commissionPercentage });
    const images = validateHospitalImageUrls(form.getAll("hospitalImageUrl"));
    const guidelines = hospitalGuidelineFormValues(form);
    const location = validateHospitalLocationUrl(form.get("hospitalLocationUrl"));
    setFieldErrors(validation.errors);
    setImageError(images.error);
    setLocationError(location.error);
    const profileError = guidelines.error ?? location.error;
    setMessage(null);
    setError(null);
    if (!validation.isValid || images.error || profileError) {
      setError(profileError ?? "Please check the highlighted fields, then save the profile again.");
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
        imageUrls: images.imageUrls,
        centreGuidelines: guidelines.centreGuidelines,
        additionalCentreRules: guidelines.additionalCentreRules,
        facilities: guidelines.facilities,
        legalPolicies: guidelines.legalPolicies,
        locationUrl: location.locationUrl,
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
    <HospitalImageGallery imageUrls={getHospitalImageUrls(hospital)} hospitalName={hospital.name} />
    <HospitalFormFields defaultValues={hospital} errors={fieldErrors} />
    <HospitalImageFields defaultValues={getHospitalImageUrls(hospital)} error={imageError} />
    <HospitalLocationField defaultValue={hospital.locationUrl} error={locationError} />
    <CentreGuidelineFields hospital={hospital} />
    <PortalToast message={error} tone="error" />
    <PortalToast message={message} />
    <div className="portal-actions full"><button className="portal-button" disabled={busy}>{busy ? "Saving..." : "Save profile"}</button></div>
  </form>}</PortalShell>;
}
