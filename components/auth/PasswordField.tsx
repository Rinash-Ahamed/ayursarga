"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_REQUIREMENTS,
} from "@/features/auth/password";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  showRequirements?: boolean;
};

export function PasswordField({ label, id, showRequirements = false, ...inputProps }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const requirementsId = `${inputId}-requirements`;
  const [isVisible, setIsVisible] = useState(false);

  return <div className="portal-password-group">
    <label htmlFor={inputId}>{label}</label>
    <div className="portal-password-field">
      <input
        {...inputProps}
        id={inputId}
        type={isVisible ? "text" : "password"}
        minLength={PASSWORD_MIN_LENGTH}
        pattern={PASSWORD_PATTERN}
        title={PASSWORD_REQUIREMENTS}
        aria-describedby={showRequirements ? requirementsId : inputProps["aria-describedby"]}
      />
      <button
        type="button"
        className="portal-password-toggle"
        aria-label={`${isVisible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        aria-pressed={isVisible}
        aria-controls={inputId}
        onClick={() => setIsVisible((visible) => !visible)}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.5" />
          {isVisible && <path d="m4 4 16 16" />}
        </svg>
      </button>
    </div>
    {showRequirements && <span id={requirementsId} className="portal-password-requirements">{PASSWORD_REQUIREMENTS}</span>}
  </div>;
}
