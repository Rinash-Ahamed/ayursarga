"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalDialog } from "@/components/portal/PortalDialog";
import { PortalToast } from "@/components/portal/PortalToast";
import { AdminFinanceNavigation } from "@/components/admin/AdminFinanceNavigation";
import { DateInput } from "@/components/forms/DateInput";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { listConsultantFinance, recordConsultantSettlement, type ConsultantFinancePage } from "@/services/billing/consultantFinanceService";
import type { ConsultantFinancialRecord } from "@/features/payments/consultationFinance";
import { formatCurrency } from "@/utils/currency";
import { formatDisplayDate, formatDisplayDateTime, toDateInputValue } from "@/utils/date";
import { formatStatus } from "@/utils/text";

const money = (value: number | null) => value === null ? "Awaiting verification" : formatCurrency(value / 100);
export function AdminConsultantFinance() {
  const [mode, setMode] = useState("live");
  const [page, setPage] = useState<ConsultantFinancePage | null>(null);
  const [items, setItems] = useState<ConsultantFinancialRecord[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError, errorEvent] = useRepeatableMessage();
  const [message, setMessage, messageEvent] = useRepeatableMessage();
  const [pending, setPending] = useState<Parameters<typeof recordConsultantSettlement>[0] | null>(null);
  const submitting = useRef(false);
  const revision = useRef(0);
  const load = useCallback(async (cursor: string | null = null) => {
    const id = ++revision.current;
    setBusy(true); setError(null);
    try {
      const result = await listConsultantFinance(mode, cursor);
      if (id !== revision.current) return;
      setPage(result); setItems(current => cursor ? [...current, ...result.documents.filter(item => !current.some(old => old.id === item.id))] : result.documents);
    } catch (caught) { if (id === revision.current) setError(caught instanceof Error ? caught.message : "Finance could not be loaded."); }
    finally { if (id === revision.current) setBusy(false); }
  }, [mode, setError]);
  useEffect(() => {
    let active = true;
    const id = ++revision.current;
    listConsultantFinance(mode).then(result => {
      if (active && id === revision.current) { setPage(result); setItems(result.documents); }
    }).catch(caught => {
      if (active && id === revision.current) setError(caught instanceof Error ? caught.message : "Finance could not be loaded.");
    }).finally(() => { if (active && id === revision.current) setBusy(false); });
    return () => { active = false; };
  }, [mode, setError]);
  function submit(event: FormEvent<HTMLFormElement>, item: ConsultantFinancialRecord) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    setPending({ id: item.id, expectedAuditId: item.lastAuditId, status: String(data.get("status")), reference: String(data.get("reference")),
      date: String(data.get("date")), notes: String(data.get("notes")) });
  }
  async function save() {
    if (!pending || submitting.current) return;
    submitting.current = true; setBusy(true); setError(null); setMessage(null);
    try {
      const result = await recordConsultantSettlement(pending);
      setItems(current => current.map(item => item.id === result.record.id ? result.record : item));
      setPending(null); setMessage("Settlement recorded. This does not initiate a bank transfer.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Settlement update could not be confirmed."); }
    finally { submitting.current = false; setBusy(false); }
  }
  const summary = page?.summary;
  const visible = items.filter(item => (!status || item.settlementStatus === status) && [item.bookingReference, item.consultantName, item.consumerName, item.paymentId, item.orderId, item.consultantId]
    .some(value => String(value ?? "").toLowerCase().includes(search.trim().toLowerCase())));
  return <PortalShell role="admin" title="Finance">
    <AdminFinanceNavigation active="consultants" />
    <section className="portal-flow-intro portal-section-heading"><h2>Consultant Finance</h2><p>Verified WellnessPath collections, not total platform revenue. Consultant base fees are unchanged; Ayursarga bears gateway charges. Payouts are external bank transfers recorded manually.</p></section>
    <div className="portal-actions portal-finance-toolbar"><label className="portal-filter-field">Payment mode<select value={mode} disabled={busy} onChange={event => { setPage(null); setItems([]); setBusy(true); setError(null); setMode(event.target.value); setMessage(null); }}><option value="live">Live payments</option><option value="test">Test payments</option></select></label><button className="portal-button secondary" disabled={busy} onClick={() => void load()}>Refresh</button></div>
    {summary && <div className="portal-finance-stats">{[
      ["Gross collections", money(summary.grossPaise)], ["Ayursarga commission", money(summary.commissionPaise)],
      ["Gateway charges (including tax)", money(summary.gatewayFeePaise)], ["Consultant payouts pending", money(summary.pendingPayablePaise)],
      ["Consultant payouts paid", money(summary.paidPayablePaise)], ["Refunds verified", money(summary.refundedPaise)],
      ["Net platform revenue", summary.unknownFeeCount || summary.refundedPaise || summary.reviewCount ? "Reconciliation pending" : money(summary.commissionPaise - summary.gatewayFeePaise)],
    ].map(([label, value]) => <article className="portal-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>}
    {summary && <p className="portal-form-note">{summary.count} verified transactions · {summary.reviewCount} on review hold · {summary.unknownFeeCount} awaiting gateway fee data. Gateway net amounts are calculated, not proof of settlement into Ayursarga’s bank account.</p>}
    <section className="portal-card portal-booking-filters portal-finance-filters" aria-label="Consultant finance filters"><label className="portal-filter-field">Search loaded transactions<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Booking, consultant, consumer or payment reference" /></label><label className="portal-filter-field">Settlement status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option><option value="pending">Pending</option><option value="processed">Processed</option><option value="paid">Paid</option></select></label><p className="portal-filter-note full">Search and status filters apply to loaded transactions. Summary totals cover the selected payment mode.</p></section>
    <PortalToast message={error} notification={errorEvent} tone="error" /><PortalToast message={message} notification={messageEvent} />
    {error && <p className="portal-form-error" role="alert">{error}</p>}
    {Boolean(page?.setupIssues?.length) && <section className="portal-card" aria-label="Payment setup review"><h3>Payment setup needs review</h3><p>Latest 10 pending or uncertain setups. These are not verified collections. Check the receipt in Razorpay before authorizing another payment; do not recreate an uncertain order.</p>{page?.setupIssues?.map(issue => <p key={issue.id}>{issue.consultantName} · {money(issue.totalPaise)} · {formatStatus(issue.state)} · Receipt: <code>{issue.receipt}</code></p>)}</section>}
    {busy && !items.length && <p role="status">Loading Finance...</p>}
    {!busy && !error && !visible.length && <section className="portal-card"><h3>No matching financial records</h3><p>Only verified consultant payments appear here. Legacy bookings and Search Center bookings are not treated as collected revenue.</p></section>}
    <div className="portal-list">{visible.map(item => <article className="portal-card" key={item.id}>
      <div className="portal-finance-row"><div><h3>{item.bookingReference ?? "Payment needs booking review"}</h3><p>{item.consultantName} · {item.consumerName}</p><p>{item.serviceName} · {formatDisplayDateTime(item.createdAt)}</p></div><div><strong>{money(item.grossPaise)}</strong><p><span className="portal-status" data-status={item.settlementStatus === "paid" ? "completed" : "pending"}>{formatStatus(item.settlementStatus)}</span>{item.settlementHold ? " · Review hold" : ""}</p></div></div>
      <details className="portal-finance-details"><summary>View financial breakdown</summary><dl className="portal-finance-breakdown">{[
        ["Payment reference", item.paymentId], ["Order reference", item.orderId], ["Payment status", formatStatus(item.paymentStatus)],
        ["Consumer total paid", money(item.grossPaise)], ["Ayursarga commission", `${money(item.commissionPaise)} (${item.commissionPercentage}%)`],
        ["Consultant payable", money(item.consultantPayablePaise)], ["Gateway charges including tax", money(item.gatewayFeePaise)],
        ["Tax included in gateway charges", money(item.gatewayTaxPaise)], ["Refunded amount", money(item.refundedPaise)],
        ["Gateway net after refunds/fees (calculated)", money(item.netSettlementPaise)], ["Net platform revenue", money(item.netRevenuePaise)],
        ["Settlement status", formatStatus(item.settlementStatus)], ["Transfer reference", item.settlementReference ?? "Not recorded"],
        ["Settlement date", item.settlementDate ? formatDisplayDate(item.settlementDate) : "Not recorded"], ["Settlement notes", item.settlementNotes || "Not recorded"],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {item.settlementHold && <p className="portal-form-error">Settlement held: {formatStatus(item.reviewReason ?? "review required")}. Contact the responsible Admin before paying out.</p>}
      {!item.settlementHold && item.settlementStatus !== "paid" && <form className="portal-form" onSubmit={event => submit(event, item)}>
        <label>Record settlement as<select name="status" disabled={busy} defaultValue="paid"><option value="processed">Processed</option><option value="paid">Paid</option></select></label>
        <label>Transfer reference *<input name="reference" required minLength={3} maxLength={120} disabled={busy} /></label>
        <label>Settlement date *<DateInput name="date" required max={toDateInputValue()} defaultValue={toDateInputValue()} disabled={busy} /></label>
        <label>Notes (optional)<textarea name="notes" maxLength={500} disabled={busy} /></label>
        <div className="portal-actions full"><button className="portal-button" disabled={busy}>Record settlement</button></div>
      </form>}
      </details>
    </article>)}</div>
    {page?.hasMore && <div className="portal-actions"><button className="portal-button secondary" disabled={busy} onClick={() => void load(page.cursor)}>Load more transactions</button></div>}
    <PortalDialog open={Boolean(pending)} title="Record this consultant settlement?" message="Confirm the external transfer details. Ayursarga will record this status only; no money is transferred by this action." confirmLabel="Record settlement" busy={busy} onConfirm={() => void save()} onCancel={() => { if (!busy) setPending(null); }}>
      {pending && <p>{formatStatus(pending.status)} · {pending.reference} · {formatDisplayDate(pending.date)}</p>}
    </PortalDialog>
  </PortalShell>;
}
