export function HospitalLocationField({ defaultValue, error }: { defaultValue?: string | null; error?: string | null }) {
  return <fieldset className="portal-location-field full">
    <legend>Centre location</legend>
    <p>Open the centre in Google Maps or OpenStreetMap, copy its public sharing link, and paste it below. This will appear beneath the centre&apos;s contact information.</p>
    <label>Map location link
      <input name="hospitalLocationUrl" type="url" defaultValue={defaultValue ?? ""} maxLength={500} placeholder="https://maps.app.goo.gl/..." aria-invalid={Boolean(error)} />
    </label>
    {error && <span className="portal-field-error" role="alert">{error}</span>}
  </fieldset>;
}
