"use client";

import { useEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { formatDisplayDate, isIsoDate, parseDisplayDate } from "@/utils/date";

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue"> & { value?: string; defaultValue?: string };

/** Visible DD/MM/YYYY editor + native calendar. Named form values stay ISO. */
export function DateInput({ value, defaultValue = "", name, min, max, required, disabled, readOnly, onChange, onBlur, ...props }: DateInputProps) {
  const [localValue, setLocalValue] = useState(defaultValue);
  const iso = value ?? localValue;
  const [draft, setDraft] = useState(() => formatDisplayDate(iso));
  const [touched, setTouched] = useState(false);
  const [label, setLabel] = useState<string>();
  const ariaLabel = props["aria-label"];
  const ariaLabelledBy = props["aria-labelledby"];
  const nativeRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef(iso);
  const parsed = draft ? parseDisplayDate(draft) : "";
  const invalid = Boolean(draft && (!parsed || (min && parsed < String(min)) || (max && parsed > String(max))));
  const error = invalid ? "Enter a valid date in DD/MM/YYYY" + (min || max ? " within the allowed range." : ".") : "";

  useEffect(() => {
    // A calendar button inside an existing label must not become part of the
    // editor's accessible name (for example "Care date Open calendar").
    if (ariaLabel || ariaLabelledBy) return;
    const source = textRef.current?.labels?.[0]?.cloneNode(true) as HTMLElement | undefined;
    source?.querySelectorAll(".date-input-control").forEach((control) => control.remove());
    setLabel(source?.textContent?.trim() || undefined);
  }, [ariaLabel, ariaLabelledBy]);

  useEffect(() => {
    if (iso !== lastEmitted.current) {
      setDraft(formatDisplayDate(iso));
      lastEmitted.current = iso;
    }
  }, [iso]);

  useEffect(() => {
    textRef.current?.setCustomValidity(error);
    nativeRef.current?.setCustomValidity(error);
  }, [error]);

  useEffect(() => {
    const input = nativeRef.current;
    const form = input?.form;
    const sync = (event: Event) => {
      if (!input) return;
      const changed = lastEmitted.current !== input.value;
      setLocalValue(input.value);
      setDraft(formatDisplayDate(input.value));
      lastEmitted.current = input.value;
      // Safari can emit input before change/blur when its native picker commits.
      // Publish that value immediately; the later change event is deduplicated.
      if (changed) onChange?.({
        target: input, currentTarget: input, nativeEvent: event, type: "change",
        bubbles: event.bubbles, cancelable: event.cancelable, defaultPrevented: event.defaultPrevented,
        eventPhase: event.eventPhase, isTrusted: event.isTrusted, timeStamp: event.timeStamp,
        preventDefault: () => event.preventDefault(), stopPropagation: () => event.stopPropagation(),
        isDefaultPrevented: () => event.defaultPrevented, isPropagationStopped: () => event.cancelBubble, persist: () => {},
      });
    };
    const reset = () => {
      setLocalValue(defaultValue);
      setDraft(formatDisplayDate(value ?? defaultValue));
      setTouched(false);
      lastEmitted.current = value ?? defaultValue;
    };
    input?.addEventListener("input", sync);
    input?.addEventListener("change", sync);
    form?.addEventListener("reset", reset);
    return () => { input?.removeEventListener("input", sync); input?.removeEventListener("change", sync); form?.removeEventListener("reset", reset); };
  }, [defaultValue, value, onChange]);

  function emit(next: string, event: ChangeEvent<HTMLInputElement>) {
    const native = nativeRef.current;
    if (!native) return;
    const changed = lastEmitted.current !== next;
    lastEmitted.current = next;
    setLocalValue(next);
    native.value = next;
    if (changed) onChange?.({ ...event, target: native, currentTarget: native });
  }

  function openPicker() {
    const native = nativeRef.current;
    if (!native || disabled || readOnly) return;
    try { if (native.showPicker) native.showPicker(); else { native.focus(); native.click(); } } catch { native.focus(); }
  }

  return <span className="date-input-control">
    <input {...props} aria-label={ariaLabel ?? label} ref={textRef} type="text" className={`date-input-text ${props.className ?? ""}`} value={draft} disabled={disabled} readOnly={readOnly}
      required={required} inputMode="numeric" placeholder="DD/MM/YYYY" maxLength={10} autoComplete="off" aria-invalid={Boolean(props["aria-invalid"] || invalid)}
      onChange={(event) => {
        const raw = event.target.value;
        const digits = raw.replaceAll("/", "");
        const next = /^[\d/]*$/.test(raw) && raw.length > draft.length
          ? digits.slice(0, 2) + (digits.length >= 2 ? "/" : "") + digits.slice(2, 4) + (digits.length >= 4 ? "/" : "") + digits.slice(4, 8)
          : raw;
        setDraft(next);
        const date = parseDisplayDate(next);
        emit(date && (!min || date >= String(min)) && (!max || date <= String(max)) ? date : "", event);
      }}
      onBlur={(event) => { setTouched(true); if (parsed) setDraft(formatDisplayDate(parsed)); onBlur?.(event); }} />
    <button className="date-input-calendar" type="button" aria-label="Open calendar" disabled={disabled || readOnly} onClick={openPicker}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4m10-4v4M4 10h16M5 5h14v16H5Z" /></svg>
    </button>
    <input ref={nativeRef} type="date" className="date-input-picker" name={name} form={props.form} value={isIsoDate(iso) ? iso : ""} min={min} max={max} required={required}
      disabled={disabled} readOnly={readOnly} tabIndex={-1} aria-hidden="true" aria-invalid={Boolean(props["aria-invalid"] || invalid)} onClick={() => { try { nativeRef.current?.showPicker?.(); } catch { /* Native Safari picker remains available. */ } }}
      onChange={(event) => { setDraft(formatDisplayDate(event.target.value)); setTouched(false); emit(event.target.value, event); }} />
    {touched && error && <span className="date-input-error" role="alert">{error}</span>}
  </span>;
}
