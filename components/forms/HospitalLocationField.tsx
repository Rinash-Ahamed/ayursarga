export function HospitalLocationField({ defaultValue, error }: { defaultValue?: string | null; error?: string | null }) {
  return <fieldset className="portal-location-field full">
    <legend>Centre location</legend>
    <p>In Google Maps, choose Share, Embed a map, then copy the HTML. Paste the full iframe code or only its HTTPS source link below. Ayursarga stores only the validated map URL.</p>
    <label>Map embed code or link
      <textarea name="hospitalLocationUrl" defaultValue={defaultValue ?? ""} maxLength={5000} rows={4} placeholder={'<iframe src="https://www.google.com/maps/embed?..." ...></iframe>'} aria-invalid={Boolean(error)} />
    </label>
    {error && <span className="portal-field-error" role="alert">{error}</span>}
  </fieldset>;
}
