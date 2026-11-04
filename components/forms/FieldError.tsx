/** Shared field-level feedback; keeps labels, spacing and alert semantics intact. */
export function FieldError<TField extends string>({ field, errors }: {
  field: TField; errors: Partial<Record<TField, string>>;
}) {
  return errors[field] ? <span className="portal-field-error" role="alert">{errors[field]}</span> : null;
}
