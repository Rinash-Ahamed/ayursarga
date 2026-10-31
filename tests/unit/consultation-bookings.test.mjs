import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { consultationPaymentFixture, prepare, verify } from "../helpers/consultationPaymentFixture.mjs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const consultant = { name: "Assigned Professional", designation: "Ayurvedic physician", qualification: "BAMS", yearsExperience: 3.5,
  status: "active", employeeSequence: 1, archivedAt: null, consultationServices: ["prenatal-doctor"], consultantCharge: 900.5, ayursargaCommissionPercentage: 0,
  preferredTimeSlots: ["morning"], preferredSlotTimings: { morning: { startTime: "09:30", endTime: "11:45" } },
  email: "private@example.com", contactNo: "9876543210", address: "Private address", emergencyContactNo: "9876543210", lastAuditId: "secret-audit" };
const input = { consultantId: "AS001", serviceId: "prenatal-doctor", preferredDate: "2099-10-25", preferredTimeSlot: "morning",
  expectedSlotStartTime: "09:30", expectedSlotEndTime: "11:45",
  bookingTermsAccepted: true, expectedCharge: 900.5, requestId: "consultation-attempt-0001", consumerNotes: "Please help with pregnancy lifestyle." };
const fixture = (options = {}) => consultationPaymentFixture({ ...options, records: { "consultants/AS001": consultant, ...options.records } });
const request = (body, method = "POST") => new Request("https://test.local/api/consumer/consultations", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
// Existing lifecycle tests now start from an actual prepared and verified synthetic payment.
// New checkout tests separately assert that preparation alone cannot create a booking.
async function create(f, body = input) {
  const previous = f.values("consultationBookings").length;
  const prepared = await prepare(f, { ...body, checkoutVersion: 1 });
  if (!prepared.ok) return prepared;
  let checkout = (await prepared.json()).checkout;
  if (!checkout.bookingId) {
    if (checkout.state !== "ready") return Response.json({ error: "Payment requires review" }, { status: 503 });
    f.capture(checkout);
    const verified = await verify(f, checkout.intentId);
    if (!verified.ok) return verified;
    checkout = (await verified.json()).checkout;
  }
  if (!checkout.bookingId) return Response.json({ error: "Payment requires review" }, { status: 409 });
  const deliveries = await f.load("services/email/consultationEmailService.ts").deliverConsultationEmails(f.firestore, `confirmation-${checkout.bookingId}`);
  return Response.json({ bookingId: checkout.bookingId, bookingReference: checkout.bookingReference, ...deliveries }, { status: f.values("consultationBookings").length > previous ? 201 : 200 });
}
async function update(f, id, body) { return f.load("app/api/consultations/[bookingId]/route.ts").PATCH(request(body, "PATCH"), { params: Promise.resolve({ bookingId: id }) }); }

test("consultation creation snapshots actual charge, provider, Consumer and consent with one atomic audit and Admin bell", async () => {
  const f = fixture();
  const response = await create(f, { ...input, consultantCharge: 1, status: "confirmed", consumerId: "other", consultantName: "Untrusted" });
  assert.equal(response.status, 201);
  const { bookingId, email } = await response.json();
  assert.equal(email.status, "accepted");
  const record = f.records.get(`consultationBookings/${bookingId}`);
  assert.equal(record.consumerId, "patient"); assert.equal(record.consultantName, consultant.name);
  assert.equal(record.consultantCharge, 900.5); assert.equal(record.status, "confirmed");
  assert.equal(record.confirmedDate, input.preferredDate); assert.equal(record.confirmedTime, null); assert.ok(record.confirmedAt);
  assert.equal(f.calls.smtp.length, 1);
  assert.equal(record.slotStartTime, "09:30"); assert.equal(record.consumerPhone, "9876543210");
  assert.ok(record.bookingTermsAcceptedAt); assert.ok(record.bookingTermsVersion);
  assert.ok(f.records.get(`auditLogs/${record.lastAuditId}`));
  const notifications = f.values("notifications");
  assert.equal(notifications.length, 1); assert.equal(notifications[0].recipientId, "admin");
  assert.equal(notifications[0].type, "consultation_updated"); assert.match(notifications[0].actionHref, /\/admin\/bookings\/consultations\?booking=/);
  assert.equal(f.values("bookings").length, 0); // Hospital booking schema/workflow stays independent.
});

test("consumer sees and books only the server-computed total, with private pricing audit and unchanged retry snapshots", async () => {
  const f = fixture({ records: { "consultants/AS001": { ...consultant, ayursargaCommissionPercentage: 10 } } });
  const body = { ...input, expectedCharge: 990.55, consultantCharge: 1, ayursargaCommissionPercentage: 0 };
  const response = await create(f, body);
  assert.equal(response.status, 201);
  const { bookingId } = await response.json();
  const record = f.records.get(`consultationBookings/${bookingId}`);
  assert.equal(record.consultantCharge, 990.55);
  assert.equal(Object.hasOwn(record, "ayursargaCommissionPercentage"), false);
  assert.equal(Object.hasOwn(record, "consultantBaseCharge"), false);
  const audit = f.records.get(`auditLogs/${record.lastAuditId}`);
  const finance = f.records.get(`consultationFinancials/${bookingId}`);
  assert.equal(finance.consultantPayablePaise, 90050); assert.equal(finance.commissionPaise, 9005); assert.equal(finance.grossPaise, 99055);
  assert.equal(audit.updatedValues.consultantCharge, 990.55);
  assert.ok(f.values("consultationEmailEvents").every((event) => event.payload.amount === (event.audience === "consultant" ? 900.5 : 990.55)));
  assert.match(f.calls.smtp[0].text, /990\.55/);
  f.records.set("consultants/AS001", { ...consultant, consultantCharge: 1200, ayursargaCommissionPercentage: 20 });
  assert.equal((await create(f, body)).status, 200);
  assert.equal(f.records.get(`consultationBookings/${bookingId}`).consultantCharge, 990.55);
  assert.equal(f.values("consultationBookings").length, 1);
  assert.equal(f.calls.smtp.length, 1);
});

test("stale base-only prices and changed commission are rejected before any booking write", async () => {
  for (const ayursargaCommissionPercentage of [10, 20]) {
    const f = fixture({ records: { "consultants/AS001": { ...consultant, ayursargaCommissionPercentage } } });
    assert.equal((await create(f, { ...input, ayursargaCommissionPercentage: 0 })).status, 409);
    assert.equal(f.values("consultationBookings").length, 0);
    assert.equal(f.values("consultationEmailEvents").length, 0);
    assert.equal(f.calls.smtp.length, 0);
  }
});

test("public consultant prices include commission without leaking the Admin pricing breakdown", () => {
  const { publicConsultantProjection } = loadTypeScript("features/consultations/publicProjection.ts");
  const legacy = publicConsultantProjection("AS001", consultant, "prenatal-doctor");
  const markedUp = publicConsultantProjection("AS001", { ...consultant, ayursargaCommissionPercentage: 10 }, "prenatal-doctor");
  assert.equal(legacy.consultantCharge, 900.5);
  assert.equal(markedUp.consultantCharge, 990.55);
  assert.deepEqual(Object.keys(markedUp).sort(), Object.keys(legacy).sort());
  assert.equal(Object.hasOwn(markedUp, "ayursargaCommissionPercentage"), false);
  for (const value of [-1, 101, "10", true, NaN, Infinity, 10.001]) {
    assert.equal(publicConsultantProjection("AS001", { ...consultant, ayursargaCommissionPercentage: value }, "prenatal-doctor"), null);
  }
});

test("availability intersects configured weekdays and exact dates, with fail-closed malformed config", async () => {
  const { isConsultantDateAvailable } = loadTypeScript("features/consultations/availability.ts");
  assert.equal(isConsultantDateAvailable("2099-10-25", {}), true);
  assert.equal(isConsultantDateAvailable("2099-10-25", { preferredDays: ["sun"] }), true);
  assert.equal(isConsultantDateAvailable("2099-10-25", { preferredDays: ["mon"] }), false);
  for (const changes of [
    { preferredDays: ["mon"] }, { availableDates: ["2099-10-26"] },
    { preferredDays: ["mon"], availableDates: [input.preferredDate] },
    { preferredDays: ["invalid"] }, { availableDates: ["2099-02-30"] },
  ]) {
    const f = fixture({ records: { "consultants/AS001": { ...consultant, ...changes } } });
    assert.equal((await create(f)).status, 409);
    assert.equal(f.calls.writes.length, 0);
    assert.equal(f.calls.smtp.length, 0); assert.equal(f.calls.consultantSmtp.length, 0);
  }
  const f = fixture({ records: { "consultants/AS001": { ...consultant, preferredDays: ["sun"], availableDates: [input.preferredDate] } } });
  assert.equal((await create(f)).status, 201);
  // A retry of an already committed request remains idempotent after Admin changes availability.
  f.records.set("consultants/AS001", { ...consultant, preferredDays: ["mon"] });
  assert.equal((await create(f)).status, 200);
  assert.equal(f.values("consultationBookings").length, 1);
});

test("Admin rescheduling checks current days/dates without changing existing appointments on failure", async () => {
  for (const changes of [{ preferredDays: ["sun"] }, { availableDates: ["2099-10-25"] }, { preferredDays: ["mon"], availableDates: ["2099-10-27"] }]) {
    const { f, id } = await seeded();
    const before = f.records.get(`consultationBookings/${id}`);
    f.records.set("consultants/AS001", { ...consultant, ...changes });
    f.actor.role = "admin"; f.actor.uid = "admin";
    assert.equal((await update(f, id, { action: "reschedule", requestId: "reschedule-availability-0001", confirmedDate: "2099-10-26", confirmedTime: "10:15" })).status, 409);
    assert.deepEqual(f.records.get(`consultationBookings/${id}`), before);
    assert.equal(f.calls.smtp.length, 1); assert.equal(f.calls.consultantSmtp.length, 1);
  }
  const { f, id } = await seeded();
  f.records.set("consultants/AS001", { ...consultant, preferredDays: ["mon"], availableDates: ["2099-10-26"] });
  f.actor.role = "admin"; f.actor.uid = "admin";
  assert.equal((await update(f, id, { action: "reschedule", requestId: "reschedule-availability-0002", confirmedDate: "2099-10-26", confirmedTime: "10:15" })).status, 200);
});

test("retrying original creation after cancellation suppresses obsolete pending emails for both recipients", async () => {
  const f = fixture({ throwAfterCommit: true });
  assert.equal((await create(f)).status, 503); // Booking/event commit succeeded, response was lost before SMTP.
  const booking = f.values("consultationBookings")[0];
  assert.equal(f.calls.smtp.length, 0); assert.equal(f.calls.consultantSmtp.length, 0);
  const legacyPath = `consultationEmailEvents/confirmation-${booking.id}`;
  const { bookingAuditId, ...legacyEvent } = f.records.get(legacyPath);
  assert.ok(bookingAuditId);
  f.records.set(legacyPath, legacyEvent); // Existing pending consumer event, before this fix.
  f.actor.role = "admin"; f.actor.uid = "admin";
  assert.equal((await update(f, booking.id, { action: "cancelled", requestId: "cancel-before-original-retry-001" })).status, 200);
  assert.equal(f.calls.smtp.length, 1); assert.equal(f.calls.consultantSmtp.length, 1);
  assert.match(f.calls.smtp[0].subject, /cancelled/i);
  f.actor.role = "consumer"; f.actor.uid = "patient";
  const retry = await create(f);
  assert.equal(retry.status, 200); assert.equal((await retry.json()).email.status, "superseded");
  const before = f.calls.writes.length;
  assert.equal((await create(f)).status, 200);
  assert.equal(f.calls.writes.length, before);
  assert.equal(f.calls.smtp.length, 1); assert.equal(f.calls.consultantSmtp.length, 1);
  for (const suffix of ["", "-consultant"]) {
    const event = f.records.get(`consultationEmailEvents/confirmation-${booking.id}${suffix}`);
    assert.equal(event.status, "superseded"); assert.ok(event.supersededAt);
    assert.equal(event.failureReason, "appointment_changed");
    const audit = f.records.get(`auditLogs/${event.lastAuditId}`);
    assert.equal(audit.updatedValues.status, "superseded");
  }
  assert.equal(f.records.get(`consultationBookings/${booking.id}`).status, "cancelled");
  assert.equal(f.values("notifications").filter((record) => record.message.includes("email could not")).length, 0);
});

test("original pending confirmations cannot replay after rescheduling, completion, archival or a missing booking", async () => {
  for (const change of ["reschedule", "completed", "consumer-cancelled", "archived", "missing"]) {
    const f = fixture({ throwAfterCommit: true });
    assert.equal((await create(f)).status, 503);
    const booking = f.values("consultationBookings")[0];
    if (change === "reschedule" || change === "completed") {
      f.actor.role = "admin"; f.actor.uid = "admin";
      assert.equal((await update(f, booking.id, { action: change, requestId: "update-before-original-retry-001",
        confirmedDate: "2099-10-26", confirmedTime: "10:00" })).status, 200);
    } else if (change === "consumer-cancelled") {
      assert.equal((await update(f, booking.id, { status: "cancelled" })).status, 200);
    } else if (change === "archived") f.records.set(`consultationBookings/${booking.id}`, { ...booking, archivedAt: {} });
    else f.records.delete(`consultationBookings/${booking.id}`); // Isolated fixture only.
    const sent = [f.calls.smtp.length, f.calls.consultantSmtp.length];
    const delivery = await f.load("services/email/consultationEmailService.ts").deliverConsultationEmails(f.firestore, `confirmation-${booking.id}`);
    assert.equal(delivery.email.status, "superseded"); assert.equal(delivery.consultantEmail.status, "superseded");
    assert.deepEqual([f.calls.smtp.length, f.calls.consultantSmtp.length], sent);
  }
});

test("legacy pending emails use the originating audit, while newer schedule revisions supersede older reschedule retries", async () => {
  const pending = fixture({ throwAfterCommit: true });
  assert.equal((await create(pending)).status, 503);
  for (const [path, event] of pending.records) if (path.startsWith("consultationEmailEvents/")) {
    const { bookingAuditId, ...legacyEvent } = event;
    assert.ok(bookingAuditId); pending.records.set(path, legacyEvent);
  }
  const deliver = pending.load("services/email/consultationEmailService.ts").deliverConsultationEmails;
  const confirmationId = `confirmation-${pending.values("consultationBookings")[0].id}`;
  assert.equal((await deliver(pending.firestore, confirmationId)).email.status, "accepted");
  assert.equal(pending.calls.smtp.length, 1); assert.equal(pending.calls.consultantSmtp.length, 1);

  const { f: original, id } = await seeded();
  const f = fixture({ actor: { uid: "admin", role: "admin" }, throwAfterCommit: true, records: Object.fromEntries(original.records) });
  const old = { action: "reschedule", requestId: "older-pending-reschedule-001", confirmedDate: "2099-10-26", confirmedTime: "10:00" };
  assert.equal((await update(f, id, old)).status, 503);
  assert.equal((await update(f, id, { ...old, requestId: "newer-reschedule-0000001", confirmedDate: "2099-10-27" })).status, 200);
  assert.equal((await update(f, id, { ...old, requestId: "newest-back-to-same-date-1" })).status, 200);
  const response = await update(f, id, old);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.email.status, "superseded"); assert.equal(result.consultantEmail.status, "superseded");
  assert.equal(f.calls.smtp.length, 2); assert.equal(f.calls.consultantSmtp.length, 2);
  assert.equal(f.records.get(`consultationBookings/${id}`).confirmedDate, "2099-10-26");
});

test("an unavailable database cannot authorize SMTP; a later verified current event still sends normally", async () => {
  const f = fixture({ throwAfterCommit: true });
  assert.equal((await create(f)).status, 503);
  const eventId = `confirmation-${f.values("consultationBookings")[0].id}`;
  const deliver = f.load("services/email/consultationEmailService.ts").deliverConsultationEmails;
  const runTransaction = f.firestore.runTransaction;
  f.firestore.runTransaction = async () => { throw new Error("Isolated read failure"); };
  const uncertain = await deliver(f.firestore, eventId);
  assert.equal(uncertain.email.status, "unknown"); assert.equal(uncertain.consultantEmail.status, "unknown");
  assert.equal(f.calls.smtp.length, 0); assert.equal(f.calls.consultantSmtp.length, 0);
  assert.equal(f.records.get(`consultationEmailEvents/${eventId}`).status, "pending");
  f.firestore.runTransaction = runTransaction;
  const verified = await deliver(f.firestore, eventId);
  assert.equal(verified.email.status, "accepted"); assert.equal(verified.consultantEmail.status, "accepted");
  assert.equal(f.calls.smtp.length, 1); assert.equal(f.calls.consultantSmtp.length, 1);
});

test("superseded email feedback never claims delivery or asks Admin to retry an obsolete email", () => {
  const { consultationEmailFeedback } = loadTypeScript("features/consultations/email.ts");
  for (const recipient of ["consumer", "consultant"]) {
    const text = consultationEmailFeedback({ status: "superseded" }, recipient);
    assert.match(text, /outdated.*not sent.*appointment has changed/);
    assert.doesNotMatch(text, /accepted|contact.*directly|resent/);
  }
});

test("duplicate, concurrent and lost-response retries create one appointment and never replay notifications", async () => {
  for (const throwAfterCommit of [false, true]) {
    const f = fixture({ throwAfterCommit });
    const responses = await Promise.all([create(f), create(f)]);
    // A simultaneous caller may observe the durable order claim before the
    // provider POST finishes. It must not create another order or invent success.
    assert.ok(responses.every(value => [201, 200, 503].includes(value.status)));
    assert.equal((await create(f)).status, 200);
    assert.equal(f.values("consultationBookings").length, 1); assert.equal(f.values("auditLogs").filter((item) => item.module === "consultationBookings").length, 1); assert.equal(f.values("notifications").length, 1);
    assert.equal(f.calls.smtp.length, 1);
    assert.equal((await create(f, { ...input, preferredDate: "2099-10-26" })).status, 409);
  }
});

test("invalid consent, profile, service, time window and date cannot create an appointment", async () => {
  for (const changes of [{ bookingTermsAccepted: false }, { serviceId: "made-up" }, { preferredTimeSlot: "evening" }, { preferredDate: "25/10/2099" }, { preferredDate: "2099-02-30" }, { consumerNotes: "x".repeat(501) }, { requestId: "short" }]) {
    const f = fixture(); assert.ok((await create(f, { ...input, ...changes })).status >= 400); assert.equal(f.values("auditLogs").filter((item) => item.module === "consultationBookings").length, 0);
  }
  for (const profile of [{ phone: "" }, { privacyConsentVersion: "old" }, { customerTermsAcceptedAt: null }]) {
    const f = fixture({ profile }); assert.equal((await create(f)).status, 409); assert.equal(f.values("consultationBookings").length, 0);
  }
});

test("Hospital and Admin cannot create Consumer consultation requests", async () => {
  for (const role of ["hospital", "admin"]) {
    const f = fixture({ actor: { uid: "partner", role } }); assert.equal((await create(f)).status, 403); assert.equal(f.calls.writes.length, 0);
  }
});

test("inactive, archived, unassigned, missing-charge and unavailable providers cannot be booked", async () => {
  for (const changes of [{ status: "inactive" }, { archivedAt: {} }, { consultationServices: [] }, { consultantCharge: null }, { preferredTimeSlots: [] }]) {
    const f = fixture({ records: { "consultants/AS001": { ...consultant, ...changes } } });
    assert.equal((await create(f)).status, 409); assert.equal(f.calls.writes.length, 0);
  }
});

test("a changed consultation charge must be reviewed before a new appointment can be created", async () => {
  const f = fixture({ records: { "consultants/AS001": { ...consultant, consultantCharge: 1000 } } });
  assert.equal((await create(f)).status, 409); assert.equal(f.calls.writes.length, 0);
  assert.equal((await create(f, { ...input, expectedCharge: 1000 })).status, 201);
  assert.equal(f.values("consultationBookings")[0].consultantCharge, 1000);
});

test("a changed consultant time window cannot silently replace the window chosen by the Consumer", async () => {
  const f = fixture({ records: { "consultants/AS001": { ...consultant, preferredSlotTimings: { morning: { startTime: "10:00", endTime: "12:00" } } } } });
  assert.equal((await create(f)).status, 409); assert.equal(f.calls.writes.length, 0);
  assert.equal((await create(f, { ...input, expectedSlotStartTime: "10:00", expectedSlotEndTime: "12:00" })).status, 201);
  assert.equal(f.values("consultationBookings")[0].slotStartTime, "10:00");
});

test("failed atomic commits do not leave appointments, reference reservations, audits or notifications", async () => {
  const f = fixture({ failCommit: true }); assert.equal((await create(f)).status, 503);
  for (const collection of ["consultationBookings", "bookingReferences", "auditLogs", "notifications", "consultationEmailEvents"]) assert.equal(f.values(collection).length, 0);
  assert.equal(f.calls.consultantSmtp.length, 0);
});

async function seeded(options = {}) {
  const f = fixture(options); const response = await create(f); assert.equal(response.status, 201);
  return { f, id: (await response.json()).bookingId };
}

test("Admin reschedules a confirmed consultation, emails old and new schedule once, then completes it", async () => {
  const { f, id } = await seeded();
  f.actor.role = "admin"; f.actor.uid = "admin";
  const savedBefore = f.records.get(`consultationBookings/${id}`);
  const body = { action: "reschedule", requestId: "reschedule-attempt-0001", expectedAuditId: savedBefore.lastAuditId,
    confirmedDate: "2099-10-26", confirmedTime: "10:15", adminNotes: "Please be ready five minutes before your consultation.", consultantCharge: 1 };
  const response = await update(f, id, body);
  assert.equal(response.status, 200); assert.equal((await response.json()).email.status, "accepted");
  assert.equal((await update(f, id, body)).status, 200);
  const saved = f.records.get(`consultationBookings/${id}`);
  assert.equal(saved.status, "confirmed"); assert.equal(saved.confirmedTime, "10:15"); assert.equal(saved.consultantCharge, 900.5);
  assert.equal(saved.confirmedAt, savedBefore.confirmedAt);
  assert.equal(f.calls.smtp.length, 2);
  assert.match(f.calls.smtp[1].text, /rescheduled/);
  assert.match(f.calls.smtp[1].text, /Original appointment date: 25\/10\/2099/);
  assert.match(f.calls.smtp[1].text, /Original appointment time: 09:30 - 11:45 IST/);
  assert.match(f.calls.smtp[1].text, /Updated appointment date: 26\/10\/2099/);
  assert.match(f.calls.smtp[1].text, /10:15 IST/);
  assert.equal(f.calls.smtp[1].to, "patient@example.com");
  assert.doesNotMatch(f.calls.smtp[1].text, /five minutes/); // private notes are not copied into email.
  assert.equal(f.values("notifications").filter((item) => item.recipientId === "patient").length, 1);
  assert.equal(f.values("auditLogs").filter((item) => item.module === "consultationBookings").length, 2);
  assert.equal((await update(f, id, { action: "completed" })).status, 200);
  assert.equal(f.calls.smtp.length, 2);
  assert.ok(f.records.get(`consultationBookings/${id}`).completedAt);
  assert.equal((await update(f, id, { ...body, requestId: "reschedule-attempt-0002", confirmedTime: "10:30" })).status, 409);
});

test("Consumer can cancel only their own pending or confirmed consultation; Hospital cannot update any", async () => {
  const { f, id } = await seeded();
  assert.equal((await update(f, id, { status: "confirmed" })).status, 400);
  f.actor.uid = "stranger"; assert.equal((await update(f, id, { status: "cancelled" })).status, 403);
  f.actor.role = "hospital"; assert.equal((await update(f, id, { status: "cancelled" })).status, 403);
  f.actor.role = "consumer"; f.actor.uid = "patient";
  assert.equal((await update(f, id, { status: "cancelled", adminNotes: "Not allowed" })).status, 200);
  const saved = f.records.get(`consultationBookings/${id}`);
  assert.equal(saved.status, "cancelled"); assert.equal(saved.adminNotes, null);
  assert.equal(f.calls.consultantSmtp.length, 1); // Only the initial booking; Consumer cancellation is outside this notification scope.
  assert.equal(f.values("notifications").filter((entry) => entry.recipientId === "admin").length, 2);
});

test("Admin cannot reschedule outside the window, against unavailable providers, or use removed actions", async () => {
  const { f, id } = await seeded(); f.actor.role = "admin"; f.actor.uid = "admin";
  const base = { action: "reschedule", requestId: "reschedule-attempt-0001", confirmedDate: "2099-10-25", confirmedTime: "10:00" };
  for (const confirmedTime of ["09:00", "11:45", "19:00", "10:99", "invalid"]) {
    assert.equal((await update(f, id, { ...base, confirmedTime })).status, 400);
  }
  for (const status of ["confirmed", "rejected"]) assert.equal((await update(f, id, { status })).status, 400);
  assert.equal((await update(f, id, { ...base, requestId: "bad" })).status, 400);
  assert.equal((await update(f, id, { ...base, expectedAuditId: "stale" })).status, 409);
  f.records.set("consultants/AS001", { ...consultant, status: "inactive" });
  assert.equal((await update(f, id, base)).status, 409);
  assert.equal(f.values("auditLogs").filter((item) => item.module === "consultationBookings").length, 1);
  assert.equal(f.values("notifications").length, 1);
  assert.equal(f.calls.smtp.length, 1);
});

test("Admin cancellation emails the original schedule after saving and retries never resend", async () => {
  const { f, id } = await seeded(); f.actor.role = "admin"; f.actor.uid = "admin";
  const body = { action: "cancelled", requestId: "cancellation-attempt-0001" };
  const response = await update(f, id, body); assert.equal(response.status, 200);
  assert.equal((await response.json()).email.status, "accepted");
  assert.equal((await update(f, id, body)).status, 200);
  assert.equal((await update(f, id, { ...body, requestId: "cancellation-attempt-0002" })).status, 200);
  assert.equal(f.records.get(`consultationBookings/${id}`).status, "cancelled");
  assert.equal(f.calls.smtp.length, 2);
  assert.match(f.calls.smtp[1].text, /cancelled/); assert.match(f.calls.smtp[1].text, /25\/10\/2099/);
  assert.match(f.calls.smtp[1].text, /09:30 - 11:45 IST/);
  assert.match(f.calls.smtp[1].text, /info@ayursarga.com/);
});

test("Repeated reschedules preserve each original schedule, reject stale/conflicting actions, and create separate notifications", async () => {
  const { f, id } = await seeded(); f.actor.role = "admin"; f.actor.uid = "admin";
  const first = { action: "reschedule", requestId: "reschedule-attempt-0001", expectedAuditId: f.records.get(`consultationBookings/${id}`).lastAuditId, confirmedDate: "2099-10-26", confirmedTime: "10:00" };
  const responses = await Promise.all([update(f, id, first), update(f, id, first)]);
  assert.deepEqual(responses.map((value) => value.status), [200, 200]);
  assert.equal(f.calls.smtp.length, 2);
  assert.equal((await update(f, id, { ...first, confirmedTime: "10:15" })).status, 409);
  assert.equal((await update(f, id, { ...first, requestId: "reschedule-attempt-0002", confirmedTime: "10:15" })).status, 409);
  const second = { ...first, requestId: "reschedule-attempt-0002", expectedAuditId: f.records.get(`consultationBookings/${id}`).lastAuditId, confirmedDate: "2099-10-27", confirmedTime: "10:30" };
  assert.equal((await update(f, id, second)).status, 200);
  assert.equal((await update(f, id, first)).status, 200); // A delayed retry must not revert the new schedule.
  assert.equal(f.records.get(`consultationBookings/${id}`).confirmedDate, "2099-10-27");
  assert.equal(f.calls.smtp.length, 3);
  assert.match(f.calls.smtp[2].text, /Original appointment date: 26\/10\/2099/);
  assert.match(f.calls.smtp[2].text, /Original appointment time: 10:00 IST/);
  assert.equal(f.values("notifications").filter((item) => item.recipientId === "patient").length, 2);
});

test("SMTP failure or an unknown delivery outcome never undo bookings or resend an event", async () => {
  for (const options of [{ failEmail: true }, { failEmailOutcomeCommit: true }]) {
    const { f, id } = await seeded(options); f.actor.role = "admin"; f.actor.uid = "admin";
    const body = { action: "cancelled", requestId: "cancellation-attempt-0001" };
    const response = await update(f, id, body);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.email.status, options.failEmail ? "failed" : "unknown");
    assert.equal(f.records.get(`consultationBookings/${id}`).status, "cancelled");
    const before = f.calls.smtp.length;
    const retry = await update(f, id, body); assert.equal(retry.status, 200);
    assert.ok(["failed", "sending"].includes((await retry.json()).email.status));
    assert.equal(f.calls.smtp.length, before);
  }
});

test("Legacy requested consultations can be rescheduled but are never silently migrated", async () => {
  const { f, id } = await seeded();
  const path = `consultationBookings/${id}`;
  f.records.set(path, { ...f.records.get(path), status: "requested", confirmedDate: null, confirmedTime: null, confirmedAt: null });
  f.actor.role = "admin"; f.actor.uid = "admin";
  assert.equal((await update(f, id, { action: "completed" })).status, 409);
  assert.equal((await update(f, id, { action: "reschedule", requestId: "legacy-reschedule-0001", confirmedDate: "2099-10-25", confirmedTime: "10:00" })).status, 200);
  assert.equal(f.records.get(path).status, "confirmed");
});

test("a rejected appointment commit cannot send a reschedule or cancellation email", async () => {
  const { f: original, id } = await seeded();
  for (const action of ["reschedule", "cancelled"]) {
    const f = fixture({ actor: { role: "admin", uid: "admin" }, failCommit: true, records: Object.fromEntries(original.records) });
    assert.equal((await update(f, id, { action, requestId: "failing-action-00001", confirmedDate: "2099-10-26", confirmedTime: "10:00" })).status, 503);
    assert.equal(f.calls.smtp.length, 0);
    assert.equal(f.records.get(`consultationBookings/${id}`).confirmedDate, "2099-10-25");
    assert.equal(f.values("consultationEmailEvents").length, 2);
  }
});

test("a lost action response resumes its pending email once without repeating the schedule change", async () => {
  const { f: original, id } = await seeded();
  const f = fixture({ actor: { role: "admin", uid: "admin" }, throwAfterCommit: true, records: Object.fromEntries(original.records) });
  const body = { action: "reschedule", requestId: "lost-response-action-0001", confirmedDate: "2099-10-26", confirmedTime: "10:00" };
  assert.equal((await update(f, id, body)).status, 503);
  assert.equal(f.calls.smtp.length, 0);
  assert.equal((await update(f, id, body)).status, 200);
  assert.equal((await update(f, id, body)).status, 200);
  assert.equal(f.calls.smtp.length, 1);
  assert.equal(f.values("auditLogs").filter((item) => item.module === "consultationBookings").length, 2);
  assert.equal(f.values("notifications").filter((item) => item.recipientId === "patient").length, 1);
});

test("schedule validation uses India care dates, excludes past times and never reverses day/month", () => {
  const { validConsultationSchedule } = loadTypeScript("features/consultations/schedule.ts");
  const now = new Date("2099-10-25T04:30:00Z"); // 10:00 IST
  assert.equal(validConsultationSchedule("2099-10-25", "09:30", "11:45", "09:59", now), false);
  assert.equal(validConsultationSchedule("2099-10-25", "09:30", "11:45", "10:01", now), true);
  assert.equal(validConsultationSchedule("2099-10-25", "09:30", "11:45", undefined, now), true);
  assert.equal(validConsultationSchedule("25/10/2099", "09:30", "11:45", "10:01", now), false);
});

test("assigned consultants receive independent branded emails for booking, reschedule and Admin cancellation once per event", async () => {
  const { f, id } = await seeded();
  assert.equal(f.calls.consultantSmtp.length, 1);
  const first = f.calls.consultantSmtp[0];
  assert.equal(first.to, consultant.email);
  assert.match(first.text, /Hello Assigned Professional,/);
  assert.match(first.text, /Consumer: Patient/);
  assert.match(first.text, /09:30 - 11:45 IST/);
  assert.match(first.text, /Booking reference:/);
  assert.doesNotMatch(first.text, /My Bookings|dashboard|Please help with pregnancy lifestyle/);
  assert.match(first.html, /#1f3d2b/);
  assert.equal((await create(f)).status, 200);
  assert.equal(f.calls.consultantSmtp.length, 1);
  f.actor.role = "admin"; f.actor.uid = "admin";
  const reschedule = { action: "reschedule", requestId: "consultant-reschedule-001", confirmedDate: "2099-10-26", confirmedTime: "10:15" };
  const response = await update(f, id, reschedule);
  assert.equal((await response.json()).consultantEmail.status, "accepted");
  assert.equal((await update(f, id, reschedule)).status, 200);
  assert.equal(f.calls.consultantSmtp.length, 2);
  assert.match(f.calls.consultantSmtp[1].text, /Original appointment date: 25\/10\/2099/);
  assert.match(f.calls.consultantSmtp[1].text, /Updated appointment date: 26\/10\/2099/);
  const cancellation = { action: "cancelled", requestId: "consultant-cancellation-001" };
  assert.equal((await update(f, id, cancellation)).status, 200);
  assert.equal((await update(f, id, cancellation)).status, 200);
  assert.equal(f.calls.consultantSmtp.length, 3);
  assert.match(f.calls.consultantSmtp[2].text, /Original appointment date: 26\/10\/2099/);
  assert.match(f.calls.consultantSmtp[2].text, /Original appointment time: 10:15 IST/);
  assert.equal(f.calls.smtp.length, 3);
});

test("consultant and consumer mail failures do not block each other or replay on retries", async () => {
  for (const options of [{ failConsultantEmail: true }, { failEmail: true }]) {
    const { f, id } = await seeded(options);
    assert.equal(f.calls.smtp.length, 1); assert.equal(f.calls.consultantSmtp.length, 1);
    f.actor.role = "admin"; f.actor.uid = "admin";
    const body = { action: "cancelled", requestId: "independent-email-0001" };
    const response = await update(f, id, body); assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.email.status, options.failEmail ? "failed" : "accepted");
    assert.equal(result.consultantEmail.status, options.failConsultantEmail ? "failed" : "accepted");
    assert.equal((await update(f, id, body)).status, 200);
    assert.equal(f.calls.smtp.length, 2); assert.equal(f.calls.consultantSmtp.length, 2);
    if (options.failConsultantEmail) {
      assert.ok(f.values("notifications").some((record) => record.recipientId === "admin" && record.message.includes("Consultant email could not be confirmed")));
      assert.equal(f.values("consultationEmailEvents").filter((record) => record.audience === "consultant" && record.failureReason === "email_not_confirmed").length, 2);
    }
  }
});

test("missing or invalid consultant email is recorded and visible to Admin without blocking the appointment or consumer email", async () => {
  for (const email of [undefined, "", "invalid"]) {
    const { f, id } = await seeded({ records: { "consultants/AS001": { ...consultant, email } } });
    assert.equal(f.records.get(`consultationBookings/${id}`).status, "confirmed");
    assert.equal(f.calls.smtp.length, 1); assert.equal(f.calls.consultantSmtp.length, 0);
    const failure = f.values("consultationEmailEvents").find((record) => record.audience === "consultant");
    assert.equal(failure.status, "failed");
    assert.equal(failure.channel, "email");
    assert.equal(failure.failureReason, email ? "invalid_email" : "missing_email");
    assert.ok(failure.updatedAt);
    assert.ok(f.values("notifications").some((record) => record.recipientId === "admin" && record.message.includes("email is missing or invalid")));
    await create(f);
    assert.equal(f.calls.smtp.length, 1); assert.equal(f.calls.consultantSmtp.length, 0);
  }
});

test("cancellation reads the assigned consultant's current email and never targets another provider", async () => {
  const { f, id } = await seeded();
  f.records.set("consultants/AS001", { ...consultant, email: "updated.consultant@example.com" });
  f.records.set("consultants/AS002", { ...consultant, email: "other.consultant@example.com" });
  f.actor.role = "admin"; f.actor.uid = "admin";
  assert.equal((await update(f, id, { action: "cancelled", requestId: "updated-contact-0001" })).status, 200);
  assert.equal(f.calls.consultantSmtp[1].to, "updated.consultant@example.com");
  assert.ok(f.calls.consultantSmtp.every((message) => message.to !== "other.consultant@example.com"));
});

test("public consultant projection is an explicit whitelist, excludes private records and supports zero charges", () => {
  const { publicConsultantProjection } = loadTypeScript("features/consultations/publicProjection.ts");
  const projected = publicConsultantProjection("AS001", consultant, "prenatal-doctor");
  assert.deepEqual(Object.keys(projected).sort(), ["id", "imageUrl", "name", "designation", "qualification", "yearsExperience", "consultantCharge", "preferredTimeSlots", "preferredSlotTimings", "preferredDays", "availableDates"].sort());
  assert.equal(publicConsultantProjection("AS001", { ...consultant, consultationServices: undefined }, "prenatal-doctor"), null);
  assert.equal(publicConsultantProjection("AS001", { ...consultant, consultantCharge: 0 }, "prenatal-doctor").consultantCharge, 0);
  assert.equal(publicConsultantProjection("AS001", { ...consultant, preferredSlotTimings: { morning: { startTime: "25:00", endTime: "26:00" } } }, "prenatal-doctor"), null);
});

test("rules retain Admin-only raw consultant reads and server-only consultation writes with scoped Consumer reads", () => {
  // Source-contract coverage only; deployment/emulator permissions require separate validation.
  const rules = readFileSync("firestore.rules", "utf8");
  const match = rules.split("match /consultationBookings/{bookingId} {")[1].split("\n    }")[0];
  assert.match(match, /isAdmin\(\) \|\| \(isConsumer\(\) && resource.data.consumerId == request.auth.uid\)/);
  assert.match(match, /allow create, update, delete: if false/);
  const deliveryRule = rules.split("match /consultationEmailEvents/{eventId} {")[1].split("\n    }")[0];
  assert.match(deliveryRule, /allow read, write: if false/);
  assert.match(rules.split("match /consultants/{consultantId} {")[1], /^\s*allow read: if isAdmin\(\)/);
  const indexes = JSON.parse(readFileSync("firestore.indexes.json", "utf8")).indexes;
  assert.ok(indexes.some((entry) => entry.collectionGroup === "consultants" && entry.fields.some((field) => field.fieldPath === "consultationServices" && field.arrayConfig === "CONTAINS")));
  assert.ok(indexes.some((entry) => entry.collectionGroup === "consultationBookings" && entry.fields.some((field) => field.fieldPath === "consumerId")));
});

test("exact consultant availability lookup stays bounded and cannot expose inactive or private data", async () => {
  let reads = 0;
  let data = { ...consultant, preferredDays: ["sun"], availableDates: ["2099-10-25"] };
  const { GET } = loadTypeScript("app/api/public/consultants/route.ts", {
    "@/services/firebase/admin": { getFirebaseAdminFirestore: () => ({ collection: () => ({ doc: (id) => ({
      get: async () => { reads++; return { id, exists: true, data: () => data }; },
    }) }) }) },
    "@/services/api/rateLimit": { allowRequest: () => true, requestFingerprint: () => "fixture" },
    "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status }), logApiError: () => {} },
  });
  assert.equal((await GET(new Request("https://test.local/api/public/consultants?service=prenatal-doctor&consultantId=../users"))).status, 400);
  assert.equal(reads, 0);
  const response = await GET(new Request("https://test.local/api/public/consultants?service=prenatal-doctor&consultantId=AS001"));
  const { consultant: provider } = await response.json();
  assert.deepEqual(provider.preferredDays, ["sun"]); assert.deepEqual(provider.availableDates, ["2099-10-25"]);
  for (const field of ["email", "contactNo", "address", "lastAuditId"]) assert.equal(field in provider, false);
  data = { ...data, status: "inactive" };
  assert.equal((await (await GET(new Request("https://test.local/api/public/consultants?service=prenatal-doctor&consultantId=AS001"))).json()).consultant, null);
  assert.equal(reads, 2);
});

test("public consultant API validates service/cursor, bounds reads and returns only the sanitized projection", async () => {
  const calls = [];
  const query = { where: (...args) => { calls.push(["where", ...args]); return query; }, orderBy: (...args) => { calls.push(["orderBy", ...args]); return query; },
    startAfter: (...args) => { calls.push(["startAfter", ...args]); return query; }, limit: (count) => { calls.push(["limit", count]); return query; },
    get: async () => ({ docs: Array.from({ length: 13 }, (_, i) => ({ id: `AS${String(i + 1).padStart(3, "0")}`, data: () => ({ ...consultant, employeeSequence: i + 1 }) })) }) };
  const { GET } = loadTypeScript("app/api/public/consultants/route.ts", {
    "@/services/firebase/admin": { getFirebaseAdminFirestore: () => ({ collection: (name) => { assert.equal(name, "consultants"); return query; } }) },
    "@/services/api/rateLimit": { allowRequest: () => true, requestFingerprint: () => "fixture" },
    "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status }), logApiError: () => {} },
  });
  for (const suffix of ["", "?service=unknown", "?service=prenatal-doctor&cursor=-1", "?service=prenatal-doctor&cursor=1.5"]) {
    assert.equal((await GET(new Request(`https://test.local/api/public/consultants${suffix}`))).status, 400);
  }
  assert.equal(calls.length, 0);
  const response = await GET(new Request("https://test.local/api/public/consultants?service=prenatal-doctor&cursor=4"));
  assert.equal(response.status, 200);
  const page = await response.json(); assert.equal(page.documents.length, 12); assert.equal(page.hasMore, true); assert.equal(page.cursor, 12);
  for (const item of page.documents) for (const key of ["email", "address", "contactNo", "emergencyContactNo", "lastAuditId"]) assert.equal(key in item, false);
  assert.deepEqual(calls, [["where", "status", "==", "active"], ["where", "consultationServices", "array-contains", "prenatal-doctor"], ["orderBy", "employeeSequence", "asc"], ["startAfter", 4], ["limit", 13]]);
});
