import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { consultationPaymentFixture, prepare, verify, paymentRequest } from "../helpers/consultationPaymentFixture.mjs";

const reason = "Please change my time <not HTML>";
const path = id => `consultationBookings/${id}`;
async function seeded(role = "consumer") {
  const f = consultationPaymentFixture();
  const checkout = (await (await prepare(f)).json()).checkout;
  f.capture(checkout); assert.equal((await verify(f, checkout.intentId)).status, 200);
  await f.flushAfter();
  f.actor.role = role; f.actor.uid = role === "admin" ? "admin" : "patient";
  const id = checkout.intentId;
  const input = { action: "reschedule", requestId: "reschedule-reason-action-001", expectedAuditId: f.records.get(path(id)).lastAuditId,
    confirmedDate: "2099-10-26", confirmedTime: "10:00", rescheduleReason: reason };
  const send = values => f.load("app/api/consultations/[bookingId]/route.ts").PATCH(paymentRequest({ ...input, ...values }, "PATCH"), { params: Promise.resolve({ bookingId: id }) });
  return { f, id, input, send };
}

test("Admin and Consumer reschedules atomically snapshot the trusted actor/reason and email every recipient", async () => {
  for (const role of ["admin", "consumer"]) {
    const { f, id, send } = await seeded(role);
    const before = f.records.get(path(id));
    const response = await send({ rescheduledByRole: "hospital", rescheduledBy: "spoofed", rescheduledAt: "2000-01-01" });
    assert.equal(response.status, 200, await response.clone().text());
    const saved = f.records.get(path(id));
    assert.equal(saved.rescheduleReason, reason); assert.equal(saved.rescheduledByRole, role); assert.equal(saved.rescheduledBy, f.actor.uid);
    assert.ok(saved.rescheduledAt instanceof Timestamp);
    assert.equal(saved.paymentReference, before.paymentReference); assert.equal(saved.consultantCharge, before.consultantCharge);
    assert.equal(saved.cancellationPolicy.policy.version, before.cancellationPolicy.policy.version);
    const audit = f.records.get(`auditLogs/${saved.lastAuditId}`);
    assert.equal(audit.updatedValues.rescheduleReason, reason); assert.equal(audit.actorRole, role);
    const events = f.values("consultationEmailEvents").filter(event => event.event === "rescheduled");
    assert.equal(events.length, 3);
    assert.ok(events.every(event => event.payload.rescheduleReason === reason && event.payload.rescheduledByRole === role));
    assert.equal(f.calls.smtp.length, 1, "No reschedule email before after-work");
    await f.flushAfter();
    for (const messages of [f.calls.smtp, f.calls.consultantSmtp, f.calls.supportSmtp]) {
      const email = messages.at(-1);
      assert.match(email.text, new RegExp(`Rescheduled by: ${role === "admin" ? "Ayursarga team" : "Customer"}`));
      assert.match(email.text, /Rescheduling reason: Please change my time/);
      assert.match(email.text, /Original appointment date: 25\/10\/2099/);
      assert.match(email.text, /Updated appointment date: 26\/10\/2099/);
      assert.match(email.text, /Original appointment time: 9:30 AM – 10:00 AM IST/);
      assert.match(email.text, /Updated appointment time: 10:00 AM – 10:30 AM IST/);
      assert.match(email.text, /Rescheduled on: \d{2}\/\d{2}\/\d{4}/);
      assert.match(email.html, /&lt;not HTML&gt;/); assert.doesNotMatch(email.html, /<not HTML>/);
    }
    const auditCount = f.values("auditLogs").length, emailCount = f.calls.smtp.length;
    assert.equal((await send({})).status, 200); await f.flushAfter();
    assert.equal(f.calls.smtp.length, emailCount); assert.equal(f.values("auditLogs").length, auditCount);
    assert.equal((await send({ rescheduleReason: "Another reason" })).status, 409);
    assert.equal(f.records.get(path(id)).rescheduleReason, reason);
  }
});

test("missing/invalid reasons and general notes cannot move slots, consume allowance or enqueue emails", async () => {
  for (const role of ["admin", "consumer"]) {
    const { f, id, send } = await seeded(role);
    const commits = f.calls.commits, before = f.records.get(path(id));
    for (const invalid of [undefined, null, "", "  ", "ab", 42, {}, [], "x".repeat(501), "bad\u0000reason"]) {
      assert.equal((await send({ rescheduleReason: invalid, adminNotes: "These are general notes" })).status, 400);
      assert.equal(f.calls.commits, commits);
      assert.equal(f.records.get(path(id)), before);
      assert.equal(f.values("consultationEmailEvents").filter(e => e.event === "rescheduled").length, 0);
    }
    assert.equal(f.records.get("consultationSlotDays/AS001_2099-10-25").entries["09:30"].state, "booked");
    assert.equal(f.records.get(path(id)).consumerRescheduleCount, undefined);
  }
});

test("successive Admin reschedules retain the earlier reason/actor in immutable audit and event snapshots", async () => {
  const { f, id, send } = await seeded("consumer");
  await send({}); await f.flushAfter();
  const first = f.records.get(path(id));
  f.actor.role = "admin"; f.actor.uid = "admin";
  const request = { requestId: "admin-reschedule-reason-002", expectedAuditId: first.lastAuditId,
    confirmedDate: "2099-10-27", rescheduleReason: "Consultant requested a later date" };
  assert.equal((await send(request)).status, 200); await f.flushAfter();
  const second = f.records.get(path(id)), audit = f.records.get(`auditLogs/${second.lastAuditId}`);
  assert.equal(audit.previousValues.rescheduleReason, reason); assert.equal(audit.previousValues.rescheduledByRole, "consumer");
  assert.equal(audit.updatedValues.rescheduleReason, request.rescheduleReason); assert.equal(second.rescheduledByRole, "admin");
  assert.equal(second.consumerRescheduleCount, 1); assert.equal(second.consumerRescheduledAt, first.consumerRescheduledAt);
  assert.equal(f.values("consultationEmailEvents").filter(e => e.event === "rescheduled" && e.payload.rescheduleReason === reason).length, 3);
});

test("legacy no-reason action retries preserve their original event; new no-reason reschedules are refused", async () => {
  const { f, id, input, send } = await seeded("admin");
  const current = f.records.get(path(id));
  const legacy = { ...current, confirmedDate: input.confirmedDate, confirmedTime: input.confirmedTime, confirmedEndTime: "10:30", lastAuditId: "legacy-reschedule-audit" };
  f.records.set(path(id), legacy);
  const digest = text => createHash("sha256").update(text).digest("hex");
  const eventId = `action-${digest(`admin:${id}:${input.requestId}`)}`;
  const hash = digest(JSON.stringify(["reschedule", input.confirmedDate, input.confirmedTime, "", input.expectedAuditId]));
  const confirmations = f.values("consultationEmailEvents").filter(e => e.event === "confirmed");
  for (const event of confirmations) {
    const suffix = event.audience === "consumer" ? "" : `-${event.audience}`;
    f.records.set(`consultationEmailEvents/${eventId}${suffix}`, { ...event, event: "rescheduled", status: "pending", payloadHash: hash,
      bookingAuditId: legacy.lastAuditId, lastAuditId: legacy.lastAuditId,
      payload: { ...event.payload, date: input.confirmedDate, previousDate: current.confirmedDate, previousTime: "9:30 AM – 10:00 AM", time: "10:00 AM – 10:30 AM" } });
  }
  assert.equal((await send({ rescheduleReason: undefined })).status, 200); await f.flushAfter();
  assert.equal(f.records.get(path(id)), legacy); assert.equal(legacy.rescheduleReason, undefined);
  assert.match(f.calls.smtp.at(-1).text, /Rescheduling reason: Reason not recorded/);
  assert.match(f.calls.smtp.at(-1).text, /Rescheduled by: Not recorded/);
  const count = f.calls.smtp.length;
  assert.equal((await send({ rescheduleReason: undefined })).status, 200); await f.flushAfter(); assert.equal(f.calls.smtp.length, count);
  assert.equal((await send({ requestId: "fresh-action-without-reason", rescheduleReason: undefined })).status, 400);
});

test("failed reschedules retain booking reason and slot state; direct consultation edits stay denied", async () => {
  const { f, id, input } = await seeded();
  const before = f.records.get(path(id));
  const failed = consultationPaymentFixture({ failCommit: true, records: Object.fromEntries(f.records) });
  const response = await failed.load("app/api/consultations/[bookingId]/route.ts").PATCH(paymentRequest(input, "PATCH"), { params: Promise.resolve({ bookingId: id }) });
  assert.equal(response.status, 503); assert.equal(failed.records.get(path(id)), before); assert.equal(failed.calls.after.length, 0);
  assert.equal(failed.values("consultationEmailEvents").filter(e => e.event === "rescheduled").length, 0);
  const rules = readFileSync("firestore.rules", "utf8");
  assert.match(rules, /match \/consultationBookings\/\{bookingId\} \{[\s\S]*?allow create, update, delete: if false;/);
});
