"use client";

import type { ChangeEvent, InputHTMLAttributes } from "react";
import { PHONE_NUMBER_LENGTH, sanitizePhoneNumber } from "@/utils/phone";

type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "minLength" | "maxLength" | "pattern"
>;

export function PhoneInput({ defaultValue, value, onChange, ...props }: PhoneInputProps) {
  const normalizedDefault = typeof defaultValue === "string" || typeof defaultValue === "number"
    ? sanitizePhoneNumber(String(defaultValue))
    : defaultValue;
  const normalizedValue = typeof value === "string" || typeof value === "number"
    ? sanitizePhoneNumber(String(value))
    : value;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    event.currentTarget.value = sanitizePhoneNumber(event.currentTarget.value);
    onChange?.(event);
  }

  return <input
    {...props}
    type="tel"
    inputMode="numeric"
    pattern="[0-9]{10}"
    minLength={PHONE_NUMBER_LENGTH}
    maxLength={PHONE_NUMBER_LENGTH}
    title="Enter a 10-digit phone number"
    defaultValue={normalizedDefault}
    value={normalizedValue}
    onChange={handleChange}
  />;
}
