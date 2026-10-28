import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { bookingFlowFixture, bookingTestRequest, validBookingInput } from "../helpers/bookingFlowFixture.mjs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const createPath = "app/api/hospital/services/route.ts";
const updatePath = "app/api/hospital/services/[serviceId]/route.ts";
const reviewPath = "app/api/admin/hospitals/[hospitalId]/packages/route.ts";
const context = (key, id) => ({ params: Promise.resolve({ [key]: id }) });
const payload = { packageDurationDays: 7, price: 14000, description: "Reviewed care", procedures: { headMassage: 3 }, otherProcedures: [] };
const draft = { ...payload, name: "7-day package", otherProcedureName: null, otherProcedureDays: null };
const pending = { hospitalId: "centre", status: "inactive", ...draft, reviewStatus: "pending", draftPackage: draft, publishedAt: null, lastAuditId: "request-audit" };
function fixture(options = {}) {
  const f = bookingFlowFixture({ actor: { uid: "partner", role: "hospital" }, ...options,
    overrides: { "@/services/firebase/admin": { isFirebaseAdminReady: () => true } },
  });
  f.firestore.batch = () => {
    const operations = [];
    const batch = Object.fromEntries(["set", "create", "update"].map((method) => [method, (...args) => { operations.push([method, args]); return batch; }]));
    batch.commit = () => f.firestore.runTransaction(async (tx) => operations.forEach(([method, args]) => tx[method](...args)));
    return batch;
  };
  const patch = (body, id = "package") => f.load(updatePath).PATCH(bookingTestRequest("/api/hospital/services/package", body), context("serviceId", id));
  const review = (action = "approve", entries = [{ id: "package", auditId: "request-audit" }], reason = "", hospitalId = "centre") =>
    f.load(reviewPath).POST(bookingTestRequest("/api/admin/hospitals/centre/packages", { action, packages: entries, reason }), context("hospitalId", hospitalId));
  return { ...f, patch, review };
}

test("new packages are private validated drafts, with atomic audit and no client-controlled approval", async () => {
  const f = fixture();
  const response = await f.load(createPath).POST(bookingTestRequest("/api/hospital/services", { ...payload, status: "active", reviewStatus: "approved", publishedAt: "forged" }));
  assert.equal(response.status, 201);
  const service = f.values("services").find((item) => item.id !== "package");
  assert.equal(service.status, "inactive");
  assert.equal(service.reviewStatus, "draft");
  assert.equal(service.publishedAt, null);
  assert.equal(service.draftPackage.price, 14000);
  assert.equal(f.values("auditLogs")[0].updatedValues.lastAuditId, service.lastAuditId);
});

test("editing an approved or legacy package changes only its draft, not public price or status", async () => {
  for (const metadata of [{}, { reviewStatus: "approved", publishedAt: Timestamp.fromMillis(1000) }]) {
    const f = fixture({ records: { "services/package": { ...pending, ...metadata, reviewStatus: metadata.reviewStatus, publishedAt: metadata.publishedAt, draftPackage: null, status: "active", price: 12000 } } });
    assert.equal((await f.patch({ action: "update", data: { ...payload, price: 20000, reviewStatus: "approved" } })).status, 200);
    const service = f.records.get("services/package");
    assert.equal(service.price, 12000);
    assert.equal(service.status, "active");
    assert.equal(service.draftPackage.price, 20000);
    assert.equal(service.reviewStatus, "draft");
    assert.ok(service.publishedAt);
  }
});

test("submit queues one addressed Admin notification; retried pending submissions do not duplicate", async () => {
  const f = fixture({ records: { "services/package": { ...pending, reviewStatus: "draft" } } });
  assert.equal((await f.patch({ action: "submit", expectedAuditId: "request-audit" })).status, 200);
  assert.equal(f.records.get("services/package").reviewStatus, "pending");
  assert.equal(f.values("notifications").length, 1);
  assert.equal(f.values("notifications")[0].recipientId, "admin");
  assert.match(f.values("notifications")[0].actionHref, /\/admin\/hospitals\/centre/);
  assert.equal((await f.patch({ action: "submit" })).status, 200);
  assert.equal(f.values("auditLogs").length, 1);
  assert.equal(f.values("notifications").length, 1);
});

test("unapproved packages cannot be activated and other hospitals cannot edit or submit them", async () => {
  const f = fixture({ records: { "services/package": pending } });
  assert.equal((await f.patch({ action: "status", data: { status: "active" } })).status, 409);
  f.records.set("services/package", { ...pending, hospitalId: "different-centre" });
  for (const action of ["submit", "update", "status", "archive"]) assert.equal((await f.patch({ action, data: payload })).status, 404);
  assert.equal(f.values("auditLogs").length, 0);
});

test("Admin can approve individually or in a hospital-scoped bulk transaction; retries are idempotent", async () => {
  for (const count of [1, 3]) {
    const records = Object.fromEntries(Array.from({ length: count }, (_, index) => [`services/package-${index}`, { ...pending, lastAuditId: `request-${index}` }]));
    const f = fixture({ actor: { uid: "admin", role: "admin" }, records });
    const entries = Array.from({ length: count }, (_, index) => ({ id: `package-${index}`, auditId: `request-${index}` }));
    const response = await f.review("approve", entries);
    assert.equal(response.status, 200);
    for (const entry of entries) {
      const service = f.records.get(`services/${entry.id}`);
      assert.equal(service.reviewStatus, "approved");
      assert.equal(service.status, "active");
      assert.equal(service.draftPackage, null);
      assert.equal(service.price, 14000);
      assert.equal(service.reviewedRequestAuditId, entry.auditId);
      assert.equal(f.records.get(`auditLogs/${service.lastAuditId}`).updatedValues.reviewStatus, "approved");
    }
    assert.equal(f.values("notifications").length, count);
    assert.ok(f.values("notifications").every((item) => item.recipientId === "partner"));
    const retry = await f.review("approve", entries);
    assert.equal(retry.status, 200);
    const responseBody = await retry.json();
    assert.equal(responseBody.changes.packages[entries[0].id].reviewStatus, "approved");
    assert.equal(f.values("auditLogs").length, count);
    assert.equal(f.values("notifications").length, count);
  }
});

test("stale revisions, cross-hospital selections, archived records and invalid drafts abort the whole review", async () => {
  for (const changes of [{ lastAuditId: "newer" }, { hospitalId: "different-centre" }, { status: "archived" }, { draftPackage: { ...draft, price: 0 } }, { reviewStatus: "draft" }]) {
    const f = fixture({ actor: { role: "admin" }, records: { "services/package": pending, "services/second": { ...pending, ...changes } } });
    const result = await f.review("approve", [{ id: "package", auditId: "request-audit" }, { id: "second", auditId: "request-audit" }]);
    assert.ok(result.status >= 400);
    assert.equal(f.records.get("services/package").reviewStatus, "pending");
    assert.equal(f.values("auditLogs").length, 0);
    assert.equal(f.values("notifications").length, 0);
  }
});

test("changes requested preserves a published version, requires a reason and supports editing/resubmitting", async () => {
  const f = fixture({ actor: { uid: "admin", role: "admin" }, records: { "services/package": { ...pending, status: "active", price: 12000, publishedAt: Timestamp.now() } } });
  assert.equal((await f.review("request_changes")).status, 400);
  assert.equal((await f.review("request_changes", undefined, "Please correct the procedures.")).status, 200);
  assert.equal(f.records.get("services/package").price, 12000);
  assert.equal(f.records.get("services/package").reviewStatus, "changes_requested");
  f.actor.role = "hospital";
  f.profile.hospitalId = "centre";
  assert.equal((await f.patch({ action: "update", data: payload })).status, 200);
  assert.equal((await f.patch({ action: "submit" })).status, 200);
  assert.equal(f.records.get("services/package").reviewStatus, "pending");
});

test("consumer and Hospital cannot review packages; malformed and oversized selections are rejected", async () => {
  for (const role of ["consumer", "hospital"]) {
    const f = fixture({ actor: { role }, records: { "services/package": pending } });
    assert.equal((await f.review()).status, 403);
    assert.equal(f.values("auditLogs").length, 0);
  }
  const f = fixture({ actor: { role: "admin" } });
  for (const entries of [[], Array(21).fill({ id: "package", auditId: "request-audit" }), [{ id: "package", auditId: "" }], Array(2).fill({ id: "package", auditId: "request-audit" })]) assert.equal((await f.review("approve", entries)).status, 400);
  assert.equal((await f.review(["approve"])).status, 400);
});

test("simultaneous approvals notify once; failed commits cannot partially publish or notify", async () => {
  const f = fixture({ actor: { role: "admin" }, records: { "services/package": pending } });
  const results = await Promise.all([f.review(), f.review()]);
  assert.ok(results.every((result) => result.status === 200));
  assert.equal(f.values("auditLogs").length, 1);
  assert.equal(f.values("notifications").length, 1);
  const failed = fixture({ actor: { role: "admin" }, failCommit: true, records: { "services/package": pending } });
  assert.equal((await failed.review()).status, 503);
  assert.equal(failed.records.get("services/package").status, "inactive");
  assert.equal(failed.values("auditLogs").length, 0);
  assert.equal(failed.values("notifications").length, 0);
});

test("booking uses approved price while a replacement awaits review; unapproved packages fail closed", async () => {
  for (const published of [false, true]) {
    const f = fixture({ actor: { uid: "patient", role: "consumer" }, records: { "services/package": { ...pending, status: "active", price: 12000, publishedAt: published ? Timestamp.now() : null } } });
    const response = await f.load("app/api/consumer/bookings/route.ts").POST(bookingTestRequest("/api/consumer/bookings", validBookingInput));
    assert.equal(response.status, published ? 201 : 409);
    if (published) assert.equal(f.values("bookings")[0].servicePrice, 12000);
  }
});

test("rules deny every direct service mutation, including legacy write and changed-field bypasses", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const block = rules.slice(rules.indexOf("match /services/{serviceId}"), rules.indexOf("match /bookings/{bookingId}"));
  assert.match(block, /allow read: if isAdmin\(\) \|\| hasOperationalHospitalAccess/);
  assert.match(block, /allow create, update, delete: if false;/);
  assert.doesNotMatch(block, /allow (?:create|update):/);
});

test("stable draft creation IDs prevent concurrent and lost-response retries from duplicating packages", async () => {
  for (const lostResponse of [false, true]) {
    const f = fixture({ throwAfterCommit: lostResponse });
    const create = () => f.load(createPath).POST(bookingTestRequest("/api/hospital/services", { ...payload, requestId: "stable-package-request-001" }));
    if (lostResponse) assert.equal((await create()).status, 503);
    const responses = await Promise.all([create(), create(), create()]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    assert.equal(new Set(bodies.map((body) => body.serviceId)).size, 1);
    assert.equal(f.values("services").length, 2); // One pre-existing legacy fixture plus the new draft.
    assert.equal(f.values("auditLogs").length, 1);
    assert.equal(f.values("services").find((item) => item.id !== "package").status, "inactive");
  }
});

test("replaying a successful submission with its original revision returns current state without another notification", async () => {
  const f = fixture({ records: { "services/package": { ...pending, reviewStatus: "draft" } } });
  const request = { action: "submit", expectedAuditId: "request-audit" };
  assert.equal((await f.patch(request)).status, 200);
  const current = f.records.get("services/package");
  const retry = await f.patch(request);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).changes.lastAuditId, current.lastAuditId);
  assert.equal(f.values("auditLogs").length, 1);
  assert.equal(f.values("notifications").length, 1);
  assert.equal((await f.patch({ action: "submit", expectedAuditId: "unrelated-revision" })).status, 409);
});

test("full package lifecycle preserves public content and existing bookings, rejecting a changed quote before new booking", async () => {
  const f = fixture({ records: { "services/package": { ...pending, reviewStatus: "draft" } } });
  const { publicServiceProjection } = loadTypeScript("services/hospitals/publicProjection.ts");
  assert.equal((await f.patch({ action: "submit", expectedAuditId: "request-audit" })).status, 200);
  f.actor.role = "admin";
  const approve = () => f.review("approve", [{ id: "package", auditId: f.records.get("services/package").lastAuditId }]);
  assert.equal((await approve()).status, 200);
  const firstVersion = publicServiceProjection("package", f.records.get("services/package")).packageVersion;
  const book = (requestId, expectedPackageVersion) => f.load("app/api/consumer/bookings/route.ts").POST(bookingTestRequest("/api/consumer/bookings", { ...validBookingInput, requestId, expectedPackageVersion }));
  f.actor.role = "consumer"; f.actor.uid = "patient";
  assert.equal((await book("versioned-booking-request-001", firstVersion)).status, 201);
  const original = f.values("bookings")[0];
  assert.equal(original.servicePrice, 14000);
  f.actor.role = "hospital"; f.actor.uid = "partner";
  assert.equal((await f.patch({ action: "update", data: { ...payload, price: 21000, procedures: { headMassage: 5 } } })).status, 200);
  assert.equal(publicServiceProjection("package", f.records.get("services/package")).packageVersion, firstVersion);
  assert.equal((await f.patch({ action: "submit", expectedAuditId: f.records.get("services/package").lastAuditId })).status, 200);
  f.actor.role = "admin";
  assert.equal((await approve()).status, 200);
  const currentVersion = publicServiceProjection("package", f.records.get("services/package")).packageVersion;
  assert.notEqual(currentVersion, firstVersion);
  f.actor.role = "consumer"; f.actor.uid = "patient";
  const rejected = await book("versioned-booking-request-002", firstVersion);
  assert.equal(rejected.status, 409);
  assert.match((await rejected.json()).error, /package has changed/);
  assert.equal(f.values("bookings").length, 1);
  assert.equal((await book("versioned-booking-request-002", currentVersion)).status, 201);
  assert.equal(f.values("bookings").find((item) => item.id !== original.id).servicePrice, 21000);
  assert.equal(f.records.get(`bookings/${original.id}`).servicePrice, 14000);
  // A retry of the original successful request still resolves to its saved booking.
  assert.equal((await book("versioned-booking-request-001", firstVersion)).status, 200);
  assert.equal(f.values("bookings").length, 2);
});

test("malformed review payloads and booking versions are rejected without writes", async () => {
  const f = fixture({ actor: { role: "admin" } });
  for (const body of [null, [], { action: "approve", packages: [null] }, { action: "approve", packages: [{ id: "bad/id", auditId: "ok" }] }]) {
    assert.equal((await f.load(reviewPath).POST(bookingTestRequest("/api/admin/hospitals/centre/packages", body), context("hospitalId", "centre"))).status, 400);
  }
  f.actor.role = "consumer";
  for (const expectedPackageVersion of [null, 12, "bad"]) assert.equal((await f.load("app/api/consumer/bookings/route.ts").POST(bookingTestRequest("/api/consumer/bookings", { ...validBookingInput, expectedPackageVersion }))).status, 400);
  assert.equal(f.values("auditLogs").length, 0);
});

test("missing active notification recipients produce actionable errors rather than silently completing reviews", async () => {
  const hospital = fixture({ records: { "users/admin": { role: "admin", status: "inactive" }, "services/package": { ...pending, reviewStatus: "draft" } } });
  const submit = await hospital.patch({ action: "submit", expectedAuditId: "request-audit" });
  assert.equal(submit.status, 409);
  assert.match((await submit.json()).error, /No active Admin/);
  assert.equal(hospital.records.get("services/package").reviewStatus, "draft");
  assert.equal(hospital.values("auditLogs").length, 0);
  const admin = fixture({ actor: { role: "admin" }, records: { "users/partner": { role: "hospital", status: "inactive", hospitalId: "centre" }, "services/package": pending } });
  const review = await admin.review();
  assert.equal(review.status, 409);
  assert.match((await review.json()).error, /No active Hospital account/);
  assert.equal(admin.records.get("services/package").reviewStatus, "pending");
  assert.equal(admin.values("notifications").length, 0);
});

test("real shared authorization rejects missing/revoked tokens and derives roles only from active server profiles", async () => {
  let profile = { role: "hospital", status: "active", hospitalId: "centre" };
  let rejectToken = false;
  let tokenChecks = 0;
  const authorization = loadTypeScript("services/firebase/adminAuthorization.ts", {
    "@/services/firebase/admin": {
      getFirebaseAdminAuth: () => ({ verifyIdToken: async (token, checkRevoked) => {
        tokenChecks++;
        assert.equal(token, "test-token");
        assert.equal(checkRevoked, true);
        if (rejectToken) throw new Error("Token revoked");
        return { uid: "partner", role: "admin", email_verified: true, firebase: { sign_in_provider: "password", sign_in_second_factor: "totp" } }; // Untrusted custom role must not override the profile.
      } }),
      getFirebaseAdminFirestore: () => ({ collection: (name) => ({ doc: (uid) => ({ get: async () => {
        assert.equal(name, "users"); assert.equal(uid, "partner");
        return { exists: Boolean(profile), data: () => profile };
      } }) }) }),
    },
  });
  const request = new Request("https://test.local/api/test", { headers: { authorization: "Bearer test-token" } });
  await assert.rejects(authorization.requireActiveUser(new Request("https://test.local/api/test"), ["admin"]), (error) => error.status === 401);
  assert.equal(tokenChecks, 0);
  assert.equal((await authorization.requireActiveUser(request, ["hospital"])).profile.hospitalId, "centre");
  await assert.rejects(authorization.requireActiveAdmin(request), (error) => error.status === 403);
  for (const data of [null, { role: "admin", status: "inactive" }, { role: "unrecognized", status: "active" }]) {
    profile = data;
    await assert.rejects(authorization.requireActiveUser(request, ["admin"]), (error) => error.status === 403);
  }
  profile = { role: "admin", status: "active" };
  assert.equal((await authorization.requireActiveAdmin(request)).role, "admin");
  rejectToken = true;
  await assert.rejects(authorization.requireActiveAdmin(request), (error) => error.status === 401);
});
