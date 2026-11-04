import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { consultationPaymentFixture, prepare, verify, paymentRequest } from "../helpers/consultationPaymentFixture.mjs";

async function fixture(options = {}) {
  const f = consultationPaymentFixture(options);
  const refunds = new Map(); const calls = [];
  const state = { status: "pending", throwAfterCreate: false, reject: false };
  f.provider.listRazorpayRefunds = async id => [...refunds.values()].filter(r => r.payment_id === id);
  f.provider.fetchRazorpayRefund = async (_paymentId, id) => { if (!refunds.has(id)) throw Error("Missing refund"); return { ...refunds.get(id) }; };
  f.provider.createRazorpayRefund = async (paymentId, amount, receipt) => {
    calls.push({ paymentId, amount, receipt });
    const prior = [...refunds.values()].find(r => r.receipt === receipt);
    if (prior) return { ...prior };
    if (state.reject) throw new f.provider.RazorpayError("API", "Rejected", false, 400);
    const result = { id: `rfnd_Synthetic${refunds.size + 1}`, payment_id: paymentId, amount, receipt, currency: "INR", status: state.status, bankReference: null };
    refunds.set(result.id, result);
    if (state.status === "processed") {
      const payment = f.paymentState.payments.get(paymentId);
      payment.amount_refunded += amount;
      payment.status = payment.amount_refunded === payment.amount ? "refunded" : "captured";
    }
    if (state.throwAfterCreate) throw new f.provider.RazorpayError("NETWORK", "Unknown", true);
    return { ...result };
  };
  const checkout = (await (await prepare(f)).json()).checkout;
  f.capture(checkout); assert.equal((await verify(f, checkout.intentId)).status, 200); await f.flushAfter();
  f.actor.role = "admin"; f.actor.uid = "admin";
  const id = checkout.intentId;
  const booking = () => f.records.get(`consultationBookings/${id}`);
  const financial = () => f.records.get(`consultationFinancials/${id}`);
  const cancel = () => f.load("app/api/consultations/[bookingId]/route.ts").PATCH(paymentRequest({ action: "cancelled", requestId: "refund-cancellation-action", expectedAuditId: booking().lastAuditId,
    cancellationReason: "Customer requested cancellation" }, "PATCH"), { params: Promise.resolve({ bookingId: id }) });
  const route = () => f.load("app/api/admin/consultation-refunds/route.ts");
  const input = () => ({ action: "refund", bookingId: id, requestId: "admin-refund-request-001", expectedAuditId: booking().lastAuditId,
    reason: "Customer refund approved", amountPaise: financial().grossPaise, exceptionApproved: false });
  const send = body => route().POST(paymentRequest(body));
  return { ...f, id, booking, financial, refunds, refundCalls: calls, refundState: state, cancel, route, input, send };
}

test("Admin refunds use a private durable claim, preserve actual fees and commission, and project only safe booking details", async () => {
  const f = await fixture(); await f.cancel(); const input = f.input();
  const response = await f.send(input); assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.changes.refundSummary.status, "initiated");
  assert.equal(f.booking().status, "cancelled"); assert.equal(f.financial().settlementHold, true);
  assert.equal(f.financial().grossPaise, 99055); assert.equal(f.financial().commissionPaise, 9005);
  assert.equal(f.financial().consultantPayablePaise, 90050); assert.equal(f.financial().gatewayFeePaise, 234);
  assert.equal(f.financial().gatewayTaxPaise, 36); assert.equal(f.financial().netSettlementPaise, 99055 - 234);
  assert.equal(f.financial().netRevenuePaise, null);
  const journal = f.values("consultationRefunds")[0];
  assert.equal(journal.amountPaise, 99055); assert.equal(journal.createdBy, "admin"); assert.equal(journal.cancelledByRole, "admin");
  assert.equal(journal.reason, input.reason); assert.equal(journal.bookingId, f.id);
  assert.ok(journal.cancelledAt); assert.ok(journal.lastAuditId);
  assert.equal(f.refundCalls.length, 1);
  for (const key of ["commissionPaise", "gatewayFeePaise", "gatewayTaxPaise", "consultantPayablePaise", "refundPendingId", "payloadHash"]) assert.ok(!JSON.stringify(result).includes(key));
  await f.flushAfter();
  const customer = f.calls.smtp.at(-1); assert.match(customer.text, /Refund initiated/); assert.match(customer.text, /rfnd_Synthetic1/);
  assert.doesNotMatch(customer.text, /commission|9005|gateway/i);
});

test("duplicate and simultaneous refund requests never issue another refund or duplicate saved events", async () => {
  const f = await fixture(); await f.cancel(); const input = f.input();
  const responses = await Promise.all([f.send(input), f.send(input), f.send({ ...input, requestId: "different-refund-attempt" })]);
  assert.equal(responses[0].status, 200); assert.equal(responses[1].status, 200); assert.equal(responses[2].status, 409);
  assert.equal(f.values("consultationRefunds").length, 1); assert.equal(f.refunds.size, 1);
  const events = f.values("consultationEmailEvents").length;
  assert.equal((await f.send(input)).status, 200);
  assert.equal(f.values("consultationEmailEvents").length, events);
  assert.equal((await f.send({ ...input, amountPaise: input.amountPaise - 1 })).status, 409);
});

test("unknown provider outcomes keep the lock; explicit recovery finds the same receipt and never duplicates money", async () => {
  const f = await fixture(); await f.cancel(); f.refundState.throwAfterCreate = true;
  assert.equal((await f.send(f.input())).status, 200);
  assert.equal(f.booking().refundSummary.status, "unknown"); assert.ok(f.financial().refundPendingId);
  assert.equal((await f.send({ action: "check", bookingId: f.id })).status, 200);
  assert.equal(f.booking().refundSummary.status, "initiated"); assert.equal(f.refundCalls.length, 1);
  assert.equal(f.refunds.size, 1);
});

test("processed refund updates the same booking and ledger without erasing fees, historical commission or payout snapshots", async () => {
  const f = await fixture(); await f.cancel(); f.refundState.status = "processed";
  assert.equal((await f.send(f.input())).status, 200);
  assert.equal(f.booking().refundSummary.status, "refunded"); assert.equal(f.booking().paymentStatus, "refunded");
  assert.equal(f.financial().refundedPaise, 99055); assert.equal(f.financial().netSettlementPaise, -234);
  assert.equal(f.financial().commissionPaise, 9005); assert.equal(f.financial().consultantPayablePaise, 90050);
  assert.equal(f.financial().refundPendingId, null); assert.equal(f.financial().settlementHold, true);
  assert.equal(f.financial().netRevenuePaise, null); assert.ok(f.booking().bookingReference.startsWith("AYUR"));
  await f.flushAfter(); assert.match(f.calls.smtp.at(-1).text, /processed by Razorpay/);
});

test("pending refunds only become refunded after verified processing; forged/mismatched references cannot update state", async () => {
  const f = await fixture(); await f.cancel(); await f.send(f.input());
  const refund = f.refunds.get("rfnd_Synthetic1");
  const core = f.load("services/payments/consultationRefundsAdmin.ts");
  await assert.rejects(core.reconcileConsultationRefund(f.firestore, { ...refund, amount: 1 }));
  await assert.rejects(core.reconcileConsultationRefund(f.firestore, { ...refund, payment_id: "pay_Other" }));
  assert.equal(f.booking().refundSummary.status, "initiated");
  refund.status = "processed"; refund.bankReference = "BANK123";
  const payment = f.paymentState.payments.get(refund.payment_id); payment.amount_refunded = refund.amount; payment.status = "refunded";
  await core.reconcileConsultationRefund(f.firestore, refund);
  assert.equal(f.booking().refundSummary.status, "refunded"); assert.equal(f.booking().refundSummary.bankReference, "BANK123");
  const count = f.calls.commits;
  await core.reconcileConsultationRefund(f.firestore, { ...refund, status: "pending" });
  assert.equal(f.calls.commits, count + 1); // An empty idempotent transaction only.
  assert.equal(f.booking().refundSummary.status, "refunded");
});

test("inside-24h and above-policy refunds require an explicit Admin exception without changing agreed terms", async () => {
  const f = await fixture();
  // Use a valid policy whose reference appointment is already within the window.
  const now = Date.now();
  const p = f.booking().cancellationPolicy; const start = new Date(now + 2 * 3600000).toISOString();
  p.appointmentAt = start;
  p.refundDeadlineAt = new Date(Date.parse(start) - p.policy.refundWindowHours * 3600000).toISOString();
  p.cancellationCutoffAt = new Date(Date.parse(start) - p.policy.cancellationCutoffHours * 3600000).toISOString();
  p.lastCancellationAt = p.policy.allowAfterCutoff ? start : p.cancellationCutoffAt;
  // Missing/invalid historical snapshots must also demand explicit exception approval.
  await f.cancel(); const original = structuredClone(f.booking().cancellationPolicy);
  const input = f.input(); assert.equal((await f.send(input)).status, 400);
  assert.equal(f.values("consultationRefunds").length, 0);
  assert.equal((await f.send({ ...input, exceptionApproved: true })).status, 200);
  assert.deepEqual(f.booking().cancellationPolicy, original);
});

test("invalid amounts/reasons, active appointments, other roles, wrong mode and recorded consultant transfers cannot move money", async () => {
  for (const role of ["consumer", "hospital"]) {
    const f = await fixture(); f.actor.role = role;
    assert.equal((await f.send(f.input())).status, 403);
    assert.equal((await f.route().GET(new Request(`https://test.local/api/admin/consultation-refunds?bookingId=${f.id}`))).status, 403);
    assert.equal(f.refundCalls.length, 0);
  }
  const f = await fixture(); const before = f.input();
  assert.equal((await f.send(before)).status, 409); await f.cancel();
  for (const changes of [{amountPaise:0},{amountPaise:1.5},{amountPaise:NaN},{amountPaise:99056},{reason:""},{reason:"a"},{reason:"x".repeat(501)},{exceptionApproved:"true"},{commissionPaise:0}]) {
    assert.ok((await f.send({ ...f.input(), ...changes })).status >= 400);
  }
  f.financial().settlementStatus = "paid"; f.financial().settlementReference = "BANK-TRANSFER";
  assert.equal((await f.send(f.input())).status, 409);
  f.financial().settlementStatus = "pending"; f.financial().settlementReference = null; f.paymentState.mode = "live";
  assert.equal((await f.send(f.input())).status, 409); assert.equal(f.refundCalls.length, 0);
});

test("partial refunds are capped to verified unrefunded money, excluding external pending and processed refunds", async () => {
  const f = await fixture(); await f.cancel();
  f.refunds.set("rfnd_External", { id:"rfnd_External",payment_id:"pay_Synthetic",amount:90000,currency:"INR",receipt:null,status:"pending",bankReference:null });
  assert.equal((await f.send({ ...f.input(), amountPaise: 10000 })).status, 400);
  f.refundState.status = "processed";
  assert.equal((await f.send({ ...f.input(), amountPaise: 9055 })).status, 200);
  assert.equal(f.financial().refundedPaise, 9055); assert.equal(f.booking().paymentStatus, "partially_refunded");
});

test("provider rejection records failure, preserves cancellation and permits a separately approved new attempt", async () => {
  const f = await fixture(); await f.cancel(); f.refundState.reject = true;
  assert.equal((await f.send(f.input())).status, 200);
  assert.equal(f.booking().status, "cancelled"); assert.equal(f.booking().refundSummary.status, "failed"); assert.equal(f.financial().refundPendingId, null);
  f.refundState.reject = false;
  assert.equal((await f.send({ ...f.input(), requestId: "retry-after-verified-failure" })).status, 200);
  assert.equal(f.refunds.size, 1); assert.equal(f.booking().refundSummary.status, "initiated");
});

test("an atomic claim failure cannot call Razorpay; journal rules deny every client and hospital flows remain separate", async () => {
  const f = await fixture(); await f.cancel();
  const old = f.firestore.runTransaction;
  f.firestore.runTransaction = async () => { throw Error("No commit"); };
  assert.equal((await f.send(f.input())).status, 503); assert.equal(f.refundCalls.length, 0); assert.equal(f.values("consultationRefunds").length, 0);
  f.firestore.runTransaction = old;
  const rules = readFileSync("firestore.rules", "utf8");
  assert.match(rules, /match \/consultationRefunds\/\{id\} \{ allow read, write: if false; \}/);
  const route = readFileSync("app/api/admin/consultation-refunds/route.ts", "utf8");
  assert.match(route, /requireActiveAdmin/); assert.doesNotMatch(route, /collection\("bookings"\)/);
});

test("a lost claim acknowledgement recovers with the original provider key and no second cancellation", async () => {
  const f = await fixture(); await f.cancel(); const input = f.input();
  const run = f.firestore.runTransaction;
  let lose = true;
  f.firestore.runTransaction = async cb => { const result = await run(cb); if (lose) { lose = false; throw Error("Lost reply"); } return result; };
  assert.equal((await f.send(input)).status, 503);
  assert.equal(f.refundCalls.length, 0); assert.equal(f.booking().refundSummary.status, "checking");
  assert.equal((await f.send(input)).status, 200);
  assert.equal(f.values("consultationRefunds").length, 1); assert.equal(f.refunds.size, 1);
  assert.equal(f.refundCalls[0].receipt, f.values("consultationRefunds")[0].id);
});

test("the exact 24-hour deadline is inclusive and an early consumer cancellation keeps its agreed eligibility", async () => {
  const f = await fixture(); await f.cancel();
  const deadline = Date.parse(f.booking().cancellationPolicy.refundDeadlineAt);
  f.booking().cancelledAt = Timestamp.fromMillis(deadline);
  f.booking().cancelledByRole = "consumer";
  const core = f.load("services/payments/consultationRefundsAdmin.ts");
  assert.equal((await core.consultationRefundQuote(f.firestore,f.id)).exceptionRequired,false);
  f.booking().cancelledAt = Timestamp.fromMillis(deadline + 1);
  assert.equal((await core.consultationRefundQuote(f.firestore,f.id)).exceptionRequired,true);
  f.booking().cancelledAt = Timestamp.fromMillis(deadline - 1);
  assert.equal((await core.consultationRefundQuote(f.firestore,f.id)).suggestedPaise,99055);
});

test("refund webhooks verify the individual provider record and safely replay after payment-journal commit", async () => {
  const f = await fixture(); await f.cancel(); await f.send(f.input());
  const refund = f.refunds.get("rfnd_Synthetic1"); refund.status = "processed";
  f.paymentState.payments.get(refund.payment_id).amount_refunded = refund.amount;
  f.paymentState.payments.get(refund.payment_id).status = "refunded";
  const route = f.load("app/api/payments/razorpay/webhook/route.ts");
  const body = { entity:"event",event:"refund.processed",payload:{refund:{entity:{id:refund.id,payment_id:refund.payment_id}}} };
  const request = () => paymentRequest(body,"POST",{"x-razorpay-signature":"synthetic-valid-webhook","x-razorpay-event-id":"refund-processed-001"});
  const payments = f.load("services/payments/consultationPaymentsAdmin.ts");
  await payments.reconcileConsultationPayment(f.firestore,f.id,refund.payment_id,{id:"refund-processed-001",digest:payments.hashPaymentValue(JSON.stringify(body)),type:"refund.processed"});
  const realFetch = f.provider.fetchRazorpayRefund;
  f.provider.fetchRazorpayRefund = async () => { throw Error("Unavailable after payment commit"); };
  assert.equal((await route.POST(request())).status,503);
  assert.equal(f.booking().refundSummary.status,"initiated");
  f.provider.fetchRazorpayRefund = realFetch;
  assert.equal((await route.POST(request())).status,200);
  assert.equal(f.booking().refundSummary.status,"refunded");
  assert.equal(f.financial().refundPendingId,null);
  const records = f.values("consultationEmailEvents").length;
  assert.equal((await route.POST(request())).status,200);
  assert.equal(f.values("consultationEmailEvents").length,records);
  assert.equal(f.refundCalls.length,1);
  await f.flushAfter();
  assert.match(f.calls.smtp.at(-1).text,/processed by Razorpay/);
});

test("a pending refund payment-total update retains a current refund email instead of superseding every notice", async () => {
  const f = await fixture(); await f.cancel(); await f.send(f.input());
  const refund = f.refunds.get("rfnd_Synthetic1");
  f.paymentState.payments.get(refund.payment_id).amount_refunded = refund.amount;
  const body = {entity:"event",event:"refund.created",payload:{refund:{entity:{id:refund.id,payment_id:refund.payment_id}}}};
  const response = await f.load("app/api/payments/razorpay/webhook/route.ts").POST(paymentRequest(body,"POST",{
    "x-razorpay-signature":"synthetic-valid-webhook","x-razorpay-event-id":"refund-pending-totals"}));
  assert.equal(response.status,200);
  await f.flushAfter();
  assert.match(f.calls.smtp.at(-1).subject,/refund update/);
  assert.match(f.calls.smtp.at(-1).text,/Refund initiated/);
  assert.equal(f.booking().refundSummary.status,"initiated");
  assert.equal(f.calls.smtp.filter(mail=>/refund update/.test(mail.subject)).length,1);
});

test("a verified processed refund remains financially recorded when the follow-up payment read is unavailable", async () => {
  const f = await fixture(); await f.cancel();
  const original = f.provider.createRazorpayRefund;
  f.refundState.status = "processed";
  f.provider.createRazorpayRefund = async (...args) => {
    const result = await original(...args);
    f.provider.fetchRazorpayPayment = async () => { throw Error("Temporary payment fetch failure"); };
    return result;
  };
  assert.equal((await f.send(f.input())).status,200);
  assert.equal(f.booking().refundSummary.status,"refunded");
  assert.equal(f.financial().refundedPaise,99055);
  assert.equal(f.financial().gatewayFeePaise,234); assert.equal(f.financial().gatewayTaxPaise,36);
  assert.equal(f.financial().commissionPaise,9005); assert.equal(f.financial().netRevenuePaise,null);
});
