import { test } from "node:test";
import assert from "node:assert/strict";
import { Timestamp } from "firebase-admin/firestore";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
import { consultationPaymentFixture, prepare, verify, paymentRequest } from "../helpers/consultationPaymentFixture.mjs";

const { consumerRescheduleEligibility: eligible } = loadTypeScript("features/consultations/rescheduling.ts");
const path = id => `consultationBookings/${id}`;
async function seeded() {
  const f = consultationPaymentFixture();
  const checkout = (await (await prepare(f)).json()).checkout;
  f.capture(checkout);
  assert.equal((await verify(f, checkout.intentId)).status, 200);
  return { f, id: checkout.intentId };
}
const body = booking => ({ action: "reschedule", requestId: "consumer-reschedule-0001", expectedAuditId: booking.lastAuditId,
  confirmedDate: "2099-10-26", confirmedTime: "10:00" });
const update = async (f, id, input) => {
  const response = await f.load("app/api/consultations/[bookingId]/route.ts").PATCH(paymentRequest(input, "PATCH"), { params: Promise.resolve({ bookingId: id }) });
  await f.flushAfter();
  return response;
};
const slots = (f, id, query = "") => f.load("app/api/consultations/slots/route.ts").GET(new Request(`https://test.local/api/consultations/slots?consultantId=AS001&service=prenatal-doctor&date=2099-10-25&excludeBookingId=${id}${query}`));

test("one-time consumer rescheduling uses the scheduled IST start and includes the exact 24-hour cutoff", () => {
  const booking = { status: "confirmed", confirmedDate: "2026-11-05", preferredDate: "2026-11-01", confirmedTime: "09:00", slotStartTime: "10:00" };
  const deadline = Date.parse("2026-11-04T03:30:00.000Z");
  assert.equal(eligible(booking, deadline).deadlineAt, "2026-11-04T03:30:00.000Z");
  assert.equal(eligible(booking, deadline).allowed, true);
  assert.equal(eligible(booking, deadline + 1).allowed, false);
  for (const change of [{ consumerRescheduleCount: 1 }, { consumerRescheduleCount: -1 }, { consumerRescheduledAt: {} }, { status: "cancelled" }, { status: "completed" }, { status: "requested" }, { cancellationPolicy: {} }]) {
    assert.equal(eligible({ ...booking, ...change }, deadline - 1).allowed, false);
  }
  assert.equal(eligible({ ...booking, confirmedDate: "invalid" }, deadline).allowed, false);
});

test("consumer reschedule commits once, retains payment and policy, releases/reserves slots and emails both recipients once", async () => {
  const { f, id } = await seeded();
  const before = f.records.get(path(id));
  const request = { ...body(before), consumerRescheduleCount: 0, adminNotes: "Cannot change this" };
  const response = await update(f, id, request);
  assert.equal(response.status, 200, await response.clone().text());
  const saved = f.records.get(path(id));
  assert.equal(saved.consumerRescheduleCount, 1);
  assert.ok(saved.consumerRescheduledAt.toMillis());
  assert.equal(saved.adminNotes, before.adminNotes);
  assert.equal(saved.bookingReference, before.bookingReference);
  assert.equal(saved.paymentReference, before.paymentReference);
  assert.equal(saved.consultantCharge, before.consultantCharge);
  assert.equal(saved.cancellationPolicy.policy.version, before.cancellationPolicy.policy.version);
  assert.equal(saved.cancellationPolicy.refundDeadlineAt, "2099-10-25T04:30:00.000Z");
  assert.equal(f.records.get("consultationSlotDays/AS001_2099-10-25").entries["09:30"].state, "released");
  assert.equal(f.records.get("consultationSlotDays/AS001_2099-10-26").entries["10:00"].state, "booked");
  assert.equal(f.values("consultationEmailEvents").filter(event => event.event === "rescheduled").length, 3);
  assert.match(f.calls.smtp[0].text, /25\/10\/2099/);
  assert.match(f.calls.smtp[0].text, /26\/10\/2099/);
  assert.equal(f.calls.consultantSmtp.length, 1);
  const audits = f.values("auditLogs").length;
  assert.equal((await update(f, id, request)).status, 200);
  assert.equal(f.values("auditLogs").length, audits);
  assert.equal(f.calls.smtp.length, 1);
  assert.equal(f.calls.consultantSmtp.length, 1);
  assert.equal((await update(f, id, { ...body(saved), requestId: "consumer-reschedule-0002", confirmedTime: "10:30" })).status, 409);
  assert.equal(f.records.get(path(id)).consumerRescheduleCount, 1);
  assert.equal(f.values("notifications").filter(n => n.recipientRole === "admin").length, 2);
});

test("reschedule revalidates ownership, revision, request identity and the cutoff inside the server transaction", async t => {
  const { f, id } = await seeded();
  const booking = f.records.get(path(id)), input = body(booking);
  f.actor.uid = "different-consumer";
  assert.equal((await update(f, id, input)).status, 403);
  assert.equal((await slots(f, id)).status, 403);
  f.actor.uid = "patient"; f.actor.role = "hospital";
  assert.equal((await update(f, id, input)).status, 403);
  f.actor.role = "consumer";
  assert.equal((await update(f, id, { ...input, requestId: undefined })).status, 400);
  assert.equal((await update(f, id, { ...input, expectedAuditId: undefined })).status, 400);
  assert.equal((await update(f, id, { ...input, expectedAuditId: "stale" })).status, 409);
  assert.equal((await update(f, id, { ...input, action: "completed" })).status, 403);
  const deadline = Date.parse(booking.cancellationPolicy.appointmentAt) - 24 * 3600000;
  let serverNow = deadline + 1;
  t.mock.method(Timestamp, "now", () => Timestamp.fromMillis(serverNow));
  assert.equal((await update(f, id, input)).status, 409);
  assert.equal(f.records.get(path(id)).consumerRescheduleCount, undefined);
  serverNow = deadline;
  assert.equal((await update(f, id, input)).status, 200);
});

test("consumer slot exclusion is restricted to the owned matching eligible consultation", async () => {
  const { f, id } = await seeded();
  const response = await slots(f, id);
  assert.equal(response.status, 200);
  const projected = await response.json();
  assert.equal(projected.slots[0].startTime, "09:30");
  assert.doesNotMatch(JSON.stringify(projected), /consumerId|ownerId|commission|payable|@/);
  assert.equal((await slots(f, "consultation-" + "a".repeat(64))).status, 403);
  const booking = f.records.get(path(id));
  booking.serviceId = "psychologist"; assert.equal((await slots(f, id)).status, 403);
  booking.serviceId = "prenatal-doctor"; booking.consumerRescheduleCount = 1;
  assert.equal((await slots(f, id)).status, 409);
});

test("conflicting, invalid and failed reschedules never consume the allowance or release the old slot", async () => {
  const { f, id } = await seeded();
  const booking = f.records.get(path(id));
  const failed = consultationPaymentFixture({ failCommit: true, records: Object.fromEntries(f.records) });
  assert.equal((await update(failed, id, body(booking))).status, 503);
  assert.equal(failed.records.get(path(id)).consumerRescheduleCount, undefined);
  assert.equal(failed.records.get("consultationSlotDays/AS001_2099-10-25").entries["09:30"].state, "booked");
  assert.equal(failed.calls.smtp.length, 0);
  for (const change of [{ confirmedDate: "2099-02-30" }, { confirmedTime: "10:15" }, { confirmedDate: booking.confirmedDate, confirmedTime: booking.confirmedTime }]) {
    assert.ok([400,409].includes((await update(f, id, { ...body(booking), ...change })).status));
  }
  f.records.set("consultationBookings/legacy-conflict", { ...booking, consumerId: "other", confirmedDate: "2099-10-26", preferredDate: "2099-10-26", confirmedTime: "10:00", confirmedEndTime: "10:30" });
  assert.equal((await update(f, id, body(booking))).status, 409);
  assert.equal(f.records.get(path(id)).consumerRescheduleCount, undefined);
});

test("simultaneous consumer reschedules permit one change and Admin changes never reset the allowance", async () => {
  const { f, id } = await seeded();
  const input = body(f.records.get(path(id)));
  const responses = await Promise.all([update(f, id, input), update(f, id, { ...input, requestId: "consumer-reschedule-0002", confirmedTime: "10:30" })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  f.actor.role = "admin"; f.actor.uid = "admin";
  assert.equal((await update(f, id, { ...body(f.records.get(path(id))), requestId: "admin-reschedule-00001", confirmedDate: "2099-10-27" })).status, 200);
  assert.equal(f.records.get(path(id)).consumerRescheduleCount, 1);
  f.actor.role = "consumer"; f.actor.uid = "patient";
  assert.equal((await update(f, id, { ...body(f.records.get(path(id))), requestId: "consumer-reschedule-0003" })).status, 409);
});

test("a lost reschedule response recovers the committed one-time change without duplicate notices or emails", async () => {
  const original = await seeded();
  const f = consultationPaymentFixture({ throwAfterCommit: true, records: Object.fromEntries(original.f.records) });
  const input = body(f.records.get(path(original.id)));
  assert.equal((await update(f, original.id, input)).status, 503);
  assert.equal(f.records.get(path(original.id)).consumerRescheduleCount, 1);
  const auditCount = f.values("auditLogs").length;
  const notifications = f.values("notifications").length;
  assert.equal((await update(f, original.id, input)).status, 200);
  assert.equal(f.values("notifications").length, notifications);
  assert.equal(f.records.get(path(original.id)).consumerRescheduleCount, 1);
  assert.equal(f.calls.smtp.length, 1);
  assert.equal(f.calls.consultantSmtp.length, 1);
  // Email delivery has its own claim/outcome audits; no second booking audit.
  assert.equal(f.values("auditLogs").filter(a => a.module === "consultationBookings").length,
    original.f.values("auditLogs").filter(a => a.module === "consultationBookings").length + 1);
  assert.ok(f.values("auditLogs").length >= auditCount);
});
