import { test } from "node:test";
import assert from "node:assert/strict";
import { consultationPaymentFixture, paidInput, prepare, verify, paymentRequest } from "../helpers/consultationPaymentFixture.mjs";

const start = async f => (await (await prepare(f)).json()).checkout;
const ignore = (f, id, extra = {}) => f.load("app/api/consumer/consultation-payments/[intentId]/route.ts").POST(paymentRequest({ action: "abandon", ...extra }), { params: Promise.resolve({ intentId: id }) });

test("ignore verifies the unattempted order, atomically releases its hold, audits once and allows a fresh booking attempt", async () => {
  const f = consultationPaymentFixture(), checkout = await start(f);
  const response = await ignore(f, checkout.intentId);
  assert.equal(response.status, 200, await response.clone().text());
  const safe = (await response.json()).checkout;
  assert.equal(safe.state, "abandoned"); assert.equal(safe.bookingId, null); assert.equal(safe.orderId, undefined);
  assert.doesNotMatch(JSON.stringify(safe), /commission|payable|gateway|settlement|abandonedAt/);
  assert.equal(f.values("consultationBookings").length, 0);
  assert.equal(f.records.get("consultationSlotDays/AS001_2099-10-25").entries["09:30"].state, "released");
  const intent = f.records.get(`consultationPaymentIntents/${checkout.intentId}`);
  assert.ok(intent.abandonedAt.toMillis());
  assert.equal(f.values("auditLogs").find(a => a.recordId === checkout.intentId && a.updatedValues.state === "abandoned").actorId, "patient");
  const audits = f.values("auditLogs").length;
  assert.equal((await ignore(f, checkout.intentId)).status, 200);
  assert.equal(f.values("auditLogs").length, audits);
  assert.equal((await prepare(f)).status, 200); // Stable old ID stays abandoned, never creates another order.
  assert.equal(f.paymentState.orderCalls, 1);
  const next = await prepare(f, { ...paidInput, requestId: "fresh-checkout-attempt-001" });
  assert.equal(next.status, 200); assert.equal(f.paymentState.orderCalls, 2);
});

test("created, authorized, failed and captured attempts cannot be ignored as empty checkouts", async () => {
  for (const status of ["created", "authorized", "failed", "captured"]) {
    const f = consultationPaymentFixture(), c = await start(f);
    f.capture(c, { captured: false, status });
    f.paymentState.orders.get(c.orderId).status = "attempted";
    assert.equal((await ignore(f, c.intentId)).status, 409);
    assert.equal(f.records.get(`consultationPaymentIntents/${c.intentId}`).state, "ready");
    assert.equal(f.records.get("consultationSlotDays/AS001_2099-10-25").entries["09:30"].state, "held");
  }
});

test("a paid checkout is reconciled to its booking, never discarded, and late captures of abandoned orders require review", async () => {
  const f = consultationPaymentFixture(), c = await start(f);
  f.capture(c);
  const paid = await ignore(f, c.intentId);
  assert.equal(paid.status, 200); assert.equal((await paid.json()).checkout.bookingId, c.intentId);
  assert.equal(f.records.get(`consultationPaymentIntents/${c.intentId}`).state, "confirmed");
  const late = consultationPaymentFixture(), old = await start(late);
  assert.equal((await ignore(late, old.intentId)).status, 200);
  const next = (await (await prepare(late, { ...paidInput, requestId: "fresh-checkout-attempt-002" })).json()).checkout;
  late.capture(old);
  assert.equal((await verify(late, old.intentId)).status, 200);
  assert.equal(late.values("consultationBookings").length, 0);
  assert.equal(late.records.get(`consultationFinancials/${old.intentId}`).settlementHold, true);
  assert.equal(late.records.get(`consultationPaymentIntents/${old.intentId}`).state, "paid_review");
  assert.equal(late.records.get("consultationSlotDays/AS001_2099-10-25").entries["09:30"].ownerId, next.intentId);
  assert.equal(late.values("consultationEmailEvents").length, 0);
});

test("ignore is own-Consumer only, validates action, rejects mismatches, uncertain setup, provider failures and mode changes", async () => {
  const f = consultationPaymentFixture(), c = await start(f);
  f.actor.uid = "another-consumer"; assert.equal((await ignore(f, c.intentId)).status, 404);
  f.actor.uid = "patient";
  for (const role of ["admin", "hospital"]) { f.actor.role = role; assert.equal((await ignore(f, c.intentId)).status, 403); }
  f.actor.role = "consumer";
  assert.equal((await ignore(f, c.intentId, { force: true })).status, 400);
  const intent = f.records.get(`consultationPaymentIntents/${c.intentId}`);
  intent.state = "order_unknown"; assert.equal((await ignore(f, c.intentId)).status, 409);
  intent.state = "ready"; intent.mode = "live"; assert.equal((await ignore(f, c.intentId)).status, 503);
  intent.mode = "test";
  f.paymentState.orders.get(c.orderId).receipt = "another-receipt";
  assert.equal((await ignore(f, c.intentId)).status, 409);
  f.paymentState.orders.delete(c.orderId);
  assert.equal((await ignore(f, c.intentId)).status, 503);
  assert.equal(intent.state, "ready");
});

test("failed and lost-response ignore commits retain consistency and retries never create duplicate audits", async () => {
  const original = consultationPaymentFixture(), c = await start(original);
  const failed = consultationPaymentFixture({ failCommit: true, records: Object.fromEntries(original.records), paymentState: original.paymentState });
  assert.equal((await ignore(failed, c.intentId)).status, 503);
  assert.equal(failed.records.get(`consultationPaymentIntents/${c.intentId}`).state, "ready");
  assert.equal(failed.records.get("consultationSlotDays/AS001_2099-10-25").entries["09:30"].state, "held");
  const lost = consultationPaymentFixture({ throwAfterCommit: true, deferInitialThrowUntilBooking: false, records: Object.fromEntries(original.records), paymentState: original.paymentState });
  assert.equal((await ignore(lost, c.intentId)).status, 503);
  assert.equal(lost.records.get(`consultationPaymentIntents/${c.intentId}`).state, "abandoned");
  const audits = lost.values("auditLogs").length;
  assert.equal((await ignore(lost, c.intentId)).status, 200);
  assert.equal(lost.values("auditLogs").length, audits);
});

test("simultaneous ignores record one abandonment and cannot discard a financial review hold", async () => {
  const f = consultationPaymentFixture(), c = await start(f);
  const responses = await Promise.all([ignore(f, c.intentId), ignore(f, c.intentId)]);
  assert.ok(responses.every(response => response.status === 200));
  assert.equal(f.values("auditLogs").filter(a => a.recordId === c.intentId && a.updatedValues.state === "abandoned").length, 1);
  const intent = f.records.get(`consultationPaymentIntents/${c.intentId}`);
  intent.state = "paid_review";
  const review = await ignore(f, c.intentId);
  assert.equal((await review.json()).checkout.state, "paid_review");
  assert.equal(intent.state, "paid_review");
});
