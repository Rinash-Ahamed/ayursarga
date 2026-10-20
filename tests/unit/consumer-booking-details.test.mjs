import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
import { bookingFlowFixture, bookingTestRequest, validBookingInput } from "../helpers/bookingFlowFixture.mjs";

class AuthorizationError extends Error { constructor(message, status) { super(message); this.status = status; } }
function fixture(consumerId = "patient", denied = false) {
  const records = {
    "bookings/legacy": { consumerId, hospitalId: "centre", serviceId: "package", servicePrice: 12000 },
    "bookings/snapshot": { consumerId, hospitalId: "centre", serviceId: "package", hospitalName: "Original centre", serviceName: "Original package", hospitalLocation: "Original location" },
    "hospitals/centre": { name: "Renamed inactive centre", status: "inactive", city: "Palakkad", commissionPercentage: 20, contractUrl: "private" },
    "services/package": { name: "Package", hospitalId: "centre", packageDurationDays: 14, price: 35000 },
  };
  const reads = [];
  const firestore = {
    collection: (collection) => ({ doc: (id) => ({ id, path: `${collection}/${id}` }) }),
    getAll: async (...args) => {
      const options = args.pop();
      reads.push({ paths: args.map((ref) => ref.path), mask: options.fieldMask });
      return args.map((ref) => ({ id: ref.id, exists: Boolean(records[ref.path]), data: () => records[ref.path] }));
    },
  };
  const route = loadTypeScript("app/api/consumer/bookings/route.ts", {
    "@/services/firebase/adminAuthorization": { requireActiveUser: async (_request, roles) => {
      assert.deepEqual(roles, ["consumer"]);
      if (denied) throw new AuthorizationError("Denied", 403);
      return { uid: "patient", firestore };
    }, AdminAuthorizationError: AuthorizationError },
    "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } }), logApiError: () => {} },
    "@/services/api/rateLimit": { allowRequest: () => true, requestFingerprint: () => "test" },
  });
  return { ...route, reads };
}

test("owned legacy bookings resolve inactive centre labels with bounded field projections", async () => {
  const { GET, reads } = fixture();
  const response = await GET(new Request("https://test.local/api/consumer/bookings?id=legacy&id=snapshot"));
  assert.equal(response.status, 200);
  const { details } = await response.json();
  assert.deepEqual(details.legacy, { hospitalName: "Renamed inactive centre", hospitalLocation: "Palakkad", serviceName: "14-day package" });
  assert.deepEqual(details.snapshot, { hospitalName: "Original centre", hospitalLocation: "Original location", serviceName: "Original package" });
  assert.equal(reads.length, 3);
  assert.deepEqual(reads[1].paths, ["hospitals/centre"]);
  assert.ok(reads.every((read) => !read.mask.includes("commissionPercentage") && !read.mask.includes("contractUrl")));
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("other consumers, unauthenticated callers, and oversized or invalid lists cannot retrieve details", async () => {
  for (const [consumer, denied] of [["other-consumer", false], ["patient", true]]) {
    const { GET, reads } = fixture(consumer, denied);
    assert.equal((await GET(new Request("https://test.local/api/consumer/bookings?id=legacy"))).status, 403);
    assert.ok(reads.length <= 1);
  }
  const { GET, reads } = fixture();
  for (const query of ["", "id=bad/path", Array.from({ length: 21 }, (_, index) => `id=${index}`).join("&")]) {
    assert.equal((await GET(new Request(`https://test.local/api/consumer/bookings?${query}`))).status, 400);
  }
  assert.equal(reads.length, 0);
});

test("new requests atomically snapshot server-owned care names, not caller labels", async () => {
  const f = bookingFlowFixture();
  const { POST } = f.load("app/api/consumer/bookings/route.ts");
  const response = await POST(bookingTestRequest("/api/consumer/bookings", { ...validBookingInput, hospitalName: "Untrusted centre", serviceName: "Untrusted package" }));
  assert.equal(response.status, 201);
  const booking = f.values("bookings")[0];
  assert.equal(booking.hospitalName, "Trusted centre");
  assert.equal(booking.serviceName, "7-day package");
  assert.equal(booking.servicePrice, 12000);
  assert.equal(f.values("auditLogs")[0].updatedValues.bookingReference, booking.bookingReference);
});
