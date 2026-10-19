"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
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
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { formatStatus } from "@/utils/text";
import { toDate } from "@/utils/date";
import { hospitalFormValues, validateHospitalFields, type HospitalValidationErrors } from "@/features/hospitals/validation";
import { HospitalFormFields } from "@/components/forms/HospitalFormFields";
import { sendHospitalLoginSetup } from "@/services/auth/hospitalAccountService";
import { AdminHospitalPackages } from "@/components/admin/HospitalPackages";
import { HospitalLocationField } from "@/components/forms/HospitalLocationField";
import { HospitalImageGallery } from "@/components/hospital/HospitalImageGallery";
import { HospitalImageManager } from "@/components/hospital/HospitalImageManager";
import { getHospitalImageUrls } from "@/features/hospitals/images";
import { validateHospitalLocationUrl } from "@/features/hospitals/location";
import { CentreGuidelines } from "@/components/hospital/CentreGuidelines";
import { AdminHospitalCapacity } from "@/components/admin/HospitalCapacity";
import { ContractPreviewDialog } from "@/components/admin/ContractPreviewDialog";
import { validateHospitalContractDetails, type HospitalContractDetailErrors, type HospitalContractDetailField } from "@/features/hospitals/contractDetails";
import { focusFirstInvalidField } from "@/utils/formFocus";

function formatDate(value: unknown) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Not yet";
}

function isOnOrAfter(value: unknown, minimum: unknown) {
  const date = toDate(value);
  const minimumDate = toDate(minimum);
  return Boolean(date && minimumDate && date.getTime() >= minimumDate.getTime());
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function indiaDateInputValue() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addYearsToDateInput(value: string, years: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const targetYear = Number(match[1]) + years;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${targetYear}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDayOfTargetMonth)).padStart(2, "0")}`;
}

function updateContractExpiry(event: ChangeEvent<HTMLInputElement>) {
  const expiryInput = event.currentTarget.form?.elements.namedItem("contractExpiryDate");
  if (!(expiryInput instanceof HTMLInputElement)) return;
  expiryInput.value = addYearsToDateInput(event.currentTarget.value, 3);
  expiryInput.min = event.currentTarget.value;
}

function ContractFieldError({ field, errors }: { field: HospitalContractDetailField; errors: HospitalContractDetailErrors }) {
  return errors[field] ? <span className="portal-field-error" role="alert">{errors[field]}</span> : null;
}

function ContractStepMarker({ step, done, active = false }: { step: number; done: boolean; active?: boolean }) {
  return <span className="portal-contract-step-dot" data-done={done ? "true" : undefined} data-active={!done && active ? "true" : undefined} role="img" aria-label={`Step ${step}${done ? " completed" : ""}`}>
    {done ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg> : step}
  </span>;
}

type PendingHospitalAction = "archive" | "activate" | "setup" | "deactivate";
type ContractPreview = ReturnType<typeof buildHospitalContractPdf>;

export function AdminHospitalDetails({ hospitalId }: { hospitalId: string }) {
  const router = useRouter();
  const [hospital, setHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError, errorNotification] = useRepeatableMessage();
  const [message, setMessage, messageNotification] = useRepeatableMessage();
  const [contractUrl, setContractUrl] = useState("");
  const [contractUrlError, setContractUrlError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingMedia, setEditingMedia] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<HospitalValidationErrors>({});
  const [locationError, setLocationError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingHospitalAction | null>(null);
  const [assessmentRating, setAssessmentRating] = useState<number | null>(null);
  const [contractPreview, setContractPreview] = useState<ContractPreview | null>(null);
  const [contractFieldErrors, setContractFieldErrors] = useState<HospitalContractDetailErrors>({});
  const [editingContractParticulars, setEditingContractParticulars] = useState(true);

  const reload = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
      setHospital(null);
      setContractUrl("");
    }
    const record = await getHospital(hospitalId);
    if (record?.status === "archived") {
      setHospital(null);
      setLoading(false);
      router.replace("/admin/hospitals");
      return null;
    }
    setHospital(record);
    setContractUrl(record?.contractUrl ?? "");
    setAssessmentRating(record?.ayursargaRating ?? null);
    setEditingContractParticulars(record ? !validateHospitalContractDetails({ ...record }).isValid : true);
    setLoading(false);
    if (!record) setError("We could not find this hospital. Return to the hospital list and choose another record.");
    return record;
  }, [hospitalId, router, setError]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void reload().catch(() => {
        setError("We could not load these hospital details. Refresh the page and try again.");
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [reload, setError]);

  async function runAction(action: (record: DocumentRecord<HospitalDocument>) => Promise<Partial<HospitalDocument> | void>, success: string, refresh = true) {
    if (!hospital || busy) return false;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const changes = await action(hospital);
      if (changes) {
        if (changes.status === "archived") router.replace("/admin/hospitals");
        else setHospital((current) => current ? { ...current, ...changes } : current);
      } else if (refresh) await reload(true);
      setMessage(success);
      return true;
    } catch (caught) {
      if (refresh) await reload(true).catch(() => setLoading(false));
      setError(caught instanceof Error ? caught.message : "We could not complete that step. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirmPendingAction() {
    if (!hospital || !pendingAction) return;
    if (pendingAction === "archive") await runAction((record) => archiveHospital(record.id), "The hospital has been removed from the normal list. Its details and history are still safely stored.");
    if (pendingAction === "activate" && hospital.status === "pending" && !contractReady) {
      if (!contractUrl.trim()) {
        setContractUrlError("Add the signed contract URL before activating the hospital.");
        return;
      }
      if (!isHttpsUrl(contractUrl.trim())) {
        setContractUrlError("Enter a secure contract URL beginning with https://.");
        return;
      }
    }
    if (pendingAction === "activate") await runAction(async (record) => {
      if (record.status === "pending" && (record.contractStatus !== "signed" || !record.contractUrl)) {
        await confirmHospitalContractSigning(record.id, record, contractUrl);
      }
      await activateHospital(record.id, record.contractStatus === "signed" ? record : undefined);
      await sendHospitalLoginSetup(record.id);
    }, `The hospital is active. A secure password setup link was sent to ${hospital.email}.`);
    if (pendingAction === "setup") await runAction(async (record) => {
      await sendHospitalLoginSetup(record.id);
    }, `A secure password setup/reset link was sent to ${hospital.email}.`, false);
    if (pendingAction === "deactivate") await runAction((record) => deactivateHospital(record.id), "The hospital is now inactive and hidden from consumers.");
    setPendingAction(null);
  }

  function previewContract() {
    if (!hospital || busy) return;
    setError(null);
    setMessage(null);
    const validation = validateHospitalContractDetails({ ...hospital });
    setContractFieldErrors(validation.errors);
    if (!validation.isValid) {
      setError("Complete and save the contract particulars before previewing the agreement.");
      return;
    }
    try {
      setContractPreview(buildHospitalContractPdf(hospital));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not prepare the contract preview. Please try again.");
    }
  }

  async function saveContractDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hospital || busy) return;
    const form = event.currentTarget;
    const validation = validateHospitalContractDetails(Object.fromEntries(new FormData(form).entries()));
    setContractFieldErrors(validation.errors);
    setError(null);
    setMessage(null);
    if (!validation.isValid) {
      setError("Check the highlighted contract particulars before saving.");
      focusFirstInvalidField(form);
      return;
    }
    setBusy(true);
    try {
      const changes = await updateHospital(hospital.id, validation.data);
      setHospital((current) => current ? { ...current, ...changes } : current);
      setEditingContractParticulars(false);
      setContractFieldErrors({});
      setMessage("The contract particulars have been saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save the contract particulars. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadContract() {
    if (!hospital || !contractPreview || busy) return;
    const preview = contractPreview;
    const downloaded = await runAction(async (record) => {
      const changes = await recordHospitalContractGeneration(record.id);
      const url = URL.createObjectURL(preview.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = preview.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      return changes;
    }, "The contract PDF has been downloaded.");
    if (downloaded) setContractPreview(null);
  }

  async function saveHospitalDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hospital || busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
      focusFirstInvalidField(formElement);
      return;
    }

    setBusy(true);
    try {
      const changes = await updateHospital(hospital.id, {
        legalName: validation.data.legalName,
        name: validation.data.name,
        email: validation.data.email,
        phone: validation.data.phone,
        hospitalPhone1: validation.data.hospitalPhone1,
        hospitalPhone2: validation.data.hospitalPhone2,
        registeredAddress: validation.data.registeredAddress,
        address: validation.data.address,
        city: validation.data.city,
        district: validation.data.district,
        state: validation.data.state,
        description: validation.data.description,
      });
      setHospital((current) => current ? { ...current, ...changes } : current);
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const location = validateHospitalLocationUrl(form.get("hospitalLocationUrl"));
    setLocationError(location.error);
    setError(null);
    setMessage(null);
    if (location.error) {
      setError(location.error);
      focusFirstInvalidField(formElement);
      return;
    }

    setBusy(true);
    try {
      const changes = await updateHospital(hospital.id, { locationUrl: location.locationUrl });
      setHospital((current) => current ? { ...current, ...changes } : current);
      setEditingMedia(false);
      setLocationError(null);
      setMessage("The hospital map has been updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save the hospital map. Please try again.");
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
      const changes = await updateHospital(hospital.id, {
        ayursargaRating: rating === null ? null : Math.round(rating * 10) / 10,
        ayursargaReviewNote: reviewNote || null,
      });
      setHospital((current) => current ? { ...current, ...changes } : current);
      setMessage("The public Ayursarga assessment has been updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save the public assessment. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const contractStatus = hospital?.contractStatus ?? "not_generated";
  const defaultContractEffectiveDate = hospital?.contractEffectiveDate ?? indiaDateInputValue();
  const defaultContractExpiryDate = hospital?.contractExpiryDate ?? addYearsToDateInput(defaultContractEffectiveDate, 3);
  const contractParticularsComplete = Boolean(
    hospital && validateHospitalContractDetails({ ...hospital }).isValid,
  );
  const generatedAt = hospital && contractStatus !== "not_generated" && isOnOrAfter(hospital.contractGeneratedAt, hospital.createdAt)
    ? hospital.contractGeneratedAt
    : null;
  const signedAt = hospital && contractStatus === "signed" && isOnOrAfter(hospital.contractSignedAt, hospital.createdAt)
    ? hospital.contractSignedAt
    : null;
  const contractReady = Boolean(signedAt && hospital?.contractUrl);
  const activatedAt = hospital && hospital.status === "active" && signedAt && isOnOrAfter(hospital.activatedAt, signedAt)
    ? hospital.activatedAt
    : null;
  const actionDialog = pendingAction === "archive"
    ? { title: "Remove this hospital?", message: "It will be hidden from normal application views. Its protected history will remain stored.", confirmLabel: "Remove hospital", tone: "danger" as const }
    : pendingAction === "activate"
      ? { title: hospital?.status === "inactive" ? "Reactivate this hospital?" : "Activate this hospital?", message: hospital?.status === "pending" && !contractReady ? "Add the secure link to the signed contract. Continuing will confirm the signing, activate the hospital, and send its login setup email." : "The hospital will become visible to consumers and receive a secure login setup email.", confirmLabel: hospital?.status === "inactive" ? "Reactivate hospital" : "Activate hospital", tone: "default" as const }
        : pendingAction === "setup"
          ? { title: "Send login setup link?", message: `A secure password setup/reset link will be sent to ${hospital?.email ?? "this hospital"}.`, confirmLabel: "Send setup link", tone: "default" as const }
          : { title: "Deactivate this hospital?", message: "The hospital will be hidden from consumers while its operational history remains stored.", confirmLabel: "Deactivate hospital", tone: "default" as const };
  return <PortalShell role="admin" title="Hospital Details">
    <PortalLoadGuard notification={errorNotification} loading={loading} error={error} hasData={Boolean(hospital)} fallbackHref="/admin/hospitals" loadingMessage="Loading hospital details…" />
    <div className="portal-actions portal-page-actions"><Link className="portal-button secondary" href="/admin/hospitals">Back to hospitals</Link></div>
    <PortalFeedback error={error} notification={errorNotification} empty={!error && !loading && !hospital ? "Return to Hospitals and choose a hospital to continue." : undefined} />
    <PortalToast message={message} notification={messageNotification} />
    {hospital && <>
      <article className="portal-card">
        <div className="portal-hospital-summary">
          <div>
            <div className="portal-row-heading"><h2>{hospital.name}</h2><span className="portal-status" data-status={hospital.status}>{formatStatus(hospital.status)}</span></div>
            <div className="portal-hospital-summary-meta">
              <span className="portal-hospital-summary-tag">{hospital.city}{hospital.district ? `, ${hospital.district}` : ""}, {hospital.state}</span>
              <span className="portal-hospital-summary-tag">Commission {hospital.commissionPercentage}%</span>
              <span className="portal-hospital-summary-tag">{formatStatus(contractStatus)}</span>
            </div>
          </div>
        </div>
        {editing ? <form className="portal-form portal-edit-form" onSubmit={saveHospitalDetails} noValidate>
          <HospitalFormFields defaultValues={hospital} errors={fieldErrors} includeLegalName />
          <div className="portal-actions full"><button className="portal-button" disabled={busy}>{busy ? "Saving..." : "Save details"}</button><button className="portal-button secondary" type="button" disabled={busy} onClick={() => { setEditing(false); setFieldErrors({}); setError(null); }}>Cancel</button></div>
        </form> : <>
          <p>{hospital.description || "No description provided."}</p>
          <div className="portal-card-meta">
            <span>{hospital.email}</span><span>Owner WhatsApp: {hospital.phone}</span><span>Hospital Phone 1: {hospital.hospitalPhone1 || "Not added"}</span>{hospital.hospitalPhone2 && <span>Hospital Phone 2: {hospital.hospitalPhone2}</span>}
          </div>
          <p><strong>Legal name:</strong> {hospital.legalName || hospital.name}</p>
          <p><strong>Registered address:</strong> {hospital.registeredAddress || hospital.address}</p>
          <p><strong>Service address:</strong> {hospital.address}</p>
          {hospital.status !== "archived" && <div className="portal-actions">
            <button className="portal-button secondary" type="button" disabled={busy} onClick={() => { setEditing(true); setError(null); setMessage(null); }}>Edit hospital</button>
            <button className="portal-button danger" type="button" disabled={busy} onClick={() => setPendingAction("archive")}>Delete hospital</button>
          </div>}
        </>}
      </article>

      <article className="portal-card portal-hospital-media-card">
        <div className="portal-row-heading"><h2>Hospital images and map</h2><span className="portal-status" data-status={hospital.locationUrl || getHospitalImageUrls(hospital).length ? "active" : "pending"}>{hospital.locationUrl || getHospitalImageUrls(hospital).length ? "Added" : "Not added"}</span></div>
        {editingMedia ? <form className="portal-form portal-edit-form" onSubmit={saveHospitalMedia} noValidate>
          <HospitalLocationField defaultValue={hospital.locationUrl} error={locationError} />
          <div className="portal-actions full"><button className="portal-button" disabled={busy}>{busy ? "Saving..." : "Save map"}</button><button className="portal-button secondary" type="button" disabled={busy} onClick={() => { setEditingMedia(false); setLocationError(null); setError(null); }}>Cancel</button></div>
        </form> : <>
          {hospital.status === "archived"
            ? <HospitalImageGallery imageUrls={getHospitalImageUrls(hospital)} hospitalName={hospital.name} />
            : <HospitalImageManager hospitalId={hospital.id} hospitalName={hospital.name} imageUrls={getHospitalImageUrls(hospital)} disabled={busy} onChange={(imageUrls) => setHospital((current) => current ? { ...current, imageUrls, imageUrl: null } : current)} />}
          <div className="portal-card-meta"><span>{hospital.locationUrl ? "Map location added" : "Map location not added"}</span></div>
          {hospital.locationUrl && <p><a className="portal-inline-link" href={hospital.locationUrl} target="_blank" rel="noreferrer">View centre map</a></p>}
          {hospital.status !== "archived" && <div className="portal-actions"><button className="portal-button secondary" type="button" disabled={busy} onClick={() => { setEditingMedia(true); setError(null); setMessage(null); }}>Edit map</button></div>}
        </>}
      </article>

      <article className="portal-card portal-contract-card">
        <div className="portal-row-heading"><h2>Contract and approval</h2><span className="portal-status" data-status={contractStatus}>{formatStatus(contractStatus)}</span></div>
        <div className="portal-contract-stepper">
          <div className="portal-contract-step" data-line-done={contractStatus !== "not_generated" ? "true" : undefined}>
            <ContractStepMarker step={1} done />
            <span data-done="true">Created</span>
          </div>
          <div className="portal-contract-step" data-line-done={signedAt ? "true" : undefined}>
            <ContractStepMarker step={2} done={Boolean(generatedAt)} active={!generatedAt} />
            <span data-done={generatedAt ? "true" : undefined} data-active={!generatedAt ? "true" : undefined}>Contract generated</span>
          </div>
          <div className="portal-contract-step" data-line-done={activatedAt ? "true" : undefined}>
            <ContractStepMarker step={3} done={Boolean(signedAt)} active={Boolean(generatedAt && !signedAt)} />
            <span data-done={signedAt ? "true" : undefined} data-active={generatedAt && !signedAt ? "true" : undefined}>Contract signed</span>
          </div>
          <div className="portal-contract-step">
            <ContractStepMarker step={4} done={Boolean(activatedAt)} active={Boolean(contractReady && !activatedAt)} />
            <span data-done={activatedAt ? "true" : undefined} data-active={contractReady && !activatedAt ? "true" : undefined}>Activated</span>
          </div>
        </div>
        <div className="portal-date-grid">
          <div><span>Created date</span><strong>{formatDate(hospital.createdAt)}</strong></div>
          <div><span>Contract generated</span><strong>{formatDate(generatedAt)}</strong></div>
          <div><span>Contract signed date</span><strong>{formatDate(signedAt)}</strong></div>
          <div><span>Active date</span><strong>{formatDate(activatedAt)}</strong></div>
        </div>
        {hospital.status === "pending" && <form className="portal-form portal-contract-particulars" onSubmit={saveContractDetails} noValidate>
          <div className="full portal-row-heading">
            <div><h3>Contract particulars</h3><p>{editingContractParticulars ? "Complete these legal and operational details before previewing the agreement." : "Saved particulars are locked. Select Edit particulars to make changes."}</p></div>
            {!editingContractParticulars && <button className="portal-button secondary" type="button" disabled={busy} onClick={() => { setEditingContractParticulars(true); setContractFieldErrors({}); setError(null); setMessage(null); }}>Edit particulars</button>}
          </div>
          <label>Registration number *<input name="registrationNumber" defaultValue={hospital.registrationNumber ?? ""} maxLength={100} required disabled={!editingContractParticulars} aria-invalid={Boolean(contractFieldErrors.registrationNumber)} /><ContractFieldError field="registrationNumber" errors={contractFieldErrors} /></label>
          <label>CIN / Not applicable *<input name="cinNumber" defaultValue={hospital.cinNumber ?? ""} maxLength={21} required disabled={!editingContractParticulars} autoCapitalize="characters" placeholder="CIN or NOT APPLICABLE" aria-invalid={Boolean(contractFieldErrors.cinNumber)} /><ContractFieldError field="cinNumber" errors={contractFieldErrors} /></label>
          <label>PAN *<input name="panNumber" defaultValue={hospital.panNumber ?? ""} minLength={10} maxLength={10} required disabled={!editingContractParticulars} autoCapitalize="characters" aria-invalid={Boolean(contractFieldErrors.panNumber)} /><ContractFieldError field="panNumber" errors={contractFieldErrors} /></label>
          <label>GSTIN / Not applicable *<input name="gstin" defaultValue={hospital.gstin ?? ""} maxLength={20} required disabled={!editingContractParticulars} autoCapitalize="characters" placeholder="GSTIN or NOT APPLICABLE" aria-invalid={Boolean(contractFieldErrors.gstin)} /><ContractFieldError field="gstin" errors={contractFieldErrors} /></label>
          <label>Effective date *<input name="contractEffectiveDate" type="date" defaultValue={defaultContractEffectiveDate} onChange={updateContractExpiry} required disabled={!editingContractParticulars} aria-invalid={Boolean(contractFieldErrors.contractEffectiveDate)} /><ContractFieldError field="contractEffectiveDate" errors={contractFieldErrors} /></label>
          <label>Expiry date *<input name="contractExpiryDate" type="date" defaultValue={defaultContractExpiryDate} min={defaultContractEffectiveDate} required disabled={!editingContractParticulars} aria-invalid={Boolean(contractFieldErrors.contractExpiryDate)} /><ContractFieldError field="contractExpiryDate" errors={contractFieldErrors} /></label>
          <label>Partner emergency contact *<input name="emergencyContact" defaultValue={hospital.emergencyContact ?? ""} maxLength={160} required disabled={!editingContractParticulars} aria-invalid={Boolean(contractFieldErrors.emergencyContact)} /><ContractFieldError field="emergencyContact" errors={contractFieldErrors} /></label>
          <label>Emergency transfer (nearby hospital transfer in case of an emergency) *<input name="emergencyReferralHospital" defaultValue={hospital.emergencyReferralHospital ?? ""} maxLength={200} required disabled={!editingContractParticulars} aria-invalid={Boolean(contractFieldErrors.emergencyReferralHospital)} /><ContractFieldError field="emergencyReferralHospital" errors={contractFieldErrors} /></label>
          {editingContractParticulars && <div className="portal-actions full"><button className="portal-button secondary" disabled={busy}>{busy ? "Saving..." : "Save contract particulars"}</button></div>}
        </form>}
        {hospital.contractUrl && <p>Signed contract: <a className="portal-inline-link" href={hospital.contractUrl} target="_blank" rel="noreferrer">View contract</a></p>}
        <div className="portal-actions">
          {hospital.status === "pending" && <button className="portal-button secondary" type="button" disabled={busy || !contractParticularsComplete} title={!contractParticularsComplete ? "Complete and save all contract particulars to enable the preview." : undefined} onClick={previewContract}>{contractStatus === "not_generated" ? "Preview Contract" : "Preview Contract Again"}</button>}
          {hospital.status === "pending" && contractStatus !== "not_generated" && <button className="portal-button" type="button" disabled={busy} onClick={() => { setContractUrlError(null); setPendingAction("activate"); }}>Activate hospital</button>}
          {hospital.status === "inactive" && contractStatus === "signed" && contractReady && <button className="portal-button" type="button" disabled={busy} onClick={() => setPendingAction("activate")}>Reactivate hospital</button>}
          {hospital.status === "active" && <button className="portal-button" type="button" disabled={busy} onClick={() => setPendingAction("setup")}>Send login setup / reset</button>}
          {hospital.status === "active" && <button className="portal-button secondary" type="button" disabled={busy} onClick={() => setPendingAction("deactivate")}>Deactivate hospital</button>}
        </div>
        {hospital.status === "pending" && !contractParticularsComplete && <p className="portal-form-note">Complete and save all required contract particulars to enable Preview Contract.</p>}
        <p>Preview and download the contract first. After the hospital returns the signed copy, select Activate hospital and add its secure link to complete signing and activation.</p>
      </article>

      <AdminHospitalPackages hospitalId={hospital.id} />

      <AdminHospitalCapacity hospitalId={hospital.id} />

      <CentreGuidelines hospital={hospital} />

      <ContractPreviewDialog
        open={Boolean(contractPreview)}
        html={contractPreview?.html ?? ""}
        filename={contractPreview?.filename ?? ""}
        busy={busy}
        onDownload={() => { void downloadContract(); }}
        onClose={() => setContractPreview(null)}
      />

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
    <PortalDialog open={Boolean(pendingAction)} title={actionDialog.title} message={actionDialog.message} tone={actionDialog.tone} confirmLabel={actionDialog.confirmLabel} busy={busy} onCancel={() => { setContractUrlError(null); setPendingAction(null); }} onConfirm={() => void confirmPendingAction()}>
      {pendingAction === "activate" && hospital?.status === "pending" && !contractReady && <label className="portal-dialog-contract-url">Signed contract URL *<input type="url" value={contractUrl} onChange={(event) => { setContractUrl(event.target.value); setContractUrlError(null); }} placeholder="https://" required aria-invalid={Boolean(contractUrlError)} />{contractUrlError && <span className="portal-field-error" role="alert">{contractUrlError}</span>}</label>}
    </PortalDialog>
  </PortalShell>;
}
