import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingFlowFixture, bookingTestRequest } from "../helpers/bookingFlowFixture.mjs";
import { consultationPaymentFixture, prepare, verify } from "../helpers/consultationPaymentFixture.mjs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const fields = { name: "Consultant", email: "first@example.test", contactNo: "9876543210", whatsappNo: "9876543210", qualification: "BAMS", yearsExperience: 3, consultantCharge: 300, ayursargaCommissionPercentage: 10 };
const patch = body => new Request("https://test.local/api/admin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
function edit(f, body, id = "AS001") {
  return f.load("app/api/admin/consultants/[consultantId]/route.ts").PATCH(patch(body), { params: Promise.resolve({ consultantId: id }) });
}
test("consultant revisions reject stale and missing versions while returned versions permit the next edit/status change", async () => {
  const f = bookingFlowFixture({ actor: { role: "admin" }, records: { "consultants/AS001": { ...fields, status: "active", lastAuditId: "original" } } });
  const response = await edit(f, { action: "update", fields: { ...fields, consultantCharge: 500 }, expectedAuditId: "original" });
  assert.equal(response.status, 200);
  const { lastAuditId } = await response.json();
  assert.equal(lastAuditId, f.records.get("consultants/AS001").lastAuditId);
  assert.equal((await edit(f, { action: "update", fields, expectedAuditId: "original" })).status, 412);
  assert.equal((await edit(f, { action: "status_change", status: "inactive" })).status, 400);
  assert.equal(f.records.get("consultants/AS001").consultantCharge, 500);
  assert.equal(f.values("auditLogs").length, 1);
  assert.equal((await edit(f, { action: "status_change", status: "inactive", expectedAuditId: lastAuditId })).status, 200);
  assert.equal(f.values("auditLogs").length, 2);
});
test("email edits reject normalized duplicates including archived records and serialize against concurrent edits and creates", async () => {
  for (const status of ["active", "inactive", "archived"]) {
    const f = bookingFlowFixture({ actor: { role: "admin" }, records: {
      "consultants/AS001": { ...fields, employeeSequence: 1, lastAuditId: "first" }, "consultants/AS002": { ...fields, employeeSequence: 2, email: "second@example.test", status, lastAuditId: "second" },
    } });
    const denied = await edit(f, { action: "update", fields: { ...fields, email: " SECOND@EXAMPLE.TEST " }, expectedAuditId: "first" });
    assert.equal(denied.status, 409); assert.equal((await denied.json()).field, "email");
    assert.equal(f.calls.writes.length, 0);
    const results = await Promise.all([
      edit(f, { action: "update", fields: { ...fields, email: "shared@example.test" }, expectedAuditId: "first" }),
      f.load("app/api/admin/consultants/route.ts").POST(bookingTestRequest("/api/admin/consultants", { ...fields, email: "shared@example.test" })),
    ]);
    assert.equal(results.filter(r => r.status === 200 || r.status === 201).length, 1);
    assert.equal(results.filter(r => r.status === 409).length, 1);
    assert.equal(f.values("consultants").filter(value => value.email === "shared@example.test").length, 1);
  }
  const f = bookingFlowFixture({ actor: { role: "admin" }, records: {
    "consultants/AS001": { ...fields, lastAuditId: "one" }, "consultants/AS002": { ...fields, email: "second@example.test", lastAuditId: "two" },
  } });
  const results = await Promise.all([edit(f, { action: "update", fields: { ...fields, email: "new@example.test" }, expectedAuditId: "one" }), edit(f, { action: "update", fields: { ...fields, email: "new@example.test" }, expectedAuditId: "two" }, "AS002")]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
});
test("Admin availability accepts only real ISO calendar dates and preserves India midnight", async () => {
  let range;
  class RangeError extends Error {}
  const f = bookingFlowFixture({ actor: { role: "admin" }, overrides: {
    "@/services/firebase/admin": { isFirebaseAdminReady: () => true },
    "@/services/hospitals/availabilityAdmin": { AvailabilityOperationError: RangeError, createAdminBlock: async value => { range = value; } },
  } });
  const { POST } = f.load("app/api/admin/availability/route.ts");
  for (const date of ["2099-02-30", "2027-02-29", "2099-13-01", "03/04/2099", "2099-03-01T00:00:00Z"]) {
    assert.equal((await POST(bookingTestRequest("/api/admin/availability", { hospitalId: "hospital", startDate: date, endDate: date, reason: "Unavailable" }))).status, 400);
    assert.equal(range, undefined);
  }
  assert.equal((await POST(bookingTestRequest("/api/admin/availability", { hospitalId: "hospital", startDate: "2028-02-29", endDate: "2028-02-29", reason: "Unavailable" }))).status, 201);
  assert.equal(range.startDate.toISOString(), "2028-02-28T18:30:00.000Z");
});
test("contract effective and expiry dates reject impossible days without normalizing", () => {
  const { validateHospitalContractDetails } = loadTypeScript("features/hospitals/contractDetails.ts");
  for (const date of ["2027-02-29", "2028-02-30", "2026-04-31"]) {
    const result = validateHospitalContractDetails({ contractEffectiveDate: date, contractExpiryDate: date });
    assert.ok(result.errors.contractEffectiveDate); assert.ok(result.errors.contractExpiryDate);
  }
  const result = validateHospitalContractDetails({ contractEffectiveDate: "2028-02-29", contractExpiryDate: "2031-02-28" });
  assert.equal(result.errors.contractEffectiveDate, undefined); assert.equal(result.errors.contractExpiryDate, undefined);
});

const invoiceId = "a".repeat(64);
function receipt(f, changes = {}) {
  return f.load("app/api/admin/invoices/route.ts").PATCH(patch({ id: invoiceId, expectedAuditId: "issued", requestId: "receipt-attempt-0001", amount: "40.00", date: "2026-11-01", reference: "BANK-001", notes: "Received by bank", ...changes }));
}
function invoiceFixture(options = {}) {
  return bookingFlowFixture({ actor: { role: "admin" }, ...options, records: { [`invoices/${invoiceId}`]: { status: "issued", totalPaise: 10000, invoiceDate: "2026-10-01", lastAuditId: "issued", invoiceNumber: "AS/2026/00001", billTo: { name: "Original hospital" } }, ...options.records } });
}
test("invoice partial/full receipts preserve issued contents, atomically audit, deduplicate retries and prevent overpayment", async () => {
  const f = invoiceFixture();
  const responses = await Promise.all([receipt(f), receipt(f)]);
  assert.ok(responses.every(r => r.status === 200));
  const first = (await responses[0].json()).invoice;
  assert.equal(first.paidPaise, 4000); assert.equal(first.paymentStatus, "partially_paid");
  assert.equal(f.values("invoiceReceipts").length, 1); assert.equal(f.values("auditLogs").length, 1);
  assert.equal((await receipt(f, { amount: "50.00" })).status, 409);
  assert.equal((await receipt(f, { reference: "BANK-002" })).status, 409);
  assert.equal((await receipt(f, { requestId: "receipt-attempt-0002", reference: "BANK-002", expectedAuditId: first.lastAuditId, amount: "60.01" })).status, 409);
  const second = await receipt(f, { requestId: "receipt-attempt-0002", reference: "BANK-002", expectedAuditId: first.lastAuditId, amount: "60.00" });
  assert.equal(second.status, 200);
  const saved = (await second.json()).invoice;
  assert.equal(saved.paymentStatus, "paid"); assert.equal(saved.totalPaise - saved.paidPaise, 0);
  assert.equal(saved.billTo.name, "Original hospital"); assert.equal(saved.invoiceNumber, "AS/2026/00001"); assert.equal(saved.status, "issued");
  assert.equal(f.values("invoiceReceipts").length, 2); assert.equal(f.values("auditLogs").length, 2);
});
test("invoice receipts deny other roles, stale writes, invalid amounts/dates and failed commits", async () => {
  for (const role of ["consumer", "hospital"]) assert.equal((await receipt(invoiceFixture({ actor: { role } }))).status, 403);
  for (const changes of [{ amount: "-1" }, { amount: "1e2" }, { amount: "0" }, { amount: "1.001" }, { date: "2026-02-30" }, { date: "2099-01-01" }, { reference: "" }]) {
    const f = invoiceFixture(); assert.equal((await receipt(f, changes)).status, 400); assert.equal(f.calls.writes.length, 0);
  }
  const f = invoiceFixture({ failCommit: true });
  assert.equal((await receipt(f)).status, 503); assert.equal(f.values("invoiceReceipts").length, 0); assert.equal(f.records.get(`invoices/${invoiceId}`).paidPaise, undefined);
});

async function refundedFixture(changes = {}) {
  const f = consultationPaymentFixture();
  const checkout = (await (await prepare(f)).json()).checkout;
  f.capture(checkout); assert.equal((await verify(f, checkout.intentId)).status, 200);
  const booking = f.records.get(`consultationBookings/${checkout.intentId}`);
  f.records.set(`consultationBookings/${checkout.intentId}`, { ...booking, status: "cancelled" });
  f.capture(checkout, { status: "refunded", amount_refunded: checkout.totalPaise, ...changes });
  await f.load("services/payments/consultationPaymentsAdmin.ts").reconcileConsultationPayment(f.firestore, checkout.intentId, "pay_Synthetic");
  f.actor.role = "admin";
  return { f, id: checkout.intentId };
}
function closeRefund(f, id, changes = {}) {
  return f.load("app/api/admin/consultant-finance/route.ts").POST(bookingTestRequest("/api/admin/consultant-finance", { id, expectedAuditId: f.records.get(`consultationFinancials/${id}`).lastAuditId, notes: "Verified full refund", ...changes }));
}
test("full-refund review closure is Admin-only, idempotent, audited and survives later payment reconciliation", async () => {
  const { f, id } = await refundedFixture();
  const audits = f.values("auditLogs").length;
  assert.equal((await closeRefund(f, id)).status, 200);
  assert.equal(f.values("auditLogs").length, audits + 1);
  const closed = f.records.get(`consultationFinancials/${id}`);
  assert.equal(closed.settlementStatus, "closed"); assert.equal(closed.settlementHold, false); assert.equal(closed.netRevenuePaise, null);
  assert.equal((await closeRefund(f, id, { expectedAuditId: "old" })).status, 200);
  assert.equal(f.values("auditLogs").length, audits + 1);
  // A later fee update forces a financial rewrite, not merely a no-op replay.
  Object.assign(f.paymentState.payments.get("pay_Synthetic"), { fee: 345 });
  await f.load("services/payments/consultationPaymentsAdmin.ts").reconcileConsultationPayment(f.firestore, id, "pay_Synthetic");
  assert.equal(f.records.get(`consultationFinancials/${id}`).settlementHold, false);
  assert.equal(f.records.get(`consultationFinancials/${id}`).reviewResolution, "full_refund_verified");
  assert.equal(f.records.get(`consultationFinancials/${id}`).gatewayFeePaise, 345);
  assert.equal(f.records.get(`consultationFinancials/${id}`).reviewResolutionNotes, "Verified full refund");
  const payout = await f.load("app/api/admin/consultant-finance/route.ts").PATCH(patch({ id, expectedAuditId: closed.lastAuditId, status: "paid", reference: "BANK-REF", date: "2026-11-01", notes: "" }));
  assert.equal(payout.status, 409);
});
test("partial refunds, active appointments, recorded transfers, stale revisions and wrong roles cannot close reviews", async () => {
  for (const condition of ["partial", "active", "transfer", "stale", "consumer", "hospital", "mode", "ledger"]) {
    const { f, id } = await refundedFixture(condition === "partial" ? { status: "captured", amount_refunded: 100 } : {});
    const path = `consultationFinancials/${id}`;
    if (condition === "active") f.records.set(`consultationBookings/${id}`, { ...f.records.get(`consultationBookings/${id}`), status: "confirmed" });
    if (condition === "transfer") f.records.set(path, { ...f.records.get(path), settlementStatus: "paid", settlementReference: "BANK-OLD" });
    if (condition === "ledger") f.records.set(path, { ...f.records.get(path), refundedPaise: 0 });
    if (["consumer", "hospital"].includes(condition)) f.actor.role = condition;
    if (condition === "mode") f.paymentState.mode = "live";
    const before = f.values("auditLogs").length;
    const response = await closeRefund(f, id, condition === "stale" ? { expectedAuditId: "stale" } : {});
    assert.equal(response.status, ["consumer", "hospital"].includes(condition) ? 403 : 409, condition);
    assert.equal(f.values("auditLogs").length, before);
    assert.equal(f.records.get(path).settlementHold, true);
  }
});
