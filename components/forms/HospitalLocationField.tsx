export function HospitalLocationField({ defaultValue, error }: { defaultValue?: string | null; error?: string | null }) {
  return <fieldset className="portal-location-field full">
    <legend>Centre location</legend>
    <p>Find the centre in Google Maps, choose Share → Embed a map → Copy HTML, then paste it below. You can also paste a supported Google Maps or OpenStreetMap link.</p>
    <label>Map embed code or link
      <textarea name="hospitalLocationUrl" defaultValue={defaultValue ?? ""} maxLength={5000} rows={4} placeholder="Paste the map link or copied embed code" aria-invalid={Boolean(error)} />
    </label>
    {error && <span className="portal-field-error" role="alert">{error}</span>}
  </fieldset>;
}
