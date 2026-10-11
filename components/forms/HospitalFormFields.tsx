"use client";

import { useState } from "react";
import { IndiaStateDistrictFields } from "@/components/forms/IndiaStateDistrictFields";
import type { HospitalDocument } from "@/features/firestore/models";
import type { HospitalField, HospitalValidationErrors } from "@/features/hospitals/validation";
import { PhoneInput } from "@/components/forms/PhoneInput";

type HospitalFormDefaults = Partial<Pick<HospitalDocument,
  "name" | "email" | "phone" | "hospitalPhone1" | "hospitalPhone2" | "city" | "district" | "state" | "registeredAddress" | "address" | "description" | "commissionPercentage"
>>;

function FieldError({ field, errors }: { field: HospitalField; errors: HospitalValidationErrors }) {
  return errors[field] ? <span className="portal-field-error" role="alert">{errors[field]}</span> : null;
}

export function HospitalFormFields({
  defaultValues = {},
  errors,
  includeCommission = false,
}: {
  defaultValues?: HospitalFormDefaults;
  errors: HospitalValidationErrors;
  includeCommission?: boolean;
}) {
  const initialServiceAddress = defaultValues.address ?? "";
  const initialRegisteredAddress = defaultValues.registeredAddress ?? initialServiceAddress;
  const [registeredAddress, setRegisteredAddress] = useState(initialRegisteredAddress);
  const [serviceAddress, setServiceAddress] = useState(initialServiceAddress);
  const [sameAddress, setSameAddress] = useState(Boolean(
    initialServiceAddress && initialRegisteredAddress === initialServiceAddress,
  ));

  return <>
    <label>Hospital name *<input name="name" defaultValue={defaultValues.name} required minLength={2} maxLength={120} aria-invalid={Boolean(errors.name)} /><FieldError field="name" errors={errors} /></label>
    <label>Official email *<input name="email" type="email" defaultValue={defaultValues.email} required maxLength={160} aria-invalid={Boolean(errors.email)} /><FieldError field="email" errors={errors} /></label>
    <label>Owner WhatsApp No. *<PhoneInput name="phone" defaultValue={defaultValues.phone} required autoComplete="tel" aria-invalid={Boolean(errors.phone)} /><FieldError field="phone" errors={errors} /></label>
    <label>Hospital Phone 1 *<PhoneInput name="hospitalPhone1" defaultValue={defaultValues.hospitalPhone1} required autoComplete="tel" aria-invalid={Boolean(errors.hospitalPhone1)} /><FieldError field="hospitalPhone1" errors={errors} /></label>
    <label>Hospital Phone 2 <small>Optional</small><PhoneInput name="hospitalPhone2" defaultValue={defaultValues.hospitalPhone2 ?? ""} autoComplete="tel" aria-invalid={Boolean(errors.hospitalPhone2)} /><FieldError field="hospitalPhone2" errors={errors} /></label>
    <label>City / locality *<input name="city" defaultValue={defaultValues.city} required minLength={2} maxLength={80} aria-invalid={Boolean(errors.city)} /><FieldError field="city" errors={errors} /></label>
    <IndiaStateDistrictFields
      defaultState={defaultValues.state}
      defaultDistrict={defaultValues.district}
      stateError={errors.state}
      districtError={errors.district}
    />
    {includeCommission && <label>Commission % *<input name="commission" type="number" defaultValue={defaultValues.commissionPercentage} min="0" max="100" step="0.01" required aria-invalid={Boolean(errors.commissionPercentage)} /><FieldError field="commissionPercentage" errors={errors} /></label>}
    <label className="full">Registered address *<input name="registeredAddress" value={registeredAddress} onChange={(event) => {
      const value = event.target.value;
      setRegisteredAddress(value);
      if (sameAddress) setServiceAddress(value);
    }} required minLength={10} maxLength={300} aria-invalid={Boolean(errors.registeredAddress)} /><FieldError field="registeredAddress" errors={errors} /></label>
    <label className="portal-inline-check full">
      <input type="checkbox" checked={sameAddress} onChange={(event) => {
        const checked = event.target.checked;
        setSameAddress(checked);
        if (checked) setServiceAddress(registeredAddress);
      }} />
      Service address is the same as registered address
    </label>
    <label className="full">Service address *
      {sameAddress && <input type="hidden" name="address" value={serviceAddress} />}
      <input name={sameAddress ? undefined : "address"} value={serviceAddress} onChange={(event) => setServiceAddress(event.target.value)} disabled={sameAddress} required minLength={10} maxLength={300} aria-invalid={Boolean(errors.address)} />
      <FieldError field="address" errors={errors} />
    </label>
    <label className="full">Description<textarea name="description" defaultValue={defaultValues.description} maxLength={2000} /></label>
  </>;
}
