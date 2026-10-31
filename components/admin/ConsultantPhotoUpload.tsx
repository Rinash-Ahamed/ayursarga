"use client";
import { useRef, useState } from "react";
import { authorizedApiRequest } from "@/services/api/client";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { PortalToast } from "@/components/portal/PortalToast";

export function ConsultantPhotoUpload({ consultantId, imageUrl, disabled, onChange }: {
  consultantId: string; imageUrl?: string | null; disabled?: boolean; onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const [error, setError, notification] = useRepeatableMessage();
  const [message, setMessage, messageNotification] = useRepeatableMessage();
  async function upload(file?: File) {
    if (!file || pending.current || disabled) return;
    setError(null); setMessage(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError("Choose a JPG, PNG or WebP photo up to 8 MB.");
      if (input.current) input.current.value = "";
      return;
    }
    pending.current = true; setBusy(true);
    try {
      const result = await authorizedApiRequest<{ imageUrl: string }>(`/api/admin/consultants/${encodeURIComponent(consultantId)}/image`, {
        method: "POST", headers: { "Content-Type": file.type, "X-Expected-Image-Url": imageUrl ?? "" }, body: file,
        signedOutMessage: "Sign in as Admin to upload a consultant photo.", failureMessage: "We could not save the consultant photo.",
      });
      onChange(result.imageUrl); setMessage("Consultant photo saved.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not save this photo."); }
    finally { pending.current = false; setBusy(false); if (input.current) input.current.value = ""; }
  }
  return <div className="consultant-photo-upload" aria-busy={busy}>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Consultant photo" hidden disabled={busy || disabled} onChange={event => void upload(event.target.files?.[0])} />
    <button className="portal-button secondary" type="button" disabled={busy || disabled} onClick={() => input.current?.click()}>{busy ? "Uploading photo..." : imageUrl ? "Replace photo" : "Upload photo"}</button>
    <small>Consumer-visible photo · JPG, PNG or WebP · up to 8 MB</small>
    {error && <p className="portal-form-error" role="alert">{error}</p>}
    <PortalToast message={error} notification={notification} tone="error" />
    <PortalToast message={message} notification={messageNotification} />
  </div>;
}
