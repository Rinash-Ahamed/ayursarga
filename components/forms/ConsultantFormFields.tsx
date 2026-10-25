"use client";

import { useState } from "react";
import type { ConsultantDocument } from "@/features/firestore/models";
import type { ConsultantField, ConsultantValidationErrors } from "@/features/consultants/validation";
import { CONSULTANT_WEEK_DAYS, CONSULTANT_DAY_LABELS, CONSULTANT_TIME_SLOTS, CONSULTANT_TIME_SLOT_CONFIG, type ConsultantTimeSlot } from "@/features/consultants/validation";
import { PhoneInput } from "@/components/forms/PhoneInput";
import { CONSULTATION_SERVICES } from "@/features/consultations/catalog";

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
  const [selectedSlots, setSelectedSlots] = useState<ConsultantTimeSlot[]>(defaultValues.preferredTimeSlots ?? []);

  return <>
    <label>Name *<input name="name" defaultValue={defaultValues.name} required minLength={2} maxLength={120} autoComplete="name" aria-invalid={Boolean(errors.name)} /><FieldError field="name" errors={errors} /></label>
    <label><span className="portal-field-label">Designation <small>(Optional)</small></span><input name="designation" defaultValue={defaultValues.designation} maxLength={120} aria-invalid={Boolean(errors.designation)} /><FieldError field="designation" errors={errors} /></label>
    <label><span className="portal-field-label">Consultant Charge (₹) <small>(Optional)</small></span><input name="consultantCharge" type="number" defaultValue={defaultValues.consultantCharge ?? ""} min="0" step="0.01" inputMode="decimal" aria-invalid={Boolean(errors.consultantCharge)} /><FieldError field="consultantCharge" errors={errors} /></label>
    <fieldset className="full consultant-preferences" aria-invalid={Boolean(errors.consultationServices)}>
      <legend>Online consultation services</legend>
      <p>Assign services this consultant can provide. Public booking also requires a charge and preferred availability.</p>
      <div className="consultant-slot-options">{CONSULTATION_SERVICES.map((service) => <label className="portal-inline-check" key={service.id}>
        <input type="checkbox" name="consultationServices" value={service.id} defaultChecked={defaultValues.consultationServices?.includes(service.id)} />{service.label}
      </label>)}</div>
      <FieldError field="consultationServices" errors={errors} />
    </fieldset>
    <fieldset className="full consultant-preferences" aria-invalid={Boolean(errors.preferredTimeSlots || errors.preferredDays)}>
      <legend>Preferred availability <small>Optional · select one or more</small></legend>
      <div className="consultant-day-options" role="group" aria-label="Preferred days">
        {CONSULTANT_WEEK_DAYS.map((day) => <label className="portal-inline-check" key={day}>
          <input type="checkbox" name="preferredDays" value={day} defaultChecked={defaultValues.preferredDays?.includes(day)} aria-invalid={Boolean(errors.preferredDays)} />{CONSULTANT_DAY_LABELS[day]}
        </label>)}
      </div>
      <FieldError field="preferredDays" errors={errors} />
      <div className="consultant-slot-options">{CONSULTANT_TIME_SLOTS.map((slot) => {
        const config = CONSULTANT_TIME_SLOT_CONFIG[slot];
        const timing = defaultValues.preferredSlotTimings?.[slot] ?? config;
        const selected = selectedSlots.includes(slot);
        return <div className="consultant-slot-option" key={slot}>
          <label className="portal-inline-check"><input type="checkbox" name="preferredTimeSlots" value={slot} checked={selected} onChange={(event) => setSelectedSlots((current) => event.target.checked ? [...current, slot] : current.filter((value) => value !== slot))} />{config.label}</label>
          <div className="consultant-slot-times" hidden={!selected}>
            <label>Start time<input type="time" name={`${slot}StartTime`} aria-label={`${config.label} start time`} defaultValue={timing.startTime} disabled={!selected} required={selected} aria-invalid={Boolean(errors.preferredSlotTimings)} /></label>
            <label>End time<input type="time" name={`${slot}EndTime`} aria-label={`${config.label} end time`} defaultValue={timing.endTime} disabled={!selected} required={selected} aria-invalid={Boolean(errors.preferredSlotTimings)} /></label>
          </div>
        </div>;
      })}</div>
      <FieldError field="preferredTimeSlots" errors={errors} />
      <FieldError field="preferredSlotTimings" errors={errors} />
    </fieldset>
    <label>Email *<input name="email" type="email" defaultValue={defaultValues.email} required maxLength={160} autoComplete="email" aria-invalid={Boolean(errors.email)} /><FieldError field="email" errors={errors} /></label>
    <label>Contact No. *<PhoneInput name="contactNo" value={contactNo} required autoComplete="tel" aria-invalid={Boolean(errors.contactNo)} onChange={(event) => {
      const value = event.target.value;
      setContactNo(value);
      if (sameAsContact) setWhatsappNo(value);
    }} /><FieldError field="contactNo" errors={errors} /></label>
    <div className="portal-form-field"><label>WhatsApp No. *<PhoneInput name="whatsappNo" value={whatsappNo} required aria-invalid={Boolean(errors.whatsappNo)} disabled={sameAsContact} onChange={(event) => setWhatsappNo(event.target.value)} /></label>
      {sameAsContact && <input type="hidden" name="whatsappNo" value={whatsappNo} />}
      <label className="portal-inline-check"><input type="checkbox" checked={sameAsContact} onChange={(event) => {
        setSameAsContact(event.target.checked);
        if (event.target.checked) setWhatsappNo(contactNo);
      }} />Same as contact number</label>
      <FieldError field="whatsappNo" errors={errors} />
    </div>
    <label>Qualification *<input name="qualification" defaultValue={defaultValues.qualification} required minLength={2} maxLength={200} aria-invalid={Boolean(errors.qualification)} /><FieldError field="qualification" errors={errors} /></label>
    <label>Years of experience *<input name="yearsExperience" type="number" defaultValue={defaultValues.yearsExperience ?? 0} required min="0" max="80" step="0.5" inputMode="decimal" aria-invalid={Boolean(errors.yearsExperience)} /><FieldError field="yearsExperience" errors={errors} /></label>
    <label><span className="portal-field-label">Last worked company <small>(Optional)</small></span><input name="lastWorkedCompany" defaultValue={defaultValues.lastWorkedCompany} maxLength={160} /></label>
    <label><span className="portal-field-label">Emergency Contact No. <small>(Optional)</small></span><PhoneInput name="emergencyContactNo" defaultValue={defaultValues.emergencyContactNo} aria-invalid={Boolean(errors.emergencyContactNo)} /><FieldError field="emergencyContactNo" errors={errors} /></label>
    <label className="full"><span className="portal-field-label">Address <small>(Optional)</small></span><textarea name="address" defaultValue={defaultValues.address} maxLength={400} autoComplete="street-address" /></label>
  </>;
}
