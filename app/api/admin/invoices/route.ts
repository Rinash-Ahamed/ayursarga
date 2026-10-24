import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { AdminAuthorizationError, requireActiveAdmin } from "@/services/firebase/adminAuthorization";
import { apiJson, logApiError } from "@/services/api/server";
import { readJsonBody, RequestBodyError } from "@/services/api/request";
import { requestAuditDevice } from "@/services/api/audit";
import { allowRequest } from "@/services/api/rateLimit";
import { INVOICE_ISSUER, invoiceParty, validateInvoiceInput } from "@/features/billing/invoices";

export const runtime = "nodejs";
class InvoiceError extends Error { constructor(message: string, public status: number) { super(message); } }
const validId = (id: string) => /^[a-f0-9]{64}$/.test(id);

export async function GET(request: Request) {
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

export async function POST(request: Request) {
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
        issuer: INVOICE_ISSUER, billTo, status: "issued", inputHash,
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
