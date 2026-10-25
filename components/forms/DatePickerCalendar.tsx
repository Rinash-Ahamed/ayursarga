"use client";

import { useId, useState } from "react";
import { ModalLayer } from "@/components/ModalLayer";
import { formatDisplayDate, isIsoDate, toDateInputValue } from "@/utils/date";

/** Only restricted calendars use this layer; ordinary DateInput keeps its native picker. */
export function DatePickerCalendar({ value, min, max, isDateAllowed, onSelect, onClose }: {
  value: string; min?: string; max?: string;
  isDateAllowed: (date: string) => boolean;
  onSelect: (date: string) => void; onClose: () => void;
}) {
  const titleId = useId();
  const [month, setMonth] = useState(() => (isIsoDate(value) ? value : min || toDateInputValue()).slice(0, 7));
  const first = new Date(`${month}-01T12:00:00Z`);
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const previous = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1, 12)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1, 12)).toISOString().slice(0, 7);
  return <ModalLayer open className="portal-dialog-backdrop" onClose={onClose}>
    <section className="portal-dialog date-picker-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <h2 id={titleId}>Choose appointment date</h2>
      <p>Unavailable dates are disabled.</p>
      <div className="date-picker-month">
        <button type="button" aria-label="Previous month" disabled={Boolean(min && month <= min.slice(0, 7))} onClick={() => setMonth(previous)}>‹</button>
        <strong aria-live="polite">{first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</strong>
        <button type="button" aria-label="Next month" disabled={Boolean(max && month >= max.slice(0, 7))} onClick={() => setMonth(next)}>›</button>
      </div>
      <div className="date-picker-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
        {Array.from({ length: first.getUTCDay() }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const date = `${month}-${String(index + 1).padStart(2, "0")}`;
          const allowed = (!min || date >= min) && (!max || date <= max) && isDateAllowed(date);
          return <button key={date} type="button" aria-label={formatDisplayDate(date)} aria-pressed={date === value} disabled={!allowed} onClick={() => onSelect(date)}>{index + 1}</button>;
        })}
      </div>
      <div className="portal-actions"><button type="button" className="portal-button secondary" onClick={onClose}>Close calendar</button></div>
    </section>
  </ModalLayer>;
}
