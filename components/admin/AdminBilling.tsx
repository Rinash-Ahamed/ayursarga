"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalToast } from "@/components/portal/PortalToast";
import { PortalFeedback } from "@/components/portal/PortalFeedback";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { DateInput } from "@/components/forms/DateInput";
import { ContractPreviewDialog } from "@/components/admin/ContractPreviewDialog";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useRepeatableMessage } from "@/hooks/useRepeatableMessage";
import { listAllHospitals } from "@/services/hospitals/hospitalService";
import { createInvoice, listInvoices } from "@/services/billing/invoiceService";
import { emptyInvoiceInput, INVOICE_ISSUER, invoiceParty, validateInvoiceInput, type CommissionInvoice, type InvoiceInput } from "@/features/billing/invoices";
import { buildInvoiceHtml } from "@/features/billing/invoiceTemplate";
import type { HospitalDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { formatCurrency } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import { focusFirstInvalidField } from "@/utils/formFocus";

export function AdminBilling() {
  const loader = useCallback((cursor: string | null) => listInvoices(cursor), []);
  const list = usePaginatedList<CommissionInvoice, string>(loader, "We could not load invoices. Please try again.");
  const [recent, setRecent] = useState<CommissionInvoice[]>([]);
  const [creating, setCreating] = useState(false);
  const [input, setInput] = useState<InvoiceInput>(emptyInvoiceInput);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof InvoiceInput, string>>>({});
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<DocumentRecord<HospitalDocument>[]>([]);
  const [hospital, setHospital] = useState<DocumentRecord<HospitalDocument> | null>(null);
  const [preview, setPreview] = useState<CommissionInvoice | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const attempt = useRef<{ payload: string; requestId: string } | null>(null);
  const [error, setError, errorNotification] = useRepeatableMessage();
  const [message, setMessage, messageNotification] = useRepeatableMessage();

  useEffect(() => {
    if (!creating || hospital || search.trim().length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void listAllHospitals({ pageSize: 8 }, search).then((page) => {
        if (active) setResults(page.documents);
      }).catch(() => { if (active) setError("We could not search hospitals. Please try again."); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [creating, hospital, search, setError]);

  function change<K extends keyof InvoiceInput>(key: K, value: InvoiceInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }
  function newInvoice() {
    setCreating(true); setHospital(null); setSearch(""); setResults([]); setInput(emptyInvoiceInput());
    setFieldErrors({}); setError(null); attempt.current = null;
  }
  function showPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateInvoiceInput(input);
    setFieldErrors(validation.errors); setError(null);
    if (!validation.isValid || !hospital) { setError("Check the highlighted invoice details."); focusFirstInvalidField(event.currentTarget); return; }
    setPreview({ ...validation.data, ...validation.totals, id: "draft", invoiceNumber: "DRAFT", status: "issued", issuer: INVOICE_ISSUER, billTo: invoiceParty(hospital) });
    setIsDraft(true);
  }
  async function generateOrDownload() {
    if (submitting.current || !preview) return;
    submitting.current = true; setBusy(true); setError(null);
    try {
      if (isDraft) {
        const payload = JSON.stringify(input);
        if (attempt.current?.payload !== payload) attempt.current = { payload, requestId: crypto.randomUUID() };
        const result = await createInvoice(input, attempt.current!.requestId);
        setRecent((current) => [result.invoice, ...current.filter((invoice) => invoice.id !== result.invoice.id)].slice(0, 20));
        setPreview(result.invoice); setIsDraft(false); setCreating(false);
        setMessage(`${result.invoice.invoiceNumber} generated. You can now download the PDF.`);
      } else {
        const { buildBrandedDocumentPdf } = await import("@/features/hospitals/contractPdf");
        const blob = buildBrandedDocumentPdf(buildInvoiceHtml(preview), ".invoice-document", "COMMISSION INVOICE", "Ayursarga Hospital Billing");
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = url;
        link.download = `${preview.invoiceNumber.replaceAll("/", "-")}-${preview.invoiceDate}.pdf`;
        document.body.appendChild(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not prepare the invoice."); }
    finally { submitting.current = false; setBusy(false); }
  }
  const validation = validateInvoiceInput(input);
  const invoices = [...recent, ...list.items].filter((invoice, index, all) => all.findIndex((candidate) => candidate.id === invoice.id) === index);
  const fieldError = (field: keyof InvoiceInput) => fieldErrors[field] && <span className="portal-field-error" role="alert">{fieldErrors[field]}</span>;

  return <PortalShell role="admin" title="Invoices & Billing">
    <div className="portal-actions portal-page-actions"><button className="portal-button" onClick={newInvoice}>New commission invoice</button></div>
    <p className="portal-form-note">Generate hospital commission invoices. Review the commission amount and tax treatment before issuing.</p>
    {creating && <form className="portal-card portal-form billing-form" onSubmit={showPreview} noValidate>
      <div className="full billing-hospital-search"><label>Hospital *<input type="search" value={search} placeholder="Type at least 2 letters" aria-invalid={Boolean(fieldErrors.hospitalId)} onChange={(event) => { setSearch(event.target.value); setHospital(null); setResults([]); change("hospitalId", ""); }} /></label>
        {!hospital && search.trim().length >= 2 && results.length > 0 && <div className="billing-hospital-results" aria-label="Hospital suggestions">{results.map((record) => <button type="button" key={record.id} onClick={() => {
          setHospital(record); setSearch(record.name); setResults([]); setInput((current) => ({ ...current, hospitalId: record.id, placeOfSupply: record.state ?? "" }));
        }}>{record.name}<small>{record.city}, {record.state}</small></button>)}</div>}
        {hospital && <p className="portal-form-note">{hospital.legalName || hospital.name} · {hospital.registeredAddress || hospital.address} · GSTIN: {hospital.gstin || "Not provided"}</p>}{fieldError("hospitalId")}
      </div>
      <label>Invoice date *<DateInput value={input.invoiceDate} onChange={(event) => change("invoiceDate", event.target.value)} required aria-invalid={Boolean(fieldErrors.invoiceDate)} />{fieldError("invoiceDate")}</label>
      <label><span className="portal-field-label">Due date <small>(Optional)</small></span><DateInput value={input.dueDate} min={input.invoiceDate || undefined} onChange={(event) => change("dueDate", event.target.value)} aria-invalid={Boolean(fieldErrors.dueDate)} />{fieldError("dueDate")}</label>
      <label className="full">Commission description *<textarea value={input.description} maxLength={500} onChange={(event) => change("description", event.target.value)} aria-invalid={Boolean(fieldErrors.description)} />{fieldError("description")}</label>
      <label>Commission amount (₹) *<input type="number" min="0.01" step="0.01" value={input.commissionAmount} onChange={(event) => change("commissionAmount", event.target.value)} aria-invalid={Boolean(fieldErrors.commissionAmount)} />{fieldError("commissionAmount")}</label>
      <label>Tax treatment *<select value={input.taxMode} onChange={(event) => change("taxMode", event.target.value as InvoiceInput["taxMode"])}><option value="cgst-sgst">CGST + SGST</option><option value="igst">IGST</option><option value="none">No GST</option></select>{fieldError("taxMode")}</label>
      <label>GST rate (%) *<input type="number" min="0" max="100" step="0.01" value={input.gstRate} placeholder="Enter applicable rate" onChange={(event) => change("gstRate", event.target.value)} aria-invalid={Boolean(fieldErrors.gstRate)} />{fieldError("gstRate")}</label>
      <label>Place of supply *<input value={input.placeOfSupply} maxLength={100} onChange={(event) => change("placeOfSupply", event.target.value)} aria-invalid={Boolean(fieldErrors.placeOfSupply)} />{fieldError("placeOfSupply")}</label>
      <label><span className="portal-field-label">SAC <small>(Optional)</small></span><input value={input.sac} inputMode="numeric" maxLength={8} onChange={(event) => change("sac", event.target.value)} aria-invalid={Boolean(fieldErrors.sac)} />{fieldError("sac")}</label>
      <label className="full"><span className="portal-field-label">Notes / payment instructions <small>(Optional)</small></span><textarea value={input.notes} maxLength={1000} onChange={(event) => change("notes", event.target.value)} aria-invalid={Boolean(fieldErrors.notes)} />{fieldError("notes")}</label>
      <div className="billing-total full"><span>Total invoice amount</span><strong>{formatCurrency(validation.totals.totalPaise / 100)}</strong></div>
      <div className="portal-actions full"><button className="portal-button">Preview invoice</button><button type="button" className="portal-button secondary" onClick={() => setCreating(false)}>Cancel</button></div>
    </form>}
    <PortalFeedback error={list.error} notification={list.errorNotification} empty={!list.isLoading && !list.error && invoices.length === 0 ? "Select New commission invoice to prepare your first invoice." : undefined} emptyTitle="No invoices yet" />
    {list.isLoading && <p role="status">Loading invoices…</p>}
    <div className="portal-list">{invoices.map((invoice) => <article className="portal-card billing-invoice-card" key={invoice.id}>
      <div className="portal-row-heading"><div><h3>{invoice.invoiceNumber}</h3><p>{invoice.billTo.name}</p></div><span className="portal-status" data-status="active">Issued</span></div>
      <dl className="consultant-details"><div><dt>Invoice date</dt><dd>{formatDisplayDate(invoice.invoiceDate)}</dd></div><div><dt>Due date</dt><dd>{formatDisplayDate(invoice.dueDate, "Not set")}</dd></div><div><dt>Total</dt><dd>{formatCurrency(invoice.totalPaise / 100)}</dd></div></dl>
      <div className="portal-actions"><button className="portal-button secondary" onClick={() => { setPreview(invoice); setIsDraft(false); setError(null); }}>View invoice / Download PDF</button></div>
    </article>)}</div>
    <PortalPagination hasMore={list.hasMore} isLoading={list.isLoading} onLoadMore={() => void list.loadMore()} />
    <PortalToast message={error ?? message} notification={error ? errorNotification : messageNotification} tone={error ? "error" : "success"} />
    {preview && <ContractPreviewDialog open html={buildInvoiceHtml(preview)} filename={preview.invoiceNumber} busy={busy} heading={isDraft ? "Review commission invoice" : "Commission invoice"} documentTitle="Ayursarga commission invoice preview"
      description={error ?? (isDraft ? "Review hospital, amounts and tax details. Generating assigns a permanent invoice number and saves this invoice." : "This issued invoice is saved. Download the PDF for the hospital.")}
      actionLabel={isDraft ? "Generate invoice" : "Download PDF"} busyLabel={isDraft ? "Generating invoice…" : "Preparing PDF…"}
      closeLabel="Close invoice preview"
      onDownload={() => void generateOrDownload()} onClose={() => { setPreview(null); setError(null); }} />}
  </PortalShell>;
}
