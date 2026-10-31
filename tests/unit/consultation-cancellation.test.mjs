import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { consultationPaymentFixture, prepare, verify, paymentRequest, paidInput } from "../helpers/consultationPaymentFixture.mjs";

const helpers = loadTypeScript("features/consultations/cancellationPolicy.ts");
const { DEFAULT_CONSULTATION_CANCELLATION_POLICY: policy, parseConsultationCancellationPolicy: parse, snapshotConsultationCancellation: snapshot,
  consultationCancellationEligibility: eligibility, validCancellationSnapshot: valid } = helpers;
const paid = { paidPaise: 99055, refundedPaise: 0 };

test("Consumer cancellation table renders the agreed policy values, deadlines and conditions without substituting defaults", () => {
  const { ConsultationCancellationInfo } = loadTypeScript("components/consultations/ConsultationCancellationInfo.tsx", {
    "next/link": { __esModule: true, default: ({ href, children }) => createElement("a", { href }, children) },
  });
  const configured = { ...policy, refundWindowHours: 72, refundValue: 75, lateRefundValue: 10, conditions: "Agreed special conditions" };
  const terms = snapshot(configured, "2099-10-25", "09:30");
  const html = renderToStaticMarkup(createElement(ConsultationCancellationInfo, { snapshot: terms, status: "confirmed", totals: paid, now: Date.parse("2099-10-20T00:00:00Z") }));
  assert.match(html, /<table/);
  assert.equal((html.match(/scope="col"/g) ?? []).length, 3);
  for (const value of ["72 hours", "75% of the amount paid", "10% of the amount paid", "Agreed special conditions", "Cancellation does not issue a refund automatically", "IST"]) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /100% of the amount paid/);
});
const context = id => ({ params: Promise.resolve({ bookingId: id }) });
async function booked(f) { const checkout = (await (await prepare(f)).json()).checkout; f.capture(checkout); await verify(f, checkout.intentId); return checkout.intentId; }

test("India reference dates and exact 48-hour boundary are timezone-safe and inclusive for refunds", () => {
  const s = snapshot(policy, "2026-11-05", "09:00");
  assert.equal(s.appointmentAt, "2026-11-05T03:30:00.000Z");
  assert.equal(s.refundDeadlineAt, "2026-11-03T03:30:00.000Z");
  assert.equal(s.reference, "window_start"); assert.equal(valid(s), true);
  const at = Date.parse(s.refundDeadlineAt);
  assert.equal(eligibility(s, "confirmed", paid, at).eligibleRefundPaise, 99055);
  assert.equal(eligibility(s, "confirmed", paid, at + 1).eligibleRefundPaise, 0);
  assert.equal(eligibility(s, "confirmed", paid, at + 1).allowed, true);
  assert.equal(eligibility(s, "confirmed", paid, Date.parse(s.appointmentAt)).allowed, false);
  assert.equal(eligibility(s, "completed", paid, at).allowed, false);
  assert.equal(eligibility({ ...s, refundDeadlineAt: s.appointmentAt }, "confirmed", paid, at).allowed, false);
  assert.throws(() => snapshot(policy, "2026-02-30", "09:00"));
  assert.throws(() => snapshot(policy, "2026-11-05", "24:00"));
});

test("fixed/percentage refunds cap verified money, subtract earlier refunds and keep missing payments unknown", () => {
  const s = snapshot({ ...policy, allowAfterCutoff: false, refundType: "fixed", refundValue: 10000 }, "2026-11-05", "09:00");
  const before = Date.parse(s.refundDeadlineAt);
  assert.equal(eligibility(s, "confirmed", { ...paid, refundedPaise: 10000 }, before).remainingRefundPaise, 89055);
  assert.equal(eligibility(s, "confirmed", paid, before + 1).allowed, false);
  assert.equal(eligibility(s, "confirmed", null, before).remainingRefundPaise, null);
  assert.equal(eligibility(s, "confirmed", { paidPaise: 0, refundedPaise: 0 }, before).remainingRefundPaise, 0);
  assert.equal(eligibility(s, "confirmed", { ...paid, refundedPaise: 999999 }, before).remainingRefundPaise, null);
  const percentage = snapshot({ ...policy, refundValue: 50 }, "2026-11-05", "09:00");
  assert.equal(eligibility(percentage, "confirmed", paid, before).eligibleRefundPaise, 49528);
  for (const bad of [{ refundValue: 101 }, { refundType: ["percentage"] }, { lateRefundValue: -1 }, { refundWindowHours: Infinity }, { cancellationCutoffHours: 1.5 }, { conditions: "x".repeat(1001) }]) assert.equal(parse({ ...policy, ...bad }), null);
});

test("policy APIs require matching roles, validate inputs and save revision-checked atomic audits", async () => {
  const f = consultationPaymentFixture(); const admin = f.load("app/api/admin/consultation-cancellation-policy/route.ts");
  const consumer = f.load("app/api/consumer/consultation-cancellation-policy/route.ts");
  assert.equal((await admin.GET(paymentRequest(null, "GET"))).status, 403);
  assert.equal((await consumer.GET(paymentRequest(null, "GET"))).status, 200);
  f.actor.role = "hospital";
  assert.equal((await consumer.GET(paymentRequest(null, "GET"))).status, 403);
  f.actor.role = "admin"; f.actor.uid = "admin";
  assert.equal((await admin.PATCH(paymentRequest({ policy: { ...policy, refundValue: 101 }, expectedVersion: policy.version }, "PATCH"))).status, 400);
  assert.equal((await admin.PATCH(paymentRequest({ policy, expectedVersion: "stale" }, "PATCH"))).status, 409);
  const saved = await (await admin.PATCH(paymentRequest({ policy: { ...policy, refundWindowHours: 72 }, expectedVersion: policy.version }, "PATCH"))).json();
  assert.equal(saved.policy.refundWindowHours, 72); assert.notEqual(saved.policy.version, policy.version);
  assert.ok(f.records.get(`auditLogs/${saved.policy.version}`));
  assert.equal(f.records.get("cancellationPolicies/consultation").lastAuditId, saved.policy.version);
  assert.equal((await admin.PATCH(paymentRequest({ policy, expectedVersion: policy.version }, "PATCH"))).status, 409);
  const failed = consultationPaymentFixture({ actor: { role: "admin" }, failCommit: true });
  assert.equal((await failed.load("app/api/admin/consultation-cancellation-policy/route.ts").PATCH(paymentRequest({ policy: { ...policy, refundWindowHours: 72 }, expectedVersion: policy.version }, "PATCH"))).status, 503);
  assert.equal(failed.values("cancellationPolicies").length, 0); assert.equal(failed.values("auditLogs").length, 0);
});

test("payment terms are reviewed before order creation and remain frozen across configuration changes and capture", async () => {
  const f = consultationPaymentFixture();
  assert.equal((await prepare(f, { ...paidInput, expectedCancellationPolicyVersion: "old" })).status, 409);
  assert.equal(f.paymentState.orderCalls, 0);
  const checkout = (await (await prepare(f)).json()).checkout;
  assert.equal(checkout.cancellationPolicy.policy.version, policy.version);
  f.records.set("cancellationPolicies/consultation", { policy: { ...policy, version: "future-policy", refundValue: 50 } });
  f.capture(checkout); await verify(f, checkout.intentId);
  const booking = f.records.get(`consultationBookings/${checkout.intentId}`);
  assert.equal(booking.cancellationPolicy.policy.refundValue, 100);
  assert.deepEqual(booking.paymentTotals, paid);
  assert.equal((await prepare(f)).status, 200);
  assert.equal((await prepare(f, { ...paidInput, requestId: "new-payment-attempt-002" })).status, 409);
});

test("consumer cancellation revalidates cutoff in transaction and audits a verified refund quote once", async () => {
  const f = consultationPaymentFixture(); const id = await booked(f);
  const route = f.load("app/api/consultations/[bookingId]/route.ts");
  f.actor.uid = "another-consumer";
  assert.equal((await route.PATCH(paymentRequest({ action: "cancelled" }, "PATCH"), context(id))).status, 403);
  f.actor.uid = "patient";
  const booking = f.records.get(`consultationBookings/${id}`);
  booking.cancellationPolicy = snapshot({ ...policy, allowAfterCutoff: false }, "2000-01-01", "09:00");
  assert.equal((await route.PATCH(paymentRequest({ action: "cancelled", eligibleRefundPaise: 999999 }, "PATCH"), context(id))).status, 409);
  assert.equal(booking.status, "confirmed");
  booking.cancellationPolicy = snapshot(policy, "2099-10-25", "09:30");
  const financial = f.records.get(`consultationFinancials/${id}`); financial.refundedPaise = 10000;
  assert.equal((await route.PATCH(paymentRequest({ action: "cancelled" }, "PATCH"), context(id))).status, 200);
  const saved = f.records.get(`consultationBookings/${id}`);
  assert.equal(saved.cancellationOutcome.eligibleRefundPaise, 99055); assert.equal(saved.cancellationOutcome.remainingRefundPaise, 89055);
  assert.equal(saved.cancellationOutcome.policyVersion, policy.version); assert.equal(financial.settlementStatus, "pending");
  assert.equal(f.records.get(`consultationFinancials/${id}`).settlementHold, true);
  const count = f.values("auditLogs").length;
  assert.equal((await route.PATCH(paymentRequest({ action: "cancelled" }, "PATCH"), context(id))).status, 200);
  assert.equal(f.values("auditLogs").length, count);
});

test("reschedule retains agreed policy version, recomputes exact IST deadline, and legacy bookings are not assigned today's terms", async () => {
  const f = consultationPaymentFixture(); const id = await booked(f);
  f.actor.role = "admin"; f.actor.uid = "admin";
  const route = f.load("app/api/consultations/[bookingId]/route.ts");
  const response = await route.PATCH(paymentRequest({ action: "reschedule", requestId: "reschedule-policy-0001", confirmedDate: "2099-10-26", confirmedTime: "10:00" }, "PATCH"), context(id));
  assert.equal(response.status, 200);
  const updated = f.records.get(`consultationBookings/${id}`);
  assert.equal(updated.cancellationPolicy.policy.version, policy.version);
  assert.equal(updated.cancellationPolicy.reference, "exact_time");
  assert.equal(updated.cancellationPolicy.refundDeadlineAt, "2099-10-24T04:30:00.000Z");
  delete updated.cancellationPolicy; delete updated.paymentIntentId;
  f.actor.role = "consumer"; f.actor.uid = "patient";
  assert.equal((await route.PATCH(paymentRequest({ action: "cancelled" }, "PATCH"), context(id))).status, 200);
  const legacy = f.records.get(`consultationBookings/${id}`);
  assert.equal(legacy.cancellationPolicy, undefined); assert.equal(legacy.cancellationOutcome.remainingRefundPaise, null);
  assert.equal(legacy.cancellationOutcome.policyVersion, null);
  assert.match(readFileSync("firestore.rules", "utf8"), /match \/cancellationPolicies\/\{id\} \{ allow read, write: if false; \}/);
});

test("pre-feature payment retries retain their original hash, terms and pending email revision", async () => {
  const f = consultationPaymentFixture(); const checkout = (await (await prepare(f)).json()).checkout;
  const intent = f.records.get(`consultationPaymentIntents/${checkout.intentId}`);
  delete intent.draft.cancellationPolicy;
  intent.inputHash = createHash("sha256").update(JSON.stringify([paidInput.serviceId, paidInput.consultantId, paidInput.preferredDate,
    paidInput.preferredTimeSlot, paidInput.expectedCharge, paidInput.consumerNotes, paidInput.expectedSlotStartTime, paidInput.expectedSlotEndTime])).digest("hex");
  assert.equal((await prepare(f)).status, 200); assert.equal(f.paymentState.orderCalls, 1);
  f.capture(checkout); await verify(f, checkout.intentId);
  const booking = f.records.get(`consultationBookings/${checkout.intentId}`);
  assert.equal(booking.cancellationPolicy, undefined);
  delete booking.paymentTotals;
  const revision = booking.lastAuditId;
  await verify(f, checkout.intentId);
  assert.equal(f.records.get(`consultationBookings/${checkout.intentId}`).lastAuditId, revision);
});
