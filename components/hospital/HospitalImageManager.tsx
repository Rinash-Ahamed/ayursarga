"use client";

import { useRef, useState } from "react";
import { authorizedApiRequest } from "@/services/api/client";
import { MAX_HOSPITAL_IMAGES } from "@/features/hospitals/images";
import { prepareHospitalImage } from "@/utils/prepareHospitalImage";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";

type Props = {
  hospitalId: string;
  hospitalName: string;
  imageUrls: string[];
  onChange: (imageUrls: string[]) => void;
  disabled?: boolean;
};

export function HospitalImageManager({ hospitalId, hospitalName, imageUrls, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError, errorNotification] = useRepeatableMessage();
  const [message, setMessage, messageNotification] = useRepeatableMessage();
  const endpoint = `/api/hospitals/${encodeURIComponent(hospitalId)}/images`;

  async function upload(files: File[]) {
    if (!files.length || busy || disabled) return;
    setError(null);
    setMessage(null);
    if (files.length + imageUrls.length > MAX_HOSPITAL_IMAGES) {
      setError(`Choose up to ${MAX_HOSPITAL_IMAGES - imageUrls.length} more images for this centre.`);
      return;
    }
    setBusy(true);
    try {
      for (const [index, file] of files.entries()) {
        setProgress(`Uploading image ${index + 1} of ${files.length}...`);
        const image = await prepareHospitalImage(file);
        const result = await authorizedApiRequest<{ imageUrls: string[] }>(endpoint, {
          method: "POST", headers: { "Content-Type": image.type }, body: image,
          signedOutMessage: "Your session has expired. Sign in again to upload images.",
          failureMessage: "We could not upload this image. Please try again.",
        });
        onChange(result.imageUrls);
      }
      setMessage(files.length === 1 ? "The hospital image has been uploaded." : "The hospital images have been uploaded.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not upload the images. Please try again.");
    } finally {
      setBusy(false);
      setProgress("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!removing || busy || disabled) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await authorizedApiRequest<{ imageUrls: string[] }>(endpoint, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: removing }),
        signedOutMessage: "Your session has expired. Sign in again to update images.",
        failureMessage: "We could not remove this image. Please try again.",
      });
      onChange(result.imageUrls);
      setRemoving(null);
      setMessage("The image has been removed from the centre gallery.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not remove this image. Please try again.");
    } finally { setBusy(false); }
  }

  return <div className="portal-image-manager" aria-busy={busy}>
    <p className="portal-form-note">Add up to 10 photos of your centre. JPG, PNG or WebP, up to 15 MB each. Images are automatically resized and cropped to a consistent 4:3 frame.</p>
    {imageUrls.length > 0 && <div className="portal-hospital-gallery">
      {imageUrls.map((url, index) => <div className="portal-image-manager-item" key={url}>
        <a href={url} target="_blank" rel="noreferrer" aria-label={`View ${hospitalName} image ${index + 1}`}>
          {/* Existing approved external links and uploaded Storage images share this gallery. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`${hospitalName} image ${index + 1}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        </a>
        <button className="portal-button secondary" type="button" disabled={busy || disabled} onClick={() => setRemoving(url)} aria-label={`Remove centre image ${index + 1}`}>Remove</button>
      </div>)}
    </div>}
    <div className="portal-actions">
      <input className="portal-image-file-input" ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || disabled || imageUrls.length >= MAX_HOSPITAL_IMAGES} onChange={(event) => void upload(Array.from(event.target.files ?? []))} aria-label="Select hospital images" tabIndex={-1} />
      <button className="portal-button secondary" type="button" disabled={busy || disabled || imageUrls.length >= MAX_HOSPITAL_IMAGES} onClick={() => inputRef.current?.click()}>{busy ? progress || "Saving..." : "Upload images"}</button>
      <span className="portal-image-count" role="status">{imageUrls.length} of {MAX_HOSPITAL_IMAGES} images added</span>
    </div>
    {error && <p className="portal-form-error" role="alert">{error}</p>}
    <PortalToast message={error} notification={errorNotification} tone="error" />
    <PortalToast message={message} notification={messageNotification} />
    <PortalDialog open={Boolean(removing)} title="Remove this image?" message="This image will no longer appear in the centre gallery." confirmLabel="Remove image" busy={busy} onCancel={() => setRemoving(null)} onConfirm={() => void remove()} />
  </div>;
}
