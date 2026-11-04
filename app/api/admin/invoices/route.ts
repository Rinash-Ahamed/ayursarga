import { withApiTiming } from "@/services/api/timing";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { requestAuditDevice } from "@/services/api/audit";
import { allowRequest } from "@/services/api/rateLimit";
import { INVOICE_ISSUER, invoiceParty, validateInvoiceInput, decimalHundredths } from "@/features/billing/invoices";
import { isIsoDate, toDateInputValue } from "@/utils/date";

export const runtime = "nodejs";
class InvoiceError extends Error { constructor(message: string, public status: number) { super(message); } }
const validId = (id: string) => /^[a-f0-9]{64}$/.test(id);

async function handleGET(request: Request) {
  try {
    const { firestore } = await requireActiveAdmin(request);
    const query = new URL(request.url).searchParams;
    const id = query.get("id");
    if (id) {
      if (!validId(id)) return apiJson({ error: "Invalid invoice." }, 400);
      const snapshot = await firestore.collection("invoices").doc(id).get();
      if (!snapshot.exists) return apiJson({ error: "Invoice not found." }, 404);
      return apiJson({ invoice: { ...snapshot.data(), id: snapshot.id } });
    }
    const cursor = query.get("cursor");
    let invoices = firestore.collection("invoices").orderBy("createdAt", "desc").limit(21);
    if (cursor) {
      if (!validId(cursor)) return apiJson({ error: "Invalid invoice page." }, 400);
      const snapshot = await firestore.collection("invoices").doc(cursor).get();
      if (!snapshot.exists) return apiJson({ error: "Invoice page is no longer available." }, 400);
      invoices = invoices.startAfter(snapshot);
    }
    const snapshot = await invoices.get();
    const page = snapshot.docs.slice(0, 20);
    return apiJson({ documents: page.map((document) => ({ ...document.data(), id: document.id })),
      cursor: page.at(-1)?.id ?? null, hasMore: snapshot.size > 20 });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return apiJson({ error: error.message }, error.status);
    logApiError("GET /api/admin/invoices", error);
    return apiJson({ error: "Invoices are temporarily unavailable." }, 503);
  }
}

async function handlePOST(request: Request) {
  try {
    const { uid, firestore } = await requireActiveAdmin(request);
    if (!allowRequest(`invoice-create:${uid}`, 30, 10 * 60 * 1000)) return apiJson({ error: "Please wait before generating more invoices." }, 429);
    const body = await readJsonBody(request, 6000) as Record<string, unknown> | null;
    if (!body || Array.isArray(body)) return apiJson({ error: "Invoice details are required." }, 400);
    const validation = validateInvoiceInput(body);
    if (!validation.isValid) return apiJson({ error: Object.values(validation.errors)[0] }, 400);
    const requestId = typeof body.requestId === "string" && /^[a-zA-Z0-9-]{16,100}$/.test(body.requestId) ? body.requestId : null;
    if (!requestId) return apiJson({ error: "Start a new invoice attempt." }, 400);
    const id = createHash("sha256").update(`${uid}:${requestId}`).digest("hex");
    const inputHash = createHash("sha256").update(JSON.stringify(validation.data)).digest("hex");
    const invoiceRef = firestore.collection("invoices").doc(id);
    const result = await firestore.runTransaction(async (transaction) => {
      const existing = await transaction.get(invoiceRef);
      if (existing.exists) {
        if (existing.data()?.inputHash !== inputHash || existing.data()?.createdBy !== uid) throw new InvoiceError("This invoice attempt has different details. Start a new invoice.", 409);
        return { invoice: { ...existing.data(), id }, duplicate: true };
      }
      const year = validation.data.invoiceDate.slice(0, 4);
      const counterRef = firestore.collection("systemSettings").doc(`invoiceSequence-${year}`);
      const [hospitalSnapshot, counter] = await transaction.getAll(firestore.collection("hospitals").doc(validation.data.hospitalId), counterRef);
      const hospital = hospitalSnapshot.data();
      if (!hospitalSnapshot.exists || hospital?.status === "archived") throw new InvoiceError("Select an available hospital.", 409);
      const billTo = invoiceParty(hospital!);
      if (!billTo.name || !billTo.address) throw new InvoiceError("Complete the hospital's billing name and registered address first.", 409);
      const sequence = Number(counter.data()?.value ?? 0) + 1;
      if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 99999) throw new InvoiceError("Invoice numbering needs Admin review.", 409);
      const auditRef = firestore.collection("auditLogs").doc();
      const now = FieldValue.serverTimestamp();
      const invoice = { ...validation.data, ...validation.totals, invoiceNumber: `AS/${year}/${String(sequence).padStart(5, "0")}`,
        issuer: INVOICE_ISSUER, billTo, status: "issued", inputHash, paidPaise: 0, paymentStatus: "unpaid",
        createdAt: now, createdBy: uid, updatedAt: now, updatedBy: uid, archivedAt: null, archivedBy: null, lastAuditId: auditRef.id };
      transaction.set(counterRef, { value: sequence, updatedAt: now, updatedBy: uid }, { merge: true });
      transaction.create(invoiceRef, invoice);
      transaction.create(auditRef, { action: "create", module: "invoices", recordId: id, actorId: uid, actorRole: "admin",
        previousValues: null, updatedValues: invoice, timestamp: now, source: "server", device: requestAuditDevice(request) });
      return { invoice: { ...invoice, id }, duplicate: false };
    });
    return apiJson({ ok: true, ...result }, result.duplicate ? 200 : 201);
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError || error instanceof InvoiceError) return apiJson({ error: error.message }, error.status);
    logApiError("POST /api/admin/invoices", error);
    return apiJson({ error: "We could not generate the invoice. Your attempt can be retried safely." }, 503);
  }
}

/** Record money received outside the app; never changes the issued invoice. */
async function handlePATCH(request: Request) {
  try {
    const { uid, firestore } = await requireActiveAdmin(request);
    if (!allowRequest(`invoice-receipt:${uid}`, 30, 10 * 60 * 1000)) return apiJson({ error: "Please wait before recording more payments." }, 429);
    const body = await readJsonBody(request, 3000) as Record<string, unknown> | null;
    const amountPaise = decimalHundredths(body?.amount);
    if (!body || typeof body.id !== "string" || !validId(body.id) || typeof body.expectedAuditId !== "string"
      || typeof body.requestId !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(body.requestId)
      || amountPaise === null || amountPaise <= 0 || typeof body.date !== "string" || !isIsoDate(body.date) || body.date > toDateInputValue()
      || typeof body.reference !== "string" || body.reference.trim().length < 3 || body.reference.length > 120
      || typeof body.notes !== "string" || body.notes.length > 500
      || Object.keys(body).some(key => !["id", "expectedAuditId", "requestId", "amount", "date", "reference", "notes"].includes(key))) {
      return apiJson({ error: "Enter the amount received, payment date and payment reference." }, 400);
    }
    const values = { amountPaise, date: body.date, reference: body.reference.trim(), notes: body.notes.trim() };
    const invoiceRef = firestore.collection("invoices").doc(body.id);
    // One reference per invoice also protects retries after a browser refresh.
    const receiptId = createHash("sha256").update(`${body.id}:${values.reference.toLowerCase()}`).digest("hex");
    const receiptRef = firestore.collection("invoiceReceipts").doc(receiptId);
    const attemptRef = firestore.collection("invoicePaymentAttempts").doc(createHash("sha256").update(`${body.id}:${body.requestId}`).digest("hex"));
    const invoice = await firestore.runTransaction(async transaction => {
      const [snapshot, receipt, attempt] = await transaction.getAll(invoiceRef, receiptRef, attemptRef);
      const current = snapshot.data();
      if (!current) throw new InvoiceError("Invoice not found.", 404);
      if (attempt.exists && attempt.data()!.receiptId !== receiptId) throw new InvoiceError("This payment attempt used a different reference. Refresh and check the invoice before recording another payment.", 409);
      if (receipt.exists) {
        const saved = receipt.data()!;
        if (saved.amountPaise !== amountPaise || saved.date !== values.date || saved.notes !== values.notes) throw new InvoiceError("This payment reference has already been recorded with different details.", 409);
        return { ...current, id: snapshot.id };
      }
      if ((current.lastAuditId ?? "") !== body.expectedAuditId) throw new InvoiceError("This invoice has changed. Refresh and review its payments before continuing.", 409);
      if (current.archivedAt != null || current.status !== "issued") throw new InvoiceError("Payments cannot be recorded for this invoice.", 409);
      if (values.date < current.invoiceDate) throw new InvoiceError("Payment date cannot be before the invoice date.", 400);
      const paidPaise = current.paidPaise ?? 0;
      if (!Number.isSafeInteger(paidPaise) || paidPaise < 0 || !Number.isSafeInteger(current.totalPaise) || paidPaise + amountPaise > current.totalPaise) throw new InvoiceError("The amount exceeds this invoice's outstanding balance. Refresh and check the payment details.", 409);
      const audit = firestore.collection("auditLogs").doc();
      const now = FieldValue.serverTimestamp();
      const changes = { paidPaise: paidPaise + amountPaise, paymentStatus: paidPaise + amountPaise === current.totalPaise ? "paid" : "partially_paid",
        lastReceipt: values, updatedAt: now, updatedBy: uid, lastAuditId: audit.id };
      transaction.set(invoiceRef, { ...current, ...changes });
      transaction.create(receiptRef, { ...values, invoiceId: snapshot.id, requestId: body.requestId, createdAt: now, createdBy: uid, lastAuditId: audit.id });
      transaction.create(attemptRef, { receiptId, invoiceId: snapshot.id, createdAt: now, createdBy: uid, lastAuditId: audit.id });
      transaction.create(audit, { action: "payment_recorded", module: "invoices", recordId: snapshot.id, actorId: uid, actorRole: "admin",
        previousValues: { paidPaise, paymentStatus: current.paymentStatus ?? "unpaid" }, updatedValues: changes, timestamp: now, source: "server", device: requestAuditDevice(request) });
      return { ...current, ...changes, id: snapshot.id };
    });
    return apiJson({ invoice });
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof RequestBodyError || error instanceof InvoiceError) return apiJson({ error: error.message }, error.status);
    logApiError("PATCH /api/admin/invoices", error);
    return apiJson({ error: "Payment could not be confirmed. Retry with the same reference to avoid recording it twice." }, 503);
  }
}

export const GET = withApiTiming("GET /api/admin/invoices", handleGET);
export const POST = withApiTiming("POST /api/admin/invoices", handlePOST);
export const PATCH = withApiTiming("PATCH /api/admin/invoices", handlePATCH);
