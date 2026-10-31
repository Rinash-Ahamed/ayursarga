import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { consultationPaymentFixture, paidInput, paidConsultant, paymentRequest, prepare, verify } from "../helpers/consultationPaymentFixture.mjs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

test("payment preparation snapshots private commission, returns only total, creates no booking/email and reuses one provider order", async () => {
  const f = consultationPaymentFixture();
  const response = await prepare(f); assert.equal(response.status, 200);
  const { checkout } = await response.json(); assert.equal(checkout.totalPaise, 99055); assert.equal(checkout.state, "ready");
  assert.doesNotMatch(JSON.stringify(checkout), /commission|payable|gateway|settlement|baseCharge|pricing/);
  assert.equal(f.values("consultationBookings").length, 0); assert.equal(f.values("consultationEmailEvents").length, 0);
  await prepare(f); assert.equal(f.paymentState.orderCalls, 1);
  assert.equal((await prepare(f, { ...paidInput, expectedCharge: 1 })).status, 409);
  assert.equal(f.values("bookings").length, 0);
});

test("capture verification atomically confirms exactly one booking and records accurate commission/net amounts", async () => {
  const f = consultationPaymentFixture(); const checkout = (await (await prepare(f)).json()).checkout;
  f.capture(checkout);
  const responses = await Promise.all([verify(f, checkout.intentId), verify(f, checkout.intentId)]);
  assert.ok(responses.every(r => r.status === 200));
  assert.equal(f.values("consultationBookings").length, 1); assert.equal(f.values("consultationFinancials").length, 1);
  const financial = f.values("consultationFinancials")[0];
  assert.equal(financial.grossPaise, 99055); assert.equal(financial.commissionPaise, 9005); assert.equal(financial.consultantPayablePaise, 90050);
  assert.equal(financial.gatewayFeePaise, 234); assert.equal(financial.netRevenuePaise, 8771); assert.equal(financial.netSettlementPaise, 98821);
  assert.equal(financial.settlementStatus, "pending");
  const booking = f.values("consultationBookings")[0]; assert.equal(booking.status, "confirmed"); assert.equal(booking.paymentStatus, "paid");
  assert.doesNotMatch(JSON.stringify(booking), /commission|gateway|settlement|Payable|baseCharge|pricing/);
  const consumer = f.values("consultationEmailEvents").find(e => e.audience === "consumer");
  const consultant = f.values("consultationEmailEvents").find(e => e.audience === "consultant");
  assert.equal(consumer.payload.amount, 990.55); assert.equal(consultant.payload.amount, 900.5);
  assert.equal(f.values("notifications").length, 1); assert.equal(f.values("bookings").length, 0);
});

test("unauthorized, forged, authorized-only, amount-mismatched payments cannot confirm a booking", async () => {
  for (const actor of [{ role: "hospital" }, { role: "admin" }]) assert.equal((await prepare(consultationPaymentFixture({ actor }))).status, 403);
  const f = consultationPaymentFixture(); const checkout = (await (await prepare(f)).json()).checkout;
  f.capture(checkout); assert.equal((await verify(f, checkout.intentId, "pay_Synthetic", "forged")).status, 400);
  f.capture(checkout, { captured: false, status: "authorized" });
  assert.equal((await verify(f, checkout.intentId)).status, 200); assert.equal(f.values("consultationBookings").length, 0);
  f.capture(checkout, { amount: 1 }); assert.equal((await verify(f, checkout.intentId)).status, 409);
  f.actor.uid = "different-consumer"; assert.equal((await verify(f, checkout.intentId)).status, 404);
});

test("uncertain order creation is never automatically repeated", async () => {
  const f = consultationPaymentFixture({ paymentState: { uncertainOrder: true } });
  assert.equal((await prepare(f)).status, 503); assert.equal(f.paymentState.orderCalls, 1);
  const retry = (await (await prepare(f)).json()).checkout;
  assert.equal(retry.state, "order_unknown"); assert.equal(f.paymentState.orderCalls, 1);
});

test("captured payment after availability loss is held for Admin review, without a false booking or email", async () => {
  const f = consultationPaymentFixture(); const checkout = (await (await prepare(f)).json()).checkout;
  f.capture(checkout); f.records.set("consultants/AS001", { ...paidConsultant, status: "inactive" });
  const result = (await (await verify(f, checkout.intentId)).json()).checkout;
  assert.equal(result.state, "paid_review"); assert.equal(result.bookingId, null);
  assert.equal(f.values("consultationBookings").length, 0); assert.equal(f.values("consultationFinancials")[0].settlementHold, true);
  assert.equal(f.values("consultationFinancials")[0].netRevenuePaise, null);
  assert.equal(f.values("consultationEmailEvents").length, 0);
});

test("webhook signature, replay and out-of-order failure/refund handling never duplicate or regress payment", async () => {
  const f = consultationPaymentFixture(); const checkout = (await (await prepare(f)).json()).checkout;
  const payment = f.capture(checkout);
  const route = f.load("app/api/payments/razorpay/webhook/route.ts");
  // The handler's Firebase Admin factory is deliberately provided by a local override below.
  const local = f.load("services/payments/consultationPaymentsAdmin.ts");
  const event = { id: "event-1", digest: "digest-1", type: "payment.captured" };
  await local.reconcileConsultationPayment(f.firestore, checkout.intentId, payment.id, event);
  await local.reconcileConsultationPayment(f.firestore, checkout.intentId, payment.id, event);
  assert.equal(f.values("razorpayWebhookEvents").length, 1); assert.equal(f.values("consultationBookings").length, 1);
  await assert.rejects(local.reconcileConsultationPayment(f.firestore, checkout.intentId, payment.id, { ...event, digest: "different" }));
  f.capture(checkout, { amount_refunded: 400, fee: null });
  await local.reconcileConsultationPayment(f.firestore, checkout.intentId, payment.id, { id: "refund-1", digest: "refund", type: "refund.processed" });
  const financial = f.values("consultationFinancials")[0]; assert.equal(financial.refundedPaise, 400); assert.equal(financial.settlementHold, true); assert.equal(financial.netRevenuePaise, null);
  f.capture(checkout, { amount_refunded: 0 });
  await local.reconcileConsultationPayment(f.firestore, checkout.intentId, payment.id, { id: "late-1", digest: "late", type: "payment.captured" });
  assert.equal(f.values("consultationFinancials")[0].refundedPaise, 400);
  assert.equal((await route.POST(paymentRequest({ entity: "event", event: "payment.captured" }, "POST", { "x-razorpay-signature": "forged", "x-razorpay-event-id": "forged-event" }))).status, 400);
});

test("unknown gateway fees remain unknown; total collection is never treated as platform revenue", () => {
  const { consultationFinancialTotals } = loadTypeScript("features/payments/consultationFinance.ts");
  assert.deepEqual(consultationFinancialTotals({ grossPaise: 11000, commissionPaise: 1000, consultantPayablePaise: 10000, gatewayFeePaise: null, refundedPaise: 0 }), { netRevenuePaise: null, netSettlementPaise: null });
  assert.throws(() => consultationFinancialTotals({ grossPaise: 100, commissionPaise: 100, consultantPayablePaise: 100, gatewayFeePaise: 0, refundedPaise: 0 }));
  const rules = readFileSync("firestore.rules", "utf8");
  for (const name of ["consultationFinancials", "consultationPaymentIntents", "consultationPaymentReceipts", "razorpayWebhookEvents"]) assert.match(rules, new RegExp(`match /${name}/\\{id\\} \\{ allow read, write: if false; \\}`));
});

test("full webhook route accepts only signed supported events and deduplicates after committed capture", async () => {
  const f = consultationPaymentFixture(); const checkout = (await (await prepare(f)).json()).checkout;
  const payment = f.capture(checkout); const route = f.load("app/api/payments/razorpay/webhook/route.ts");
  const body = { entity: "event", event: "payment.captured", payload: { payment: { entity: payment } } };
  const send = () => route.POST(paymentRequest(body, "POST", { "x-razorpay-signature": "synthetic-valid-webhook", "x-razorpay-event-id": "event-valid-1" }));
  assert.equal((await send()).status, 200); assert.equal((await send()).status, 200);
  assert.equal(f.values("consultationFinancials").length, 1); assert.equal(f.values("consultationBookings").length, 1);
  assert.equal(f.values("razorpayWebhookEvents").length, 1);
});

test("manual settlements are Admin-only, audited, reference/date-required and retry-safe; cancellation blocks payout", async () => {
  const f = consultationPaymentFixture(); const checkout = (await (await prepare(f)).json()).checkout;
  f.capture(checkout); await verify(f, checkout.intentId);
  const route = f.load("app/api/admin/consultant-finance/route.ts");
  let financial = f.records.get(`consultationFinancials/${checkout.intentId}`);
  const values = { id: checkout.intentId, expectedAuditId: financial.lastAuditId, status: "paid", reference: "BANK-UTR-123", date: "2026-01-01", notes: "External bank transfer" };
  assert.equal((await route.PATCH(paymentRequest(values, "PATCH"))).status, 403);
  f.actor.role = "admin"; f.actor.uid = "admin";
  assert.equal((await route.PATCH(paymentRequest({ ...values, commissionPaise: 0 }, "PATCH"))).status, 400);
  assert.equal((await route.PATCH(paymentRequest({ ...values, reference: "" }, "PATCH"))).status, 400);
  assert.equal((await route.PATCH(paymentRequest({ ...values, date: "2099-01-01" }, "PATCH"))).status, 400);
  assert.equal((await route.PATCH(paymentRequest(values, "PATCH"))).status, 200);
  const audits = f.values("auditLogs").length;
  assert.equal((await route.PATCH(paymentRequest(values, "PATCH"))).status, 200);
  assert.equal(f.values("auditLogs").length, audits);
  financial = f.records.get(`consultationFinancials/${checkout.intentId}`);
  assert.equal(financial.settlementStatus, "paid"); assert.equal(financial.consultantPayablePaise, 90050);
  assert.equal(financial.settlementReference, "BANK-UTR-123");
  f.capture(checkout, { fee: 300 });
  await f.load("services/payments/consultationPaymentsAdmin.ts").reconcileConsultationPayment(f.firestore, checkout.intentId, "pay_Synthetic");
  const revised = f.records.get(`consultationFinancials/${checkout.intentId}`);
  assert.equal(revised.settlementRecordedBy, "admin");
  assert.ok(revised.settlementRecordedAt);
  assert.equal(revised.settlementStatus, "paid");
  assert.equal(revised.settlementReference, "BANK-UTR-123");
  const f2 = consultationPaymentFixture(); const second = (await (await prepare(f2)).json()).checkout;
  f2.capture(second); await verify(f2, second.intentId);
  const cancel = f2.load("app/api/consultations/[bookingId]/route.ts");
  assert.equal((await cancel.PATCH(paymentRequest({ action: "cancelled" }, "PATCH"), { params: Promise.resolve({ bookingId: second.intentId }) })).status, 200);
  assert.equal(f2.records.get(`consultationFinancials/${second.intentId}`).settlementHold, true);
  assert.equal(f2.records.get(`consultationFinancials/${second.intentId}`).netRevenuePaise, null);
});

test("lost checkout callbacks recover from the owned order, never a consumer payment claim", async () => {
  const f = consultationPaymentFixture(); const checkout = (await (await prepare(f)).json()).checkout;
  const route = f.load("app/api/consumer/consultation-payments/[intentId]/route.ts");
  const context = { params: Promise.resolve({ intentId: checkout.intentId }) };
  const check = () => route.POST(paymentRequest({ action: "check" }), context);
  assert.equal((await (await check()).json()).checkout.bookingId, null);
  f.capture(checkout);
  assert.equal((await (await check()).json()).checkout.bookingId, checkout.intentId);
  assert.equal((await (await check()).json()).checkout.bookingId, checkout.intentId);
  assert.equal(f.values("consultationBookings").length, 1);
  f.actor.uid = "another-consumer";
  assert.equal((await check()).status, 404);
});

test("Finance listing is Admin-only, mode-isolated, bounded and accurately aggregated", async () => {
  const f = consultationPaymentFixture(); const checkout = (await (await prepare(f)).json()).checkout;
  f.capture(checkout); await verify(f, checkout.intentId);
  const route = f.load("app/api/admin/consultant-finance/route.ts");
  assert.equal((await route.GET(new Request("https://test.local/api/admin/consultant-finance?mode=test"))).status, 403);
  f.actor.role = "admin";
  const list = async (query) => route.GET(new Request(`https://test.local/api/admin/consultant-finance?${query}`));
  assert.equal((await list("mode=invalid")).status, 400);
  assert.equal((await list("mode=test&cursor=bad")).status, 400);
  const result = await (await list("mode=test")).json();
  assert.equal(result.summary.grossPaise, 99055); assert.equal(result.summary.commissionPaise, 9005);
  assert.equal(result.summary.pendingPayablePaise, 90050); assert.equal(result.summary.gatewayFeePaise, 234);
  assert.equal(result.documents.length, 1); assert.equal(result.hasMore, false);
  assert.equal(result.documents[0].consumerEmail, undefined); assert.equal(result.documents[0].draft, undefined);
  assert.equal((await (await list("mode=live")).json()).documents.length, 0);
  const original = f.records.get(`consultationFinancials/${checkout.intentId}`);
  for (let i = 1; i <= 22; i++) f.records.set(`consultationFinancials/consultation-${i.toString(16).padStart(64, "0")}`, { ...original });
  const first = await (await list("mode=test")).json();
  assert.equal(first.documents.length, 20); assert.equal(first.hasMore, true);
  const next = await (await list(`mode=test&cursor=${first.cursor}`)).json();
  assert.equal(next.documents.length, 3); assert.equal(next.hasMore, false);
  assert.equal(next.summary.count, 23);
});
