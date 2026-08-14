import { IndiaStateSelect } from "@/components/forms/IndiaStateSelect";
import type { HospitalDocument } from "@/features/firestore/models";
import type { HospitalField, HospitalValidationErrors } from "@/features/hospitals/validation";

type HospitalFormDefaults = Partial<Pick<HospitalDocument,
  "name" | "email" | "phone" | "city" | "state" | "address" | "description" | "commissionPercentage"
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
  return <>
    <label>Hospital name *<input name="name" defaultValue={defaultValues.name} required minLength={2} maxLength={120} aria-invalid={Boolean(errors.name)} /><FieldError field="name" errors={errors} /></label>
    <label>Official email *<input name="email" type="email" defaultValue={defaultValues.email} required maxLength={160} aria-invalid={Boolean(errors.email)} /><FieldError field="email" errors={errors} /></label>
    <label>Phone *<input name="phone" type="tel" defaultValue={defaultValues.phone} required minLength={7} maxLength={25} aria-invalid={Boolean(errors.phone)} /><FieldError field="phone" errors={errors} /></label>
    <label>City / locality *<input name="city" defaultValue={defaultValues.city} required minLength={2} maxLength={80} aria-invalid={Boolean(errors.city)} /><FieldError field="city" errors={errors} /></label>
    <label>State *<IndiaStateSelect name="state" defaultValue={defaultValues.state} required aria-invalid={Boolean(errors.state)} /><FieldError field="state" errors={errors} /></label>
    {includeCommission && <label>Commission % *<input name="commission" type="number" defaultValue={defaultValues.commissionPercentage} min="0" max="100" step="0.01" required aria-invalid={Boolean(errors.commissionPercentage)} /><FieldError field="commissionPercentage" errors={errors} /></label>}
    <label className="full">Complete address *<input name="address" defaultValue={defaultValues.address} required minLength={10} maxLength={300} aria-invalid={Boolean(errors.address)} /><FieldError field="address" errors={errors} /></label>
    <label className="full">Description<textarea name="description" defaultValue={defaultValues.description} maxLength={2000} /></label>
  </>;
}
