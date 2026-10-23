import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bookingFlowFixture } from "../helpers/bookingFlowFixture.mjs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const consultant = { name: "Assigned Professional", designation: "Ayurvedic physician", qualification: "BAMS", yearsExperience: 3.5,
  status: "active", employeeSequence: 1, archivedAt: null, consultationServices: ["prenatal-doctor"], consultantCharge: 900.5,
  preferredTimeSlots: ["morning"], preferredSlotTimings: { morning: { startTime: "09:30", endTime: "11:45" } },
  email: "private@example.com", contactNo: "9876543210", address: "Private address", emergencyContactNo: "9876543210", lastAuditId: "secret-audit" };
const input = { consultantId: "AS001", serviceId: "prenatal-doctor", preferredDate: "2099-10-25", preferredTimeSlot: "morning",
  expectedSlotStartTime: "09:30", expectedSlotEndTime: "11:45",
  bookingTermsAccepted: true, expectedCharge: 900.5, requestId: "consultation-attempt-0001", consumerNotes: "Please help with pregnancy lifestyle." };
const fixture = (options = {}) => bookingFlowFixture({ ...options, records: { "consultants/AS001": consultant, ...options.records } });
const request = (body, method = "POST") => new Request("https://test.local/api/consumer/consultations", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
async function create(f, body = input) { return f.load("app/api/consumer/consultations/route.ts").POST(request(body)); }
async function update(f, id, body) { return f.load("app/api/consultations/[bookingId]/route.ts").PATCH(request(body, "PATCH"), { params: Promise.resolve({ bookingId: id }) }); }

test("consultation creation snapshots actual charge, provider, Consumer and consent with one atomic audit and Admin bell", async () => {
  const f = fixture();
  const response = await create(f, { ...input, consultantCharge: 1, status: "confirmed", consumerId: "other", consultantName: "Untrusted" });
  assert.equal(response.status, 201);
  const { bookingId } = await response.json();
  const record = f.records.get(`consultationBookings/${bookingId}`);
  assert.equal(record.consumerId, "patient"); assert.equal(record.consultantName, consultant.name);
  assert.equal(record.consultantCharge, 900.5); assert.equal(record.status, "requested");
  assert.equal(f.calls.emails.length, 0);
  assert.equal(record.slotStartTime, "09:30"); assert.equal(record.consumerPhone, "9876543210");
  assert.ok(record.bookingTermsAcceptedAt); assert.ok(record.bookingTermsVersion);
  assert.ok(f.records.get(`auditLogs/${record.lastAuditId}`));
  const notifications = f.values("notifications");
  assert.equal(notifications.length, 1); assert.equal(notifications[0].recipientId, "admin");
  assert.equal(notifications[0].type, "consultation_updated"); assert.match(notifications[0].actionHref, /\/admin\/bookings\/consultations\?booking=/);
  assert.equal(f.values("bookings").length, 0); // Hospital booking schema/workflow stays independent.
});

test("duplicate, concurrent and lost-response retries create one appointment and never replay notifications", async () => {
  for (const throwAfterCommit of [false, true]) {
    const f = fixture({ throwAfterCommit });
    const responses = await Promise.all([create(f), create(f)]);
    assert.deepEqual(responses.map((value) => value.status), throwAfterCommit ? [503, 200] : [201, 200]);
    assert.equal(f.values("consultationBookings").length, 1); assert.equal(f.values("auditLogs").length, 1); assert.equal(f.values("notifications").length, 1);
    assert.equal((await create(f, { ...input, preferredDate: "2099-10-26" })).status, 409);
  }
});

test("invalid consent, profile, service, time window and date cannot create an appointment", async () => {
  for (const changes of [{ bookingTermsAccepted: false }, { serviceId: "made-up" }, { preferredTimeSlot: "evening" }, { preferredDate: "25/10/2099" }, { preferredDate: "2099-02-30" }, { consumerNotes: "x".repeat(501) }, { requestId: "short" }]) {
    const f = fixture(); assert.ok((await create(f, { ...input, ...changes })).status >= 400); assert.equal(f.values("auditLogs").length, 0);
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
  for (const collection of ["consultationBookings", "bookingReferences", "auditLogs", "notifications"]) assert.equal(f.values(collection).length, 0);
});

async function seeded(options = {}) {
  const f = fixture(options); const response = await create(f); assert.equal(response.status, 201);
  return { f, id: (await response.json()).bookingId };
}

test("Admin confirmation and completion preserve price, consent and provider snapshots and notify the Consumer once", async () => {
  const { f, id } = await seeded();
  f.actor.role = "admin"; f.actor.uid = "admin";
  const body = { status: "confirmed", confirmedDate: "2099-10-25", confirmedTime: "10:15", adminNotes: "Please be ready five minutes before your consultation.", consultantCharge: 1 };
  assert.equal((await update(f, id, body)).status, 200);
  assert.equal((await update(f, id, body)).status, 200);
  const saved = f.records.get(`consultationBookings/${id}`);
  assert.equal(saved.status, "confirmed"); assert.equal(saved.confirmedTime, "10:15"); assert.equal(saved.consultantCharge, 900.5);
  assert.equal(f.calls.emails.length, 1);
  assert.equal(f.calls.emails[0].kind, "consultation");
  assert.equal(f.calls.emails[0].booking.consumerEmail, "patient@example.com");
  assert.equal(f.calls.emails[0].booking.confirmedTime, "10:15");
  assert.equal(f.values("notifications").filter((item) => item.recipientId === "patient").length, 1);
  assert.equal(f.values("auditLogs").length, 2);
  assert.equal((await update(f, id, { status: "completed" })).status, 200);
  assert.equal(f.calls.emails.length, 1);
  assert.equal((await update(f, id, body)).status, 409);
  assert.ok(f.records.get(`consultationBookings/${id}`).completedAt);
});

test("Consumer can cancel only their own pending or confirmed consultation; Hospital cannot update any", async () => {
  const { f, id } = await seeded();
  assert.equal((await update(f, id, { status: "confirmed" })).status, 403);
  f.actor.uid = "stranger"; assert.equal((await update(f, id, { status: "cancelled" })).status, 403);
  f.actor.role = "hospital"; assert.equal((await update(f, id, { status: "cancelled" })).status, 403);
  f.actor.role = "consumer"; f.actor.uid = "patient";
  assert.equal((await update(f, id, { status: "cancelled", adminNotes: "Not allowed" })).status, 200);
  const saved = f.records.get(`consultationBookings/${id}`);
  assert.equal(saved.status, "cancelled"); assert.equal(saved.adminNotes, null);
  assert.equal(f.values("notifications").filter((entry) => entry.recipientId === "admin").length, 2);
});

test("Admin cannot confirm outside a preferred window, against inactive providers, or skip transitions", async () => {
  const { f, id } = await seeded(); f.actor.role = "admin"; f.actor.uid = "admin";
  for (const confirmedTime of ["09:00", "11:45", "19:00", "10:99", "invalid"]) {
    assert.equal((await update(f, id, { status: "confirmed", confirmedDate: "2099-10-25", confirmedTime })).status, 400);
  }
  assert.equal((await update(f, id, { status: "completed" })).status, 409);
  f.records.set("consultants/AS001", { ...consultant, status: "inactive" });
  assert.equal((await update(f, id, { status: "confirmed", confirmedDate: "2099-10-25", confirmedTime: "10:00" })).status, 409);
  assert.equal(f.values("auditLogs").length, 1); assert.equal(f.values("notifications").length, 1);
});

test("public consultant projection is an explicit whitelist, excludes private records and supports zero charges", () => {
  const { publicConsultantProjection } = loadTypeScript("features/consultations/publicProjection.ts");
  const projected = publicConsultantProjection("AS001", consultant, "prenatal-doctor");
  assert.deepEqual(Object.keys(projected).sort(), ["id", "name", "designation", "qualification", "yearsExperience", "consultantCharge", "preferredTimeSlots", "preferredSlotTimings"].sort());
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
  assert.match(rules.split("match /consultants/{consultantId} {")[1], /^\s*allow read: if isAdmin\(\)/);
  const indexes = JSON.parse(readFileSync("firestore.indexes.json", "utf8")).indexes;
  assert.ok(indexes.some((entry) => entry.collectionGroup === "consultants" && entry.fields.some((field) => field.fieldPath === "consultationServices" && field.arrayConfig === "CONTAINS")));
  assert.ok(indexes.some((entry) => entry.collectionGroup === "consultationBookings" && entry.fields.some((field) => field.fieldPath === "consumerId")));
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
