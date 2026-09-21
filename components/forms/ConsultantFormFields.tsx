"use client";

import { useState } from "react";
import type { ConsultantDocument } from "@/features/firestore/models";
import type { ConsultantField, ConsultantValidationErrors } from "@/features/consultants/validation";

type ConsultantDefaults = Partial<ConsultantDocument>;

function FieldError({ field, errors }: { field: ConsultantField; errors: ConsultantValidationErrors }) {
  return errors[field] ? <span className="portal-field-error" role="alert">{errors[field]}</span> : null;
}

export function ConsultantFormFields({ defaultValues = {}, errors }: {
  defaultValues?: ConsultantDefaults;
  errors: ConsultantValidationErrors;
}) {
  const initialContact = defaultValues.contactNo ?? "";
  const initialWhatsapp = defaultValues.whatsappNo ?? "";
  const [contactNo, setContactNo] = useState(initialContact);
  const [whatsappNo, setWhatsappNo] = useState(initialWhatsapp);
  const [sameAsContact, setSameAsContact] = useState(Boolean(initialContact && initialContact === initialWhatsapp));

  return <>
    <label>Name *<input name="name" defaultValue={defaultValues.name} required minLength={2} maxLength={120} autoComplete="name" aria-invalid={Boolean(errors.name)} /><FieldError field="name" errors={errors} /></label>
    <label>Email *<input name="email" type="email" defaultValue={defaultValues.email} required maxLength={160} autoComplete="email" aria-invalid={Boolean(errors.email)} /><FieldError field="email" errors={errors} /></label>
    <label>Contact No. *<input name="contactNo" type="tel" value={contactNo} required minLength={7} maxLength={25} autoComplete="tel" aria-invalid={Boolean(errors.contactNo)} onChange={(event) => {
      const value = event.target.value;
      setContactNo(value);
      if (sameAsContact) setWhatsappNo(value);
    }} /><FieldError field="contactNo" errors={errors} /></label>
    <div className="portal-form-field"><label>WhatsApp No. *<input name="whatsappNo" type="tel" value={whatsappNo} required minLength={7} maxLength={25} aria-invalid={Boolean(errors.whatsappNo)} disabled={sameAsContact} onChange={(event) => setWhatsappNo(event.target.value)} /></label>
      {sameAsContact && <input type="hidden" name="whatsappNo" value={whatsappNo} />}
      <label className="portal-inline-check"><input type="checkbox" checked={sameAsContact} onChange={(event) => {
        setSameAsContact(event.target.checked);
        if (event.target.checked) setWhatsappNo(contactNo);
      }} />Same as contact number</label>
      <FieldError field="whatsappNo" errors={errors} />
    </div>
    <label>Qualification *<input name="qualification" defaultValue={defaultValues.qualification} required minLength={2} maxLength={200} aria-invalid={Boolean(errors.qualification)} /><FieldError field="qualification" errors={errors} /></label>
    <label>Years of experience *<input name="yearsExperience" type="number" defaultValue={defaultValues.yearsExperience ?? 0} required min="0" max="80" step="0.5" inputMode="decimal" aria-invalid={Boolean(errors.yearsExperience)} /><FieldError field="yearsExperience" errors={errors} /></label>
    <label>Last worked company <small>Optional</small><input name="lastWorkedCompany" defaultValue={defaultValues.lastWorkedCompany} maxLength={160} /></label>
    <label>Emergency Contact No. <small>Optional</small><input name="emergencyContactNo" type="tel" defaultValue={defaultValues.emergencyContactNo} minLength={7} maxLength={25} aria-invalid={Boolean(errors.emergencyContactNo)} /><FieldError field="emergencyContactNo" errors={errors} /></label>
    <label className="full">Address <small>Optional</small><textarea name="address" defaultValue={defaultValues.address} maxLength={400} autoComplete="street-address" /></label>
  </>;
}
