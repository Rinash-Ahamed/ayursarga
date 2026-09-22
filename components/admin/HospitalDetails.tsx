"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { HospitalDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import {
  activateHospital,
  archiveHospital,
  confirmHospitalContractSigning,
  deactivateHospital,
  getHospital,
  recordHospitalContractGeneration,
  updateHospital,
} from "@/services/hospitals/hospitalService";
import { buildHospitalContractPdf } from "@/features/hospitals/contractPdf";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalLoadGuard } from "@/components/portal/PortalLoadGuard";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { formatStatus } from "@/utils/text";
import { toDate } from "@/utils/date";
import { hospitalFormValues, validateHospitalFields, type HospitalValidationErrors } from "@/features/hospitals/validation";
import { HospitalFormFields } from "@/components/forms/HospitalFormFields";
import { sendHospitalLoginSetup } from "@/services/auth/hospitalAccountService";
import { AdminHospitalPackages } from "@/components/admin/HospitalPackages";
import { HospitalImageFields } from "@/components/forms/HospitalImageFields";
import { HospitalLocationField } from "@/components/forms/HospitalLocationField";
import { HospitalImageGallery } from "@/components/hospital/HospitalImageGallery";
import { getHospitalImageUrls, validateHospitalImageUrls } from "@/features/hospitals/images";
import { validateHospitalLocationUrl } from "@/features/hospitals/location";
import { CentreGuidelines } from "@/components/hospital/CentreGuidelines";
import { AdminHospitalCapacity } from "@/components/admin/HospitalCapacity";

function formatDate(value: unknown) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Not yet";
}

function isOnOrAfter(value: unknown, minimum: unknown) {
  const date = toDate(value);
  const minimumDate = toDate(minimum);
  return Boolean(date && minimumDate && date.getTime() >= minimumDate.getTime());
}

type PendingHospitalAction = "archive" | "sign" | "activate" | "setup" | "deactivate";

export function AdminHospitalDetails({ hospitalId }: { hospitalId: string }) {
  const router = useRouter();
  const [hospital, setHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [contractUrl, setContractUrl] = useState("");
  const [contractUrl2, setContractUrl2] = useState("");
  const [editing, setEditing] = useState(false);
  const [editingMedia, setEditingMedia] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<HospitalValidationErrors>({});
  const [imageError, setImageError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingHospitalAction | null>(null);
  const [assessmentRating, setAssessmentRating] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setHospital(null);
    setContractUrl("");
    setContractUrl2("");
    const record = await getHospital(hospitalId);
    if (record?.status === "archived") {
      setHospital(null);
      setLoading(false);
      router.replace("/admin/hospitals");
      return null;
    }
    setHospital(record);
    setContractUrl(record?.contractUrl ?? "");
    setContractUrl2(record?.contractUrl2 ?? "");
    setAssessmentRating(record?.ayursargaRating ?? null);
    setLoading(false);
    if (!record) setError("We could not find this hospital. Return to the hospital list and choose another record.");
    return record;
  }, [hospitalId, router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void reload().catch(() => {
        setError("We could not load these hospital details. Refresh the page and try again.");
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [reload]);

  async function runAction(action: (record: DocumentRecord<HospitalDocument>) => Promise<unknown>, success: string) {
    if (!hospital || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action(hospital);
      await reload();
      setMessage(success);
    } catch (caught) {
      await reload().catch(() => setLoading(false));
      setError(caught instanceof Error ? caught.message : "We could not complete that step. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPendingAction() {
    if (!hospital || !pendingAction) return;
    if (pendingAction === "archive") await runAction((record) => archiveHospital(record.id), "The hospital has been removed from the normal list. Its details and history are still safely stored.");
    if (pendingAction === "sign") await runAction((record) => confirmHospitalContractSigning(record.id, record, contractUrl, contractUrl2), "Both signed contracts have been confirmed. The hospital can now be activated.");
    if (pendingAction === "activate") await runAction(async (record) => {
      await activateHospital(record.id, record);
      await sendHospitalLoginSetup(record.id);
    }, `The hospital is active. A secure password setup link was sent to ${hospital.email}.`);
    if (pendingAction === "setup") await runAction(async (record) => {
      await sendHospitalLoginSetup(record.id);
    }, `A secure password setup/reset link was sent to ${hospital.email}.`);
    if (pendingAction === "deactivate") await runAction((record) => deactivateHospital(record.id), "The hospital is now inactive and hidden from consumers.");
    setPendingAction(null);
  }

  function generateContract() {
    if (!hospital || busy) return;
    void runAction(async (record) => {
      await recordHospitalContractGeneration(record.id);
      const contract = buildHospitalContractPdf(record);
      const url = URL.createObjectURL(contract.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = contract.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    }, "The contract PDF has been downloaded.");
  }

  async function saveHospitalDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hospital || busy) return;
    const form = new FormData(event.currentTarget);
    const validation = validateHospitalFields({
      ...hospitalFormValues(form),
      imageUrl: hospital.imageUrl,
      commissionPercentage: hospital.commissionPercentage,
    });
    setFieldErrors(validation.errors);
    setError(null);
    setMessage(null);
    if (!validation.isValid) {
      setError("Please check the highlighted fields, then save the details again.");
      return;
    }

    setBusy(true);
    try {
      await updateHospital(hospital.id, {
        name: validation.data.name,
        email: validation.data.email,
        phone: validation.data.phone,
        hospitalPhone1: validation.data.hospitalPhone1,
        hospitalPhone2: validation.data.hospitalPhone2,
        address: validation.data.address,
        city: validation.data.city,
        district: validation.data.district,
        state: validation.data.state,
        description: validation.data.description,
      });
      await reload();
      setEditing(false);
      setFieldErrors({});
      setMessage("The hospital details have been updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save the hospital details. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveHospitalMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hospital || busy) return;
    const form = new FormData(event.currentTarget);
    const images = validateHospitalImageUrls(form.getAll("hospitalImageUrl"));
    const location = validateHospitalLocationUrl(form.get("hospitalLocationUrl"));
    setImageError(images.error);
    setLocationError(location.error);
    setError(null);
    setMessage(null);
    if (images.error || location.error) {
      setError(images.error ?? location.error ?? "Check the hospital images and map details, then try again.");
      return;
    }

    setBusy(true);
    try {
      await updateHospital(hospital.id, { imageUrls: images.imageUrls, locationUrl: location.locationUrl });
      await reload();
      setEditingMedia(false);
      setImageError(null);
      setLocationError(null);
      setMessage("The hospital images and map have been updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save the hospital images and map. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function savePublicAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hospital || busy) return;
    if (hospital.status !== "active") {
      setError("Public assessments can be added only after the hospital is active.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const ratingValue = String(form.get("ayursargaRating") ?? "").trim();
    const reviewNote = String(form.get("ayursargaReviewNote") ?? "").trim().slice(0, 400);
    const rating = ratingValue ? Number(ratingValue) : null;
    if (rating !== null && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
      setError("Enter an Ayursarga assessment between 1 and 5.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await updateHospital(hospital.id, {
        ayursargaRating: rating === null ? null : Math.round(rating * 10) / 10,
        ayursargaReviewNote: reviewNote || null,
      });
      await reload();
      setMessage("The public Ayursarga assessment has been updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save the public assessment. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const contractStatus = hospital?.contractStatus ?? "not_generated";
  const generatedAt = hospital && contractStatus !== "not_generated" && isOnOrAfter(hospital.contractGeneratedAt, hospital.createdAt)
    ? hospital.contractGeneratedAt
    : null;
  const signedAt = hospital && contractStatus === "signed" && isOnOrAfter(hospital.contractSignedAt, hospital.createdAt)
    ? hospital.contractSignedAt
    : null;
  const signedAt2 = hospital && contractStatus === "signed" && isOnOrAfter(hospital.contractSignedAt2, hospital.createdAt)
    ? hospital.contractSignedAt2
    : null;
  const contractsReady = Boolean(signedAt && signedAt2 && hospital?.contractUrl && hospital?.contractUrl2);
  const activatedAt = hospital && hospital.status === "active" && signedAt && signedAt2 && isOnOrAfter(hospital.activatedAt, signedAt2)
    ? hospital.activatedAt
    : null;
  const actionDialog = pendingAction === "archive"
    ? { title: "Remove this hospital?", message: "It will be hidden from normal application views. Its protected history will remain stored.", confirmLabel: "Remove hospital", tone: "danger" as const }
    : pendingAction === "sign"
      ? { title: "Confirm both signed contracts?", message: "Confirm that both signed contract documents and their links have been received and checked.", confirmLabel: "Confirm contracts", tone: "default" as const }
      : pendingAction === "activate"
        ? { title: hospital?.status === "inactive" ? "Reactivate this hospital?" : "Activate this hospital?", message: "The hospital will become visible to consumers and receive a secure login setup email.", confirmLabel: hospital?.status === "inactive" ? "Reactivate hospital" : "Activate hospital", tone: "default" as const }
        : pendingAction === "setup"
          ? { title: "Send login setup link?", message: `A secure password setup/reset link will be sent to ${hospital?.email ?? "this hospital"}.`, confirmLabel: "Send setup link", tone: "default" as const }
          : { title: "Deactivate this hospital?", message: "The hospital will be hidden from consumers while its operational history remains stored.", confirmLabel: "Deactivate hospital", tone: "default" as const };
  return <PortalShell role="admin" title="Hospital Details">
    <PortalLoadGuard loading={loading} error={error} hasData={Boolean(hospital)} fallbackHref="/admin/hospitals" loadingMessage="Loading hospital details…" />
    <div className="portal-actions portal-page-actions"><Link className="portal-button secondary" href="/admin/hospitals">Back to hospitals</Link></div>
    <PortalFeedback error={error} empty={!error && !loading && !hospital ? "Return to Hospitals and choose a hospital to continue." : undefined} />
    <PortalToast message={message} />
    {hospital && <>
      <article className="portal-card">
        <div className="portal-row-heading"><h2>{hospital.name}</h2><span className="portal-status" data-status={hospital.status}>{formatStatus(hospital.status)}</span></div>
        {editing ? <form className="portal-form portal-edit-form" onSubmit={saveHospitalDetails} noValidate>
          <HospitalFormFields defaultValues={hospital} errors={fieldErrors} />
          <div className="portal-actions full"><button className="portal-button" disabled={busy}>{busy ? "Saving..." : "Save details"}</button><button className="portal-button secondary" type="button" disabled={busy} onClick={() => { setEditing(false); setFieldErrors({}); setError(null); }}>Cancel</button></div>
        </form> : <>
          <p>{hospital.description || "No description provided."}</p>
          <div className="portal-card-meta">
            <span>{hospital.email}</span><span>Owner WhatsApp: {hospital.phone}</span><span>Hospital Phone 1: {hospital.hospitalPhone1 || "Not added"}</span>{hospital.hospitalPhone2 && <span>Hospital Phone 2: {hospital.hospitalPhone2}</span>}<span>{hospital.city}{hospital.district ? `, ${hospital.district}` : ""}, {hospital.state}</span><span>Commission {hospital.commissionPercentage}%</span>
          </div>
          <p>{hospital.address}</p>
          {hospital.status !== "archived" && <div className="portal-actions">
            <button className="portal-button secondary" type="button" disabled={busy} onClick={() => { setEditing(true); setError(null); setMessage(null); }}>Edit hospital</button>
            <button className="portal-button danger" type="button" disabled={busy} onClick={() => setPendingAction("archive")}>Delete hospital</button>
          </div>}
        </>}
      </article>

      <article className="portal-card portal-hospital-media-card">
        <div className="portal-row-heading"><h2>Hospital images and map</h2><span className="portal-status" data-status={hospital.locationUrl || getHospitalImageUrls(hospital).length ? "active" : "pending"}>{hospital.locationUrl || getHospitalImageUrls(hospital).length ? "Added" : "Not added"}</span></div>
        {editingMedia ? <form className="portal-form portal-edit-form" onSubmit={saveHospitalMedia} noValidate>
          <HospitalImageFields defaultValues={getHospitalImageUrls(hospital)} error={imageError} />
          <HospitalLocationField defaultValue={hospital.locationUrl} error={locationError} />
          <div className="portal-actions full"><button className="portal-button" disabled={busy}>{busy ? "Saving..." : "Save images and map"}</button><button className="portal-button secondary" type="button" disabled={busy} onClick={() => { setEditingMedia(false); setImageError(null); setLocationError(null); setError(null); }}>Cancel</button></div>
        </form> : <>
          <HospitalImageGallery imageUrls={getHospitalImageUrls(hospital)} hospitalName={hospital.name} />
          <div className="portal-card-meta"><span>{getHospitalImageUrls(hospital).length} of 10 images added</span><span>{hospital.locationUrl ? "Map location added" : "Map location not added"}</span></div>
          {hospital.locationUrl && <p><a className="portal-inline-link" href={hospital.locationUrl} target="_blank" rel="noreferrer">View centre map</a></p>}
          {hospital.status !== "archived" && <div className="portal-actions"><button className="portal-button secondary" type="button" disabled={busy} onClick={() => { setEditingMedia(true); setError(null); setMessage(null); }}>Manage images and map</button></div>}
        </>}
      </article>

      <article className="portal-card portal-contract-card">
        <div className="portal-row-heading"><h2>Contract and approval</h2><span className="portal-status" data-status={contractStatus}>{formatStatus(contractStatus)}</span></div>
        <div className="portal-date-grid">
          <div><span>Created date</span><strong>{formatDate(hospital.createdAt)}</strong></div>
          <div><span>Contract generated</span><strong>{formatDate(generatedAt)}</strong></div>
          <div><span>Contract 1 signed date</span><strong>{formatDate(signedAt)}</strong></div>
          <div><span>Contract 2 signed date</span><strong>{formatDate(signedAt2)}</strong></div>
          <div><span>Active date</span><strong>{formatDate(activatedAt)}</strong></div>
        </div>
        {hospital.contractUrl && <p>Signed contract 1: <a className="portal-inline-link" href={hospital.contractUrl} target="_blank" rel="noreferrer">View contract</a></p>}
        {hospital.contractUrl2 && <p>Signed contract 2: <a className="portal-inline-link" href={hospital.contractUrl2} target="_blank" rel="noreferrer">View contract</a></p>}
        {hospital.status === "pending" && contractStatus !== "not_generated" && !contractsReady && <div className="portal-form portal-edit-form">
          <label className="portal-contract-url">Signed contract 1 URL *<input type="url" value={contractUrl} onChange={(event) => setContractUrl(event.target.value)} placeholder="https://" required /></label>
          <label className="portal-contract-url">Signed contract 2 URL *<input type="url" value={contractUrl2} onChange={(event) => setContractUrl2(event.target.value)} placeholder="https://" required /></label>
        </div>}
        <div className="portal-actions">
          {hospital.status === "pending" && <button className="portal-button secondary" type="button" disabled={busy} onClick={generateContract}>{contractStatus === "not_generated" ? "Download Contract PDF" : "Download Contract PDF Again"}</button>}
          {hospital.status === "pending" && contractStatus !== "not_generated" && !contractsReady && <button className="portal-button secondary" type="button" disabled={busy} onClick={() => {
            if (!contractUrl.trim() || !contractUrl2.trim()) {
              setError("Add both signed contract URLs before confirming the contracts.");
              return;
            }
            setPendingAction("sign");
          }}>Confirm signed contracts</button>}
          {(hospital.status === "pending" || hospital.status === "inactive") && contractStatus === "signed" && contractsReady && <button className="portal-button" type="button" disabled={busy} onClick={() => setPendingAction("activate")}>{hospital.status === "inactive" ? "Reactivate hospital" : "Activate hospital"}</button>}
          {hospital.status === "active" && <button className="portal-button" type="button" disabled={busy} onClick={() => setPendingAction("setup")}>Send login setup / reset</button>}
          {hospital.status === "active" && <button className="portal-button secondary" type="button" disabled={busy} onClick={() => setPendingAction("deactivate")}>Deactivate hospital</button>}
        </div>
        <p>Generate the contract first. Add and confirm both signed contract links after the hospital returns them. Activation becomes available only after both contracts and signing dates are recorded.</p>
      </article>

      <AdminHospitalPackages hospitalId={hospital.id} />

      <AdminHospitalCapacity hospitalId={hospital.id} />

      <CentreGuidelines hospital={hospital} />

      {hospital.status === "active" && <article className="portal-card portal-assessment-card">
        <div className="portal-row-heading"><h2>Public Ayursarga assessment</h2><span className="portal-status" data-status="active">Public</span></div>
        <p>Use this for Ayursarga&apos;s own assessment and editorial note. It is identified publicly as Ayursarga content, not as verified patient feedback.</p>
        <form className="portal-form portal-edit-form" onSubmit={savePublicAssessment} noValidate>
          <fieldset className="portal-rating-field full">
            <legend>Ayursarga rating</legend>
            <input type="hidden" name="ayursargaRating" value={assessmentRating ?? ""} />
            <div className="portal-star-picker" role="group" aria-label="Select Ayursarga rating out of five">
              {Array.from({ length: 5 }, (_, index) => index + 1).map((star) => {
                const halfValue = star === 1 ? 1 : star - 0.5;
                const fill = assessmentRating !== null && assessmentRating >= star
                  ? "full"
                  : assessmentRating === halfValue && halfValue !== star ? "half" : "empty";
                return <span className="portal-star-choice" key={star}>
                  <span className={`portal-star-visual ${fill}`} aria-hidden="true">★</span>
                  <button type="button" aria-label={`Select ${halfValue} out of 5`} aria-pressed={assessmentRating === halfValue} onClick={() => setAssessmentRating(halfValue)} />
                  <button type="button" aria-label={`Select ${star} out of 5`} aria-pressed={assessmentRating === star} onClick={() => setAssessmentRating(star)} />
                </span>;
              })}
              <span>{assessmentRating ? `${assessmentRating} / 5 selected` : "No rating selected"}</span>
              {assessmentRating !== null && <button className="portal-rating-clear" type="button" onClick={() => setAssessmentRating(null)}>Clear</button>}
            </div>
          </fieldset>
          <label className="full">Public Ayursarga note
            <textarea
              name="ayursargaReviewNote"
              maxLength={400}
              defaultValue={hospital.ayursargaReviewNote ?? ""}
              placeholder="Add a concise, factual note about this center."
            />
          </label>
          <div className="portal-actions full"><button className="portal-button" disabled={busy}>{busy ? "Saving..." : "Save public assessment"}</button></div>
        </form>
      </article>}
    </>}
    <PortalDialog open={Boolean(pendingAction)} title={actionDialog.title} message={actionDialog.message} tone={actionDialog.tone} confirmLabel={actionDialog.confirmLabel} busy={busy} onCancel={() => setPendingAction(null)} onConfirm={() => void confirmPendingAction()} />
  </PortalShell>;
}
