import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { bookingFlowFixture, bookingTestRequest } from "../helpers/bookingFlowFixture.mjs";
import { consultationPaymentFixture, prepare, verify, paymentRequest } from "../helpers/consultationPaymentFixture.mjs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const reason = "My care plans have changed <not a script>";
const booking = { status: "confirmed", treatmentStatus: "not_started", consumerId: "patient", consumerName: "Patient",
  consumerEmail: "patient@example.com", hospitalId: "centre", serviceId: "package", hospitalName: "Trusted centre",
  serviceName: "7-day package", servicePrice: 12000, preferredDate: Timestamp.fromDate(new Date("2099-10-25T00:00:00+05:30")),
  bookingReference: "AYURTEST", archivedAt: null, lastAuditId: "original" };
const centreFixture = options => bookingFlowFixture({ ...options, records: { "bookings/centre-booking": { ...booking }, ...options?.records } });
const cancelCentre = (f, values = {}) => f.load("app/api/bookings/[bookingId]/cancel/route.ts").POST(
  bookingTestRequest("/api/bookings/centre-booking/cancel", { cancellationReason: reason, expectedAuditId: "original", ...values }),
  { params: Promise.resolve({ bookingId: "centre-booking" }) });

test("both centre cancellation roles persist trusted actor/reason, atomic audit and a single customer email", async () => {
  for (const role of ["admin", "consumer"]) {
    const f = centreFixture({ actor: { role, uid: role === "admin" ? "admin" : "patient" } });
    const responses = await Promise.all([cancelCentre(f, { cancelledByRole: "hospital", cancelledBy: "fake" }), cancelCentre(f)]);
    assert.ok(responses.every(r => r.status === 200));
    const saved = f.records.get("bookings/centre-booking");
    assert.equal(saved.cancelledByRole, role); assert.equal(saved.cancelledBy, f.actor.uid); assert.equal(saved.cancellationReason, reason);
    assert.ok(saved.cancelledAt); assert.equal(saved.servicePrice, 12000);
    assert.equal(f.values("hospitalBookingEmailEvents").length, 1);
    const audit = f.records.get(`auditLogs/${saved.lastAuditId}`);
    assert.equal(audit.updatedValues.cancellationReason, reason); assert.equal(audit.actorRole, role);
    assert.equal(f.calls.smtp.length, 0);
    await f.flushAfter(); assert.equal(f.calls.smtp.length, 1);
    assert.match(f.calls.smtp[0].text, new RegExp(`Cancelled by: ${role === "admin" ? "Ayursarga team" : "Customer"}`));
    assert.match(f.calls.smtp[0].text, /Cancellation reason: My care plans/);
    assert.match(f.calls.smtp[0].html, /&lt;not a script&gt;/);
    assert.match(f.calls.smtp[0].subject, /cancelled/); assert.doesNotMatch(f.calls.smtp[0].subject, /confirmed/);
    assert.equal((await cancelCentre(f)).status, 200); await f.flushAfter(); assert.equal(f.calls.smtp.length, 1);
    assert.equal((await cancelCentre(f, { cancellationReason: "Different reason" })).status, 409);
    assert.equal(saved.cancellationReason, reason);
  }
});

test("centre reasons, role ownership, revision and treatment rules are enforced before any writes", async () => {
  for (const invalid of [undefined, "", "  ", "ab", 12, {}, "x".repeat(501), "Bad\u0000reason"]) {
    const f = centreFixture(); assert.equal((await cancelCentre(f, { cancellationReason: invalid })).status, 400);
    assert.equal(f.calls.commits, 0); assert.equal(f.calls.after.length, 0);
  }
  for (const [options, values, status] of [
    [{ actor: { uid: "other", role: "consumer" } }, {}, 403], [{ actor: { role: "hospital" } }, {}, 403],
    [{ denied: true }, {}, 403], [{}, { expectedAuditId: "stale" }, 409],
    [{ records: { "bookings/centre-booking": { ...booking, treatmentStatus: "started" } } }, {}, 409],
    [{ records: { "bookings/centre-booking": { ...booking, status: "completed" } } }, {}, 409],
    [{ failCommit: true }, {}, 503],
  ]) {
    const f = centreFixture(options); assert.equal((await cancelCentre(f, values)).status, status);
    assert.equal(f.values("hospitalBookingEmailEvents").length, 0); assert.equal(f.calls.after.length, 0);
  }
});

test("centre failed email is recorded and Admin-alerted without resending; obsolete pending mail is superseded", async () => {
  const f = centreFixture({ failEmail: true });
  assert.equal((await cancelCentre(f)).status, 200); await f.flushAfter();
  assert.equal(f.values("hospitalBookingEmailEvents")[0].status, "failed");
  assert.ok(f.values("notifications").some(n => n.type === "booking_cancelled" && n.actionHref.includes("/admin/bookings?booking=")));
  assert.equal((await cancelCentre(f)).status, 200); await f.flushAfter(); assert.equal(f.calls.smtp.length, 1);
  const stale = centreFixture(); await cancelCentre(stale);
  stale.records.get("bookings/centre-booking").lastAuditId = "new-revision";
  await stale.flushAfter(); assert.equal(stale.calls.smtp.length, 0);
  assert.equal(stale.values("hospitalBookingEmailEvents")[0].status, "superseded");
});

async function consultation(role) {
  const f = consultationPaymentFixture(); const checkout = (await (await prepare(f)).json()).checkout;
  f.capture(checkout); assert.equal((await verify(f, checkout.intentId)).status, 200); await f.flushAfter();
  f.actor.role = role; f.actor.uid = role === "admin" ? "admin" : "patient";
  const route = f.load("app/api/consultations/[bookingId]/route.ts");
  const send = body => route.PATCH(paymentRequest({ action: "cancelled", requestId: "cancellation-reason-action-001", ...body }, "PATCH"), { params: Promise.resolve({ bookingId: checkout.intentId }) });
  return { f, id: checkout.intentId, send };
}

test("consultation cancellation requires a separate reason and emails the trusted actor to every existing recipient", async () => {
  for (const role of ["admin", "consumer"]) {
    const { f, id, send } = await consultation(role);
    const before = f.calls.commits;
    assert.equal((await send({ adminNotes: "Notes are not a cancellation reason" })).status, 400);
    assert.equal(f.calls.commits, before);
    assert.equal((await send({ cancellationReason: "x".repeat(501) })).status, 400);
    const response = await send({ cancellationReason: reason, cancelledByRole: "fake" }); assert.equal(response.status, 200);
    const saved = f.records.get(`consultationBookings/${id}`); assert.equal(saved.cancelledByRole, role);
    assert.equal(saved.cancellationReason, reason); assert.equal(saved.cancelledBy, f.actor.uid);
    const cancellation = f.values("consultationEmailEvents").filter(e => e.event === "cancelled"); assert.equal(cancellation.length, 3);
    assert.ok(cancellation.every(e => e.payload.cancelledByRole === role && e.payload.cancellationReason === reason));
    await f.flushAfter();
    for (const messages of [f.calls.smtp, f.calls.consultantSmtp, f.calls.supportSmtp]) {
      assert.match(messages.at(-1).text, new RegExp(`Cancelled by: ${role === "admin" ? "Ayursarga team" : "Customer"}`));
      assert.match(messages.at(-1).text, /Cancellation reason: My care plans/);
    }
    const count = f.calls.smtp.length;
    assert.equal((await send({ cancellationReason: reason })).status, 200); await f.flushAfter(); assert.equal(f.calls.smtp.length, count);
    assert.equal((await send({ cancellationReason: "Another reason" })).status, 409);
  }
});

test("legacy cancellation templates use honest fallbacks; direct writes cannot bypass private cancellation journals", () => {
  const { bookingEmail } = loadTypeScript("lib/bookingEmail.ts");
  const mail = bookingEmail({ kind: "hospital", event: "cancelled", consumerName: "Patient", bookingReference: "AYURTEST", providerName: "Centre", serviceName: "Package", date: "2099-10-25", bookingUrl: "https://ayursarga.com/app/bookings" });
  assert.match(mail.text, /Cancelled by: Not recorded/); assert.match(mail.text, /Cancellation reason: Reason not recorded/);
  const rules = readFileSync("firestore.rules", "utf8");
  assert.match(rules, /match \/hospitalBookingEmailEvents\/\{eventId\} \{\s*allow read, write: if false;/);
  assert.match(rules, /request.resource.data.status != 'cancelled' \|\| resource.data.status == 'cancelled'/);
  assert.match(rules, /'cancellationReason', 'cancelledByRole', 'cancelledBy', 'cancelledAt'/);
});
