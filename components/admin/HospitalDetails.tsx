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
import { buildHospitalContractHtml } from "@/features/hospitals/contractTemplate";
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
  const [editing, setEditing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<HospitalValidationErrors>({});
  const [pendingAction, setPendingAction] = useState<PendingHospitalAction | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setHospital(null);
    setContractUrl("");
    const record = await getHospital(hospitalId);
    if (record?.status === "archived") {
      setHospital(null);
      setLoading(false);
      router.replace("/admin/hospitals");
      return null;
    }
    setHospital(record);
    setContractUrl(record?.contractUrl ?? "");
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

  async function runAction(action: (record: DocumentRecord<HospitalDocument>) => Promise<void>, success: string) {
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
    if (pendingAction === "archive") await runAction((record) => archiveHospital(record.id, record), "The hospital has been removed from the normal list. Its details and history are still safely stored.");
    if (pendingAction === "sign") await runAction((record) => confirmHospitalContractSigning(record.id, record), "The signed contract has been confirmed. Add its URL to activate the hospital.");
    if (pendingAction === "activate") await runAction(async (record) => {
      await activateHospital(record.id, record, contractUrl);
      await sendHospitalLoginSetup(record.id);
    }, `The hospital is active. A secure password setup link was sent to ${hospital.email}.`);
    if (pendingAction === "setup") await runAction(async (record) => {
      await sendHospitalLoginSetup(record.id);
    }, `A secure password setup/reset link was sent to ${hospital.email}.`);
    if (pendingAction === "deactivate") await runAction((record) => deactivateHospital(record.id, record), "The hospital is now inactive and hidden from consumers.");
    setPendingAction(null);
  }

  function generateContract() {
    if (!hospital || busy) return;
    const contractWindow = window.open("", "_blank");
    if (!contractWindow) {
      setError("Allow pop-ups for Ayursarga, then select Generate Contract PDF again.");
      return;
    }
    contractWindow.opener = null;
    contractWindow.document.write("<p style='font-family:sans-serif;padding:24px'>Preparing contract...</p>");
    void runAction(async (record) => {
      await recordHospitalContractGeneration(record.id, record);
      if (!contractWindow.closed) {
        contractWindow.document.open();
        contractWindow.document.write(buildHospitalContractHtml(record));
        contractWindow.document.close();
      }
    }, "The contract is ready. In the new window, select Print / Save as PDF to download it.");
  }

  async function saveHospitalDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hospital || busy) return;
    const validation = validateHospitalFields({
      ...hospitalFormValues(new FormData(event.currentTarget)),
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
        address: validation.data.address,
        city: validation.data.city,
        state: validation.data.state,
        description: validation.data.description,
      }, hospital);
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

  const contractStatus = hospital?.contractStatus ?? "not_generated";
  const generatedAt = hospital && contractStatus !== "not_generated" && isOnOrAfter(hospital.contractGeneratedAt, hospital.createdAt)
    ? hospital.contractGeneratedAt
    : null;
  const signedAt = hospital && contractStatus === "signed" && isOnOrAfter(hospital.contractSignedAt, hospital.createdAt)
    ? hospital.contractSignedAt
    : null;
  const activatedAt = hospital && hospital.status === "active" && signedAt && isOnOrAfter(hospital.activatedAt, signedAt)
    ? hospital.activatedAt
    : null;
  const actionDialog = pendingAction === "archive"
    ? { title: "Remove this hospital?", message: "It will be hidden from normal application views. Its protected history will remain stored.", confirmLabel: "Remove hospital", tone: "danger" as const }
    : pendingAction === "sign"
      ? { title: "Confirm signed contract?", message: "Confirm that the signed contract has been received from this hospital.", confirmLabel: "Confirm contract", tone: "default" as const }
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
            <span>{hospital.email}</span><span>{hospital.phone}</span><span>{hospital.city}, {hospital.state}</span><span>Commission {hospital.commissionPercentage}%</span>
          </div>
          <p>{hospital.address}</p>
          {hospital.status !== "archived" && <div className="portal-actions">
            <button className="portal-button secondary" type="button" disabled={busy} onClick={() => { setEditing(true); setError(null); setMessage(null); }}>Edit hospital</button>
            <button className="portal-button danger" type="button" disabled={busy} onClick={() => setPendingAction("archive")}>Delete hospital</button>
          </div>}
        </>}
      </article>

      <article className="portal-card portal-contract-card">
        <div className="portal-row-heading"><h2>Contract and approval</h2><span className="portal-status" data-status={contractStatus}>{formatStatus(contractStatus)}</span></div>
        <div className="portal-date-grid">
          <div><span>Created date</span><strong>{formatDate(hospital.createdAt)}</strong></div>
          <div><span>Contract generated</span><strong>{formatDate(generatedAt)}</strong></div>
          <div><span>Signed date</span><strong>{formatDate(signedAt)}</strong></div>
          <div><span>Active date</span><strong>{formatDate(activatedAt)}</strong></div>
        </div>
        {hospital.contractUrl && <p>Signed contract: <a className="portal-inline-link" href={hospital.contractUrl} target="_blank" rel="noreferrer">View contract</a></p>}
        {hospital.status === "pending" && contractStatus === "signed" && <label className="portal-contract-url">Signed contract URL *<input type="url" value={contractUrl} onChange={(event) => setContractUrl(event.target.value)} placeholder="https://" required /></label>}
        <div className="portal-actions">
          {hospital.status === "pending" && <button className="portal-button secondary" type="button" disabled={busy} onClick={generateContract}>{contractStatus === "not_generated" ? "Generate Contract PDF" : "View / Regenerate Contract PDF"}</button>}
          {hospital.status === "pending" && contractStatus === "generated" && <button className="portal-button secondary" type="button" disabled={busy} onClick={() => setPendingAction("sign")}>Confirm signed contract</button>}
          {(hospital.status === "pending" || hospital.status === "inactive") && contractStatus === "signed" && <button className="portal-button" type="button" disabled={busy} onClick={() => {
            if (!contractUrl.trim()) {
              setError("Paste the signed contract URL below before activating the hospital.");
              return;
            }
            setPendingAction("activate");
          }}>{hospital.status === "inactive" ? "Reactivate hospital" : "Activate hospital"}</button>}
          {hospital.status === "active" && <button className="portal-button" type="button" disabled={busy} onClick={() => setPendingAction("setup")}>Send login setup / reset</button>}
          {hospital.status === "active" && <button className="portal-button secondary" type="button" disabled={busy} onClick={() => setPendingAction("deactivate")}>Deactivate hospital</button>}
        </div>
        <p>Start by generating the contract. After the hospital returns the signed copy, confirm it here and paste the signed contract URL. You can then activate the hospital for consumers.</p>
      </article>
      <AdminHospitalPackages hospitalId={hospital.id} />
    </>}
    <PortalDialog open={Boolean(pendingAction)} title={actionDialog.title} message={actionDialog.message} tone={actionDialog.tone} confirmLabel={actionDialog.confirmLabel} busy={busy} onCancel={() => setPendingAction(null)} onConfirm={() => void confirmPendingAction()} />
  </PortalShell>;
}
