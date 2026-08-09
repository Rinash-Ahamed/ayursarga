"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { HospitalDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import {
  activateHospital,
  confirmHospitalContractSigning,
  deactivateHospital,
  getHospital,
  recordHospitalContractGeneration,
} from "@/services/hospitals/hospitalService";
import { buildHospitalContractHtml } from "@/features/hospitals/contractTemplate";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { formatStatus } from "@/utils/text";
import { toDate } from "@/utils/date";

function formatDate(value: unknown) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Not yet";
}

export function AdminHospitalDetails({ hospitalId }: { hospitalId: string }) {
  const [hospital, setHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [contractUrl, setContractUrl] = useState("");

  const reload = useCallback(async () => {
    const record = await getHospital(hospitalId);
    setHospital(record);
    setContractUrl(record?.contractUrl ?? "");
    setLoading(false);
    if (!record) setError("Hospital could not be found.");
    return record;
  }, [hospitalId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void reload().catch(() => {
        setError("Hospital details could not be loaded.");
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
      setError(caught instanceof Error ? caught.message : "The hospital could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  function generateContract() {
    if (!hospital || busy) return;
    const contractWindow = window.open("", "_blank");
    if (!contractWindow) {
      setError("Allow pop-ups for Ayursarga to view and save the contract PDF.");
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
    }, "Contract generated and recorded in the audit log.");
  }

  const contractStatus = hospital?.contractStatus ?? "not_generated";
  return <PortalShell role="admin" title="Hospital Details">
    <div className="portal-actions portal-page-actions"><Link className="portal-button secondary" href="/admin/hospitals">Back to hospitals</Link></div>
    <PortalFeedback error={error} empty={!error && !loading && !hospital ? "Hospital could not be found." : undefined} />
    {message && <p className="portal-form-success">{message}</p>}
    {hospital && <>
      <article className="portal-card">
        <div className="portal-row-heading"><h2>{hospital.name}</h2><span className="portal-status">{formatStatus(hospital.status)}</span></div>
        <p>{hospital.description}</p>
        <div className="portal-card-meta">
          <span>{hospital.email}</span><span>{hospital.phone}</span><span>{hospital.city}, {hospital.state}</span><span>Commission {hospital.commissionPercentage}%</span><span>{hospital.isPublic ? "Public" : "Private"}</span>
        </div>
        <p>{hospital.address}</p>
      </article>

      <article className="portal-card portal-contract-card">
        <div className="portal-row-heading"><h2>Contract and approval</h2><span className="portal-status">{formatStatus(contractStatus)}</span></div>
        <div className="portal-date-grid">
          <div><span>Created date</span><strong>{formatDate(hospital.createdAt)}</strong></div>
          <div><span>Contract generated</span><strong>{formatDate(hospital.contractGeneratedAt)}</strong></div>
          <div><span>Signed date</span><strong>{formatDate(hospital.contractSignedAt)}</strong></div>
          <div><span>Active date</span><strong>{formatDate(hospital.activatedAt)}</strong></div>
        </div>
        {hospital.contractUrl && <p>Signed contract: <a className="portal-inline-link" href={hospital.contractUrl} target="_blank" rel="noreferrer">View contract</a></p>}
        {hospital.status === "pending" && contractStatus === "signed" && <label className="portal-contract-url">Signed contract URL *<input type="url" value={contractUrl} onChange={(event) => setContractUrl(event.target.value)} placeholder="https://" required /></label>}
        <div className="portal-actions">
          {hospital.status === "pending" && <button className="portal-button secondary" type="button" disabled={busy} onClick={generateContract}>{contractStatus === "not_generated" ? "Generate Contract PDF" : "View / Regenerate Contract PDF"}</button>}
          {hospital.status === "pending" && contractStatus === "generated" && <button className="portal-button secondary" type="button" disabled={busy} onClick={() => {
            if (window.confirm("Confirm that the hospital has signed the contract?")) void runAction((record) => confirmHospitalContractSigning(record.id, record), "Contract signature confirmed.");
          }}>Confirm signed contract</button>}
          {hospital.status === "pending" && contractStatus === "signed" && <button className="portal-button" type="button" disabled={busy} onClick={() => {
            if (!contractUrl.trim()) {
              setError("Add the signed contract URL before activating the hospital.");
              return;
            }
            if (window.confirm("Activate this hospital and make it publicly discoverable?")) void runAction((record) => activateHospital(record.id, record, contractUrl), "Hospital activated.");
          }}>Activate hospital</button>}
          {hospital.status === "active" && <button className="portal-button secondary" type="button" disabled={busy} onClick={() => {
            if (window.confirm("Deactivate this hospital and remove it from public discovery?")) void runAction((record) => deactivateHospital(record.id, record), "Hospital deactivated.");
          }}>Deactivate hospital</button>}
        </div>
        <p>Activation is available only after the generated contract is confirmed as signed. Every step is written to the immutable audit log.</p>
      </article>
    </>}
  </PortalShell>;
}
