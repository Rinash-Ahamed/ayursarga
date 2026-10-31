"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { PortalToast } from "@/components/portal/PortalToast";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { getConsultationCancellationPolicy, saveConsultationCancellationPolicy } from "@/services/consultations/cancellationPolicyService";
import { parseConsultationCancellationPolicy, type ConsultationCancellationPolicy } from "@/features/consultations/cancellationPolicy";

export function ConsultationCancellationSettings() {
  const [policy, setPolicy] = useState<ConsultationCancellationPolicy | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<ConsultationCancellationPolicy | null>(null);
  const [error, setError, errorEvent] = useRepeatableMessage();
  const [message, setMessage, messageEvent] = useRepeatableMessage();
  const submitting = useRef(false);
  async function load() {
    setBusy(true); setError(null);
    try { setPolicy((await getConsultationCancellationPolicy(true)).policy); setEditing(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Policy could not be loaded."); }
    finally { setBusy(false); }
  }
  useEffect(() => { let active = true;
    getConsultationCancellationPolicy(true).then(result => { if (active) setPolicy(result.policy); }).catch(() => { if (active) setError("Policy could not be loaded. Please reload."); });
    return () => { active = false; };
  }, [setError]);
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!policy || submitting.current) return;
    const form = new FormData(event.currentTarget);
    const proposed = parseConsultationCancellationPolicy({ version: policy.version,
      refundWindowHours: Number(form.get("refundWindow")) * (form.get("refundUnit") === "days" ? 24 : 1),
      cancellationCutoffHours: Number(form.get("cutoff")) * (form.get("cutoffUnit") === "days" ? 24 : 1),
      allowAfterCutoff: form.get("allowAfterCutoff") === "on", refundType: form.get("refundType"),
      refundValue: Number(form.get("refundValue")), lateRefundValue: Number(form.get("lateRefundValue")), conditions: String(form.get("conditions") ?? "") });
    if (!proposed) { setError("Check hours/days and refund values. Percentages must be between 0 and 100."); return; }
    setError(null); setPending(proposed);
  }
  async function save() {
    if (!pending || !policy || submitting.current) return;
    submitting.current = true; setBusy(true); setError(null); setMessage(null);
    try { const result = await saveConsultationCancellationPolicy(pending, policy.version); setPolicy(result.policy); setPending(null); setEditing(false); setMessage("Consultation policy saved for future payment requests. Existing bookings and payment requests keep their agreed terms."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Policy update failed."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <section className="portal-card">
    <h2>Consultation cancellation policy</h2><p className="portal-form-note">WellnessPath consultations only. Changes apply to new payment requests, never existing bookings. Deadlines use the selected window start or a confirmed exact time in IST. Self-service cancellation stops when the appointment begins. Special exceptions require support review. Keep these settings consistent with your published legal terms; saving does not rewrite the legal pages.</p>
    <PortalToast message={error} notification={errorEvent} tone="error" /><PortalToast message={message} notification={messageEvent} />
    {error && <p className="portal-form-error" role="alert">{error}</p>}
    {!policy ? <button className="portal-button secondary" disabled={busy} onClick={() => void load()}>Reload policy</button> : <form key={`${policy.version}:${editing}`} className="portal-form" onSubmit={prepare}>
      <fieldset className="full portal-policy-fields" disabled={!editing || busy}>
        <label>Refund window *<input name="refundWindow" type="number" min="0" max="8760" step="1" defaultValue={policy.refundWindowHours} required /></label>
        <label>Refund window unit<select name="refundUnit" defaultValue="hours"><option value="hours">Hours before appointment</option><option value="days">Days before appointment</option></select></label>
        <label>Cancellation cutoff *<input name="cutoff" type="number" min="0" max="8760" step="1" defaultValue={policy.cancellationCutoffHours} required /></label>
        <label>Cutoff unit<select name="cutoffUnit" defaultValue="hours"><option value="hours">Hours before appointment</option><option value="days">Days before appointment</option></select></label>
        <label>Refund calculation<select name="refundType" defaultValue={policy.refundType}><option value="percentage">Percentage of verified amount paid</option><option value="fixed">Fixed amount in INR (capped to paid amount)</option></select></label>
        <label>Refund before deadline *<input name="refundValue" type="number" min="0" max="10000000" step="0.01" defaultValue={policy.refundValue} required /></label>
        <label>Refund after deadline *<input name="lateRefundValue" type="number" min="0" max="10000000" step="0.01" defaultValue={policy.lateRefundValue} required /></label>
        <label className="portal-checkbox-label"><input name="allowAfterCutoff" type="checkbox" defaultChecked={policy.allowAfterCutoff} />Allow cancellation after cutoff, before appointment starts</label>
        <label className="full">Special conditions (optional)<textarea name="conditions" defaultValue={policy.conditions} maxLength={1000} /></label>
      </fieldset>
      <div className="portal-actions full">{!editing ? <button type="button" className="portal-button secondary" disabled={busy} onClick={() => setEditing(true)}>Edit consultation policy</button> : <><button className="portal-button" disabled={busy}>Save consultation policy</button><button type="button" className="portal-button secondary" disabled={busy} onClick={() => { setEditing(false); setError(null); }}>Cancel</button></>}<button type="button" className="portal-button secondary" disabled={busy} onClick={() => void load()}>Reload policy</button></div>
    </form>}
    <PortalDialog open={Boolean(pending)} title="Update future consultation cancellation terms?" message="Existing bookings and payment requests will retain their original policy. New consumers will see these terms before paying." confirmLabel="Save policy" busy={busy} onConfirm={() => void save()} onCancel={() => { if (!busy) setPending(null); }} />
  </section>;
}
