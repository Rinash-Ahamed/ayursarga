"use client";

import { useId } from "react";

export function HospitalLocationField({ defaultValue, error }: { defaultValue?: string | null; error?: string | null }) {
  const errorId = useId();
  return <fieldset className="portal-location-field full">
    <legend>Centre location</legend>
    <p>Find the centre in Google Maps, choose Share → Embed a map → Copy HTML, then paste it below. You can also paste a supported Google Maps or OpenStreetMap link.</p>
    <label>Map embed code or link *
      <textarea name="hospitalLocationUrl" defaultValue={defaultValue ?? ""} required maxLength={5000} rows={4} placeholder="Paste the map link or copied embed code" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />
    </label>
    {error && <span id={errorId} className="portal-field-error" role="alert">{error}</span>}
  </fieldset>;
}
