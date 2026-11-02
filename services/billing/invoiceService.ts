"use client";
import { authorizedApiRequest } from "@/services/api/client";
import type { CommissionInvoice, InvoiceInput } from "@/features/billing/invoices";

const messages = { signedOutMessage: "Sign in as Admin to manage invoices.", failureMessage: "We could not load the invoices." };
export function listInvoices(cursor?: string | null) {
  return authorizedApiRequest<{ documents: CommissionInvoice[]; cursor: string | null; hasMore: boolean }>(`/api/admin/invoices${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, messages);
}
export function createInvoice(input: InvoiceInput, requestId: string) {
  return authorizedApiRequest<{ invoice: CommissionInvoice }>("/api/admin/invoices", { ...messages, failureMessage: "We could not generate the invoice.",
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, requestId }) });
}
export function recordInvoicePayment(input: { id: string; expectedAuditId: string; requestId: string; amount: string; date: string; reference: string; notes: string }) {
  return authorizedApiRequest<{ invoice: CommissionInvoice }>("/api/admin/invoices", { ...messages, failureMessage: "We could not record the payment.",
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}
