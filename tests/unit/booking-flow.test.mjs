import { test } from "node:test";
import assert from "node:assert/strict";
import { Timestamp } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { bookingFlowFixture, bookingTestRequest, validBookingInput } from "../helpers/bookingFlowFixture.mjs";

const createPath = "app/api/consumer/bookings/route.ts";
const referencePath = "app/api/bookings/references/route.ts";
const clearPath = "app/api/notifications/clear/route.ts";
const createRequest = (changes = {}) => bookingTestRequest("/api/consumer/bookings", { ...validBookingInput, ...changes });

test("confirmed booking, canonical reference, audit and correctly addressed bell notifications commit together", async () => {
  const f = bookingFlowFixture();
  const { POST } = f.load(createPath);
  const response = await POST(createRequest({ hospitalName: "Untrusted", serviceName: "Untrusted", status: "requested", confirmedTime: "11:30" }));
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.match(body.bookingReference, /^AYUR[A-Z0-9]{6}$/);
  const booking = f.values("bookings")[0];
  assert.equal(booking.bookingReference, body.bookingReference);
  assert.equal(booking.hospitalName, "Trusted centre");
  assert.equal(booking.serviceName, "7-day package");
  assert.equal(booking.servicePrice, 12000);
  assert.equal(booking.status, "confirmed");
  assert.equal(booking.confirmedDate.toMillis(), booking.preferredDate.toMillis());
  assert.equal(booking.confirmedTime, null);
  assert.equal(booking.treatmentStatus, "not_started");
  assert.deepEqual(booking.confirmedAt, booking.createdAt);
  assert.ok(booking.confirmedAt);
  assert.equal(f.values("auditLogs")[0].updatedValues.status, "confirmed");
  assert.equal(f.values("auditLogs").length, 1);
  assert.equal(f.values("bookingReferences").length, 1);
  const notifications = f.values("notifications");
  assert.deepEqual(notifications.map((item) => item.recipientId).sort(), ["admin", "partner"]);
  for (const item of notifications) {
    assert.equal(item.bookingReference, body.bookingReference);
    assert.equal(item.recordId, body.bookingId);
    assert.equal(item.actionHref, `/${item.recipientRole}/bookings?booking=${body.bookingId}`);
    assert.ok(item.message.includes("Trusted centre") && item.message.includes("7-day package") && item.message.includes("25/10/2099"));
    assert.match(item.message, /Booking confirmed/);
    assert.doesNotMatch(item.message, /awaiting/);
  }
  const retry = await POST(createRequest());
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).bookingReference, body.bookingReference);
  assert.equal(f.values("notifications").length, 2);
  assert.equal(f.values("bookings").length, 1);
});

test("automatic confirmation rejects blocked dates, invalid calendar dates and unauthorized callers", async () => {
  const blocked = { startDate: Timestamp.fromDate(new Date("2099-10-25T00:00:00+05:30")), endDate: Timestamp.fromDate(new Date("2099-10-27T00:00:00+05:30")) };
  for (const [options, input, expected] of [
    [{ records: { "hospitals/centre": { name: "Blocked", status: "active", isPublic: true, blockedDateRanges: [blocked] } } }, {}, 409],
    [{}, { preferredDate: "2099-02-30" }, 400],
    [{}, { preferredEndDate: "2099-11-31" }, 400],
    [{ actor: { role: "hospital" } }, {}, 403],
    [{ actor: { role: "admin" } }, {}, 403],
    [{ denied: true }, {}, 403],
  ]) {
    const f = bookingFlowFixture(options);
    assert.equal((await f.load(createPath).POST(createRequest(input))).status, expected);
    assert.equal(f.values("bookings").length, 0);
    assert.equal(f.values("notifications").length, 0);
    assert.equal(f.values("auditLogs").length, 0);
  }
});

test("simultaneous retries and a lost successful response do not duplicate bookings or notifications", async () => {
  const f = bookingFlowFixture();
  const { POST } = f.load(createPath);
  const responses = await Promise.all([POST(createRequest()), POST(createRequest()), POST(createRequest())]);
  const bodies = await Promise.all(responses.map((response) => response.json()));
  assert.equal(new Set(bodies.map((body) => body.bookingReference)).size, 1);
  assert.equal(f.values("bookings").length, 1);
  assert.equal(f.values("notifications").length, 2);
  const ambiguous = bookingFlowFixture({ throwAfterCommit: true });
  const route = ambiguous.load(createPath);
  assert.equal((await route.POST(createRequest())).status, 503);
  assert.equal((await route.POST(createRequest())).status, 200);
  assert.equal(ambiguous.values("notifications").length, 2);
  assert.equal(ambiguous.values("bookings").length, 1);
});

test("retrying a historical requested booking preserves its original status and timestamps", async () => {
  const id = createHash("sha256").update(`patient:${validBookingInput.requestId}`).digest("hex");
  const legacy = { consumerId: "patient", hospitalId: "centre", serviceId: "package", status: "requested", bookingReference: "AYUR000001", confirmedAt: null, confirmedDate: null, createdAt: Timestamp.fromMillis(1000) };
  const f = bookingFlowFixture({ records: { [`bookings/${id}`]: legacy } });
  const response = await f.load(createPath).POST(createRequest());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).duplicate, true);
  assert.deepEqual(f.records.get(`bookings/${id}`), legacy);
  assert.equal(f.values("notifications").length, 0);
});

test("reference collisions reserve a different value without overwriting the existing identity", async () => {
  let candidate = 0;
  const f = bookingFlowFixture({ randomInt: () => candidate++, records: { "bookingReferences/AYUR000000": { bookingId: "older-booking" } } });
  const response = await f.load(createPath).POST(createRequest());
  assert.equal(response.status, 201);
  assert.equal((await response.json()).bookingReference, "AYUR000001");
  assert.equal(f.records.get("bookingReferences/AYUR000000").bookingId, "older-booking");
});

test("invalid care, missing consent and failed commits never send a notification or partially create records", async () => {
  for (const options of [{ failCommit: true }, { records: { "services/package": { hospitalId: "different-centre", status: "active" } } }, { records: { "users/partner": { role: "hospital", hospitalId: "centre", status: "inactive" } } }]) {
    const f = bookingFlowFixture(options);
    assert.ok((await f.load(createPath).POST(createRequest())).status >= 400);
    assert.equal(f.values("bookings").length, 0);
    assert.equal(f.values("notifications").length, 0);
    assert.equal(f.values("bookingReferences").length, 0);
  }
  const f = bookingFlowFixture();
  assert.equal((await f.load(createPath).POST(createRequest({ bookingTermsAccepted: false }))).status, 400);
  assert.equal(f.values("notifications").length, 0);
});

test("legacy migration is ownership checked, audited and stable across portals without changing original document IDs", async () => {
  const legacy = { consumerId: "patient", hospitalId: "centre", serviceId: "package", status: "confirmed", createdBy: "original", servicePrice: 9000 };
  const f = bookingFlowFixture({ records: { "bookings/legacy": legacy } });
  const response = await f.load(referencePath).POST(bookingTestRequest("/api/bookings/references", { bookingIds: ["legacy"] }));
  const first = (await response.json()).references.legacy;
  assert.match(first, /^AYUR[A-Z0-9]{6}$/);
  f.actor.role = "admin";
  assert.equal((await (await f.load(referencePath).POST(bookingTestRequest("/api/bookings/references", { bookingIds: ["legacy"] }))).json()).references.legacy, first);
  assert.equal(f.values("bookings").length, 1);
  assert.equal(f.records.get("bookings/legacy").createdBy, "original");
  assert.equal(f.records.get("bookings/legacy").status, "confirmed");
  assert.equal(f.values("auditLogs").length, 1);
  assert.equal(f.values("notifications").length, 0);
  for (const actor of [{ uid: "other", role: "consumer" }, { uid: "wrong-partner", role: "hospital" }]) {
    const denied = bookingFlowFixture({ actor, profile: { hospitalId: "different-centre" }, records: { "bookings/legacy": legacy } });
    assert.equal((await denied.load(referencePath).POST(bookingTestRequest("/api/bookings/references", { bookingIds: ["legacy"] }))).status, 403);
    assert.equal(denied.values("auditLogs").length, 0);
  }
});

test("clear is confirmed, scoped to the recipient, persistent, audited and preserves notifications and bookings", async () => {
  const f = bookingFlowFixture({ actor: { uid: "admin", role: "admin" }, records: { "bookings/existing": { status: "confirmed" }, "notifications/old": { recipientId: "admin", message: "Historical message" } } });
  const { POST } = f.load(clearPath);
  assert.equal((await POST(bookingTestRequest("/api/notifications/clear", {}))).status, 400);
  assert.equal((await POST(bookingTestRequest("/api/notifications/clear", { confirmed: true, recipientId: "partner" }))).status, 200);
  assert.ok(f.records.get("notificationInboxes/admin").clearedThrough instanceof Timestamp);
  assert.equal(f.records.has("notificationInboxes/partner"), false);
  assert.equal(f.records.get("notifications/old").message, "Historical message");
  assert.equal(f.records.get("bookings/existing").status, "confirmed");
  assert.equal(f.values("auditLogs").length, 1);
  const future = Timestamp.fromDate(new Date("2099-01-01"));
  f.records.set("notificationInboxes/admin", { clearedThrough: future });
  assert.equal((await POST(bookingTestRequest("/api/notifications/clear", { confirmed: true }))).status, 200);
  assert.equal(f.records.get("notificationInboxes/admin").clearedThrough, future);
  const consumer = bookingFlowFixture();
  assert.equal((await consumer.load(clearPath).POST(bookingTestRequest("/api/notifications/clear", { confirmed: true }))).status, 403);
});
