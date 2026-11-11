"use client";

import { useRef, useState } from "react";
import { authorizedApiRequest } from "@/services/api/client";
import { hospitalImageSrcSet, MAX_HOSPITAL_IMAGES, MIN_PUBLIC_HOSPITAL_IMAGES } from "@/features/hospitals/images";
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
  isPublic?: boolean;
};

export function HospitalImageManager({ hospitalId, hospitalName, imageUrls, onChange, disabled, isPublic = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError, errorNotification] = useRepeatableMessage();
  const [message, setMessage, messageNotification] = useRepeatableMessage();
  const endpoint = `/api/hospitals/${encodeURIComponent(hospitalId)}/images`;
  const minimumReached = new Set(imageUrls).size >= MIN_PUBLIC_HOSPITAL_IMAGES;
  const canRemove = !isPublic || new Set(imageUrls).size > MIN_PUBLIC_HOSPITAL_IMAGES;

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
    <div className="portal-help-block">
      <p className="portal-form-note">Help customers get to know your centre with clear photos of its rooms, facilities and surroundings.</p>
      <ul className="portal-help-list">
        <li>Add at least {MIN_PUBLIC_HOSPITAL_IMAGES} different photos so your centre is ready to appear in Search Hospitals. You can add them a few at a time, up to {MAX_HOSPITAL_IMAGES} in total.</li>
        <li>Your first photo is the cover customers see in search results.</li>
        <li>Choose JPG, PNG or WebP files, up to 15 MB each. Check the previews below to make sure important details are visible.</li>
      </ul>
    </div>
    {!minimumReached && <p className="portal-form-note">Next step: add {MIN_PUBLIC_HOSPITAL_IMAGES - new Set(imageUrls).size} more {MIN_PUBLIC_HOSPITAL_IMAGES - new Set(imageUrls).size === 1 ? "photo" : "photos"} to complete your gallery.</p>}
    {isPublic && !canRemove && <p className="portal-form-note">Add a new photo before removing one. Your centre needs to keep at least {MIN_PUBLIC_HOSPITAL_IMAGES} different photos while it appears in search results.</p>}
    {imageUrls.length > 0 && <div className="portal-hospital-gallery">
      {imageUrls.map((url, index) => <div className="portal-image-manager-item" key={url}>
        <a href={url} target="_blank" rel="noreferrer" aria-label={`View ${hospitalName} image ${index + 1}${index === 0 ? ", cover image" : ""}`}>
          {/* Existing approved external links and uploaded Storage images share this gallery. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} srcSet={hospitalImageSrcSet(url)} sizes="(max-width: 600px) 50vw, 320px" width={1200} height={900} alt={`${hospitalName} image ${index + 1}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          {index === 0 && <span className="portal-image-cover-badge">Cover image</span>}
        </a>
        <button className="portal-button danger" type="button" disabled={busy || disabled || !canRemove} onClick={() => setRemoving(url)} aria-label={`Remove centre image ${index + 1}`}>Remove</button>
      </div>)}
    </div>}
    <div className="portal-actions">
      <input className="portal-image-file-input" ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || disabled || imageUrls.length >= MAX_HOSPITAL_IMAGES} onChange={(event) => void upload(Array.from(event.target.files ?? []))} aria-label="Select hospital images" tabIndex={-1} />
      <button className="portal-button" type="button" disabled={busy || disabled || imageUrls.length >= MAX_HOSPITAL_IMAGES} onClick={() => inputRef.current?.click()}>{busy ? progress || "Saving..." : "Upload images"}</button>
      <span className="portal-image-count" role="status">{imageUrls.length} of {MAX_HOSPITAL_IMAGES} images added</span>
    </div>
    {error && <p className="portal-form-error" role="alert">{error}</p>}
    <PortalToast message={error} notification={errorNotification} tone="error" />
    <PortalToast message={message} notification={messageNotification} />
    <PortalDialog open={Boolean(removing)} tone="danger" title="Remove this image?" message="This image will no longer appear in the centre gallery." confirmLabel="Remove image" busy={busy} onCancel={() => setRemoving(null)} onConfirm={() => void remove()} />
  </div>;
}
