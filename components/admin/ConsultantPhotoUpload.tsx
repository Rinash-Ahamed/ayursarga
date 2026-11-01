"use client";
import { useRef, useState } from "react";
import { consultantPhotoFileError } from "@/features/consultants/photo";

export function ConsultantPhotoUpload({ file, imageUrl, disabled, onChange }: {
  file: File | null; imageUrl?: string | null; disabled?: boolean; onChange: (file: File | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  function select(selected?: File) {
    if (!selected || disabled) return;
    const invalid = consultantPhotoFileError(selected);
    setError(invalid);
    if (!invalid) onChange(selected);
    if (input.current) input.current.value = "";
  }
  return <div className="consultant-photo-upload full">
    <span className="portal-field-label">Photo <small>(Optional)</small></span>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Consultant photo" hidden disabled={disabled} onChange={event => select(event.target.files?.[0])} />
    <button className="portal-button secondary" type="button" disabled={disabled} onClick={() => input.current?.click()}>{file ? "Change selected photo" : imageUrl ? "Replace photo" : "Upload photo"}</button>
    {file && <button className="portal-button secondary" type="button" disabled={disabled} onClick={() => { onChange(null); setError(null); }}>Clear selected photo</button>}
    <small>JPG, PNG or WebP · up to 8 MB</small>
    <p className="portal-form-note">{file ? `${file.name} — saved when you save the consultant.` : "Choose the photo customers will see. It will be saved with the consultant details."}</p>
    {error && <p className="portal-form-error" role="alert">{error}</p>}
  </div>;
}
