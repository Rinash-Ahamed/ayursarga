import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
import { bookingFlowFixture, bookingTestRequest } from "../helpers/bookingFlowFixture.mjs";

const historyPath = "app/api/consumer/booking-history/route.ts";
const date = Timestamp.fromDate(new Date("2099-10-25T00:00:00+05:30"));
const booking = { consumerId: "patient", hospitalId: "centre", serviceId: "package", hospitalName: "Centre", serviceName: "7-day package",
  bookingReference: "AYURTEST", servicePrice: 12000, commissionPercentage: 10, estimatedCommission: 1200,
  privateFutureField: "never public", createdBy: "private-actor", consumerEmail: "private@example.com",
  createdAt: date, preferredDate: date, status: "confirmed", treatmentStatus: "not_started", lastAuditId: "opened-revision", archivedAt: null };
const url = query => new Request(`https://test.local/api/consumer/booking-history${query}`);

test("owned history and detail whitelist fields even when the database returns all operational fields", async () => {
  const f = bookingFlowFixture({ records: { "bookings/one": booking, "bookings/other": { ...booking, consumerId: "another" } } });
  const { GET } = f.load(historyPath);
  for (const query of ["", "?id=one"]) {
    const response = await GET(url(query));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.documents.length, 1);
    assert.equal(body.documents[0].id, "one");
    assert.equal(body.documents[0].servicePrice, 12000);
    assert.equal(body.documents[0].lastAuditId, "opened-revision");
    assert.deepEqual(body.documents[0].preferredDate.__ayursargaTimestamp, [date.seconds, date.nanoseconds]);
    for (const key of ["commissionPercentage", "estimatedCommission", "privateFutureField", "createdBy", "consumerEmail", "consumerId", "archivedAt"]) assert.equal(Object.hasOwn(body.documents[0], key), false, key);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.ok(f.calls.fields.every(fields => !fields.includes("commissionPercentage") && !fields.includes("estimatedCommission")));
  assert.equal(f.calls.commits, 0);
});

test("history pages preserve cursor progress, archived filtering and owner scoping", async () => {
  const f = bookingFlowFixture({ records: {
    "bookings/c": { ...booking, archivedAt: date }, "bookings/b": booking, "bookings/a": booking,
    "bookings/foreign": { ...booking, consumerId: "another" },
  } });
  const { GET } = f.load(historyPath);
  const first = await (await GET(url("?pageSize=1"))).json();
  assert.deepEqual(first.documents, []); assert.equal(first.cursor, "c"); assert.equal(first.hasMore, true);
  const second = await (await GET(url("?pageSize=1&cursor=c"))).json();
  assert.equal(second.documents[0].id, "b"); assert.equal(second.cursor, "b"); assert.equal(second.hasMore, true);
  const last = await (await GET(url("?pageSize=1&cursor=b"))).json();
  assert.equal(last.documents[0].id, "a"); assert.equal(last.hasMore, false);
  assert.equal((await GET(url("?cursor=foreign"))).status, 400);
  for (const query of ["?id=foreign", "?id=missing", "?id=c"]) assert.equal((await GET(url(query))).status, 404);
});

test("history rejects roles and malformed or excessive paging without leaking records", async () => {
  for (const options of [{ denied: true }, { actor: { role: "admin" } }, { actor: { role: "hospital" } }]) {
    assert.equal((await bookingFlowFixture(options).load(historyPath).GET(url(""))).status, 403);
  }
  const { GET } = bookingFlowFixture().load(historyPath);
  for (const query of ["?pageSize=21", "?pageSize=0", "?pageSize=1.5", "?pageSize=no", "?cursor=bad/path", "?id=", "?id=one&cursor=one"]) {
    assert.equal((await GET(url(query))).status, 400, query);
  }
});

test("consumer cancellation response does not expose financial snapshots and preserves the stored commission", async () => {
  const f = bookingFlowFixture({ records: { "bookings/one": booking } });
  const response = await f.load("app/api/bookings/[bookingId]/cancel/route.ts").POST(
    bookingTestRequest("/api/bookings/one/cancel", { cancellationReason: "Plans have changed", expectedAuditId: booking.lastAuditId }),
    { params: Promise.resolve({ bookingId: "one" }) });
  assert.equal(response.status, 200);
  assert.doesNotMatch(JSON.stringify(await response.json()), /commission|estimatedCommission|privateFutureField/i);
  assert.equal(f.records.get("bookings/one").estimatedCommission, 1200);
  assert.equal(f.records.get("bookings/one").commissionPercentage, 10);
});

test("consumer service uses the authenticated projection while operational access and rules stay separate", async () => {
  const calls = [];
  const service = loadTypeScript("services/bookings/bookingService.ts", {
    "@/services/firestore/firestoreService": {
      readDocument: async () => { throw new Error("Unexpected full document read"); },
      runFilteredQuery: async () => { throw new Error("Unexpected full collection query"); },
    },
    "@/services/api/client": {
      decodeMutation: value => value,
      authorizedApiRequest: async url => { calls.push(url); return { documents: [{ id: "one", bookingReference: "AYURTEST", servicePrice: 12000 }], cursor: "one", hasMore: true }; },
    },
  });
  assert.equal((await service.listConsumerBookings({ pageSize: 20, cursor: "previous" })).documents[0].id, "one");
  assert.equal((await service.getConsumerBooking("one")).servicePrice, 12000);
  assert.match(calls[0], /^\/api\/consumer\/booking-history\?pageSize=20&cursor=previous$/);
  assert.equal(calls.some(url => url.includes("untrusted-user")), false);
  const rules = readFileSync("firestore.rules", "utf8").split("match /bookings/{bookingId} {")[1].split("allow create:")[0];
  assert.match(rules, /isAdmin\(\)/); assert.match(rules, /hasOperationalHospitalAccess/); assert.doesNotMatch(rules, /isConsumer\(/);
  const consumer = readFileSync("components/consumer/ConsumerBookings.tsx", "utf8");
  assert.doesNotMatch(consumer, /getPortalBooking|BookingDocument/);
});
