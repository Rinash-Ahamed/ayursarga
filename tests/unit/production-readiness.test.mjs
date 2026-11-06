import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateStagingTarget, LOAD_LEVELS } from "../load/guard.mjs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
import { bookingFlowFixture, bookingTestRequest } from "../helpers/bookingFlowFixture.mjs";

const env = { RUN_ENV: "staging", ALLOW_STAGING_LOAD: "I_HAVE_VERIFIED_ISOLATION", BASE_URL: "https://staging.example.test", STAGING_HOST: "staging.example.test", STAGING_FIREBASE_PROJECT_ID: "isolated-staging" };
const fixture = { baseUrl: env.BASE_URL, projectId: env.STAGING_FIREBASE_PROJECT_ID, isolated: true, emailDeliverySandboxed: true, razorpayMode: "test" };
test("load guards support all requested levels and reject production, mismatched hosts and missing isolation", () => {
  for (const vus of LOAD_LEVELS) assert.equal(validateStagingTarget({ ...env, VUS: String(vus) }, fixture).vus, vus);
  for (const overrides of [{ RUN_ENV: "production" }, { ALLOW_STAGING_LOAD: "" }, { VUS: "10000" }, { BASE_URL: "https://ayursarga.com", STAGING_HOST: "ayursarga.com" }, { BASE_URL: "https://www.ayursarga.com", STAGING_HOST: "www.ayursarga.com" }, { BASE_URL: "https://other.example.test" }, { BASE_URL: "http://staging.example.test" }, { BASE_URL: "https://staging.example.test@ayursarga.com" }, { BASE_URL: "https://staging.example.test/?redirect=production" }, { STAGING_FIREBASE_PROJECT_ID: "ayursarga-connect" }]) assert.throws(() => validateStagingTarget({ ...env, ...overrides }, fixture));
  for (const overrides of [{ isolated: false }, { emailDeliverySandboxed: false }, { razorpayMode: "live" }, { projectId: "ayursarga-connect" }]) assert.throws(() => validateStagingTarget(env, { ...fixture, ...overrides }));
});

test("Hospital availability rejects normalized/impossible dates before reads or writes", async () => {
  const f = bookingFlowFixture({ actor: { role: "hospital", uid: "partner" }, overrides: {
    "@/services/firebase/admin": { isFirebaseAdminReady: () => true },
  } });
  const { POST } = f.load("app/api/hospital/availability/route.ts");
  for (const date of ["2099-02-30", "2099-04-31", "2099-02-29", "2099-13-01", "30/02/2099"]) {
    const response = await POST(bookingTestRequest("/api/hospital/availability", { startDate: date, endDate: date, reason: "Centre unavailable" }));
    assert.equal(response.status, 400);
  }
  assert.equal(f.calls.writes.length, 0);
});

test("Hospital availability preserves valid leap-day/IST values and bounds Admin notification fan-out", async () => {
  for (const count of [100, 101]) {
    const f = bookingFlowFixture({ actor: { role: "hospital", uid: "partner" }, records: Object.fromEntries(Array.from({ length: count - 1 }, (_, i) => [`users/admin-${i}`, { role: "admin", status: "active" }])), overrides: {
      "@/services/firebase/admin": { isFirebaseAdminReady: () => true },
    } });
    f.records.delete("users/inactive"); // Remove only the unrelated synthetic Admin fixture from this exact-count test.
    const written = [];
    f.firestore.batch = () => ({ set: (_ref, data) => written.push(data), commit: async () => {} });
    const response = await f.load("app/api/hospital/availability/route.ts").POST(bookingTestRequest("/api/hospital/availability", { startDate: "2096-02-29", endDate: "2096-02-29", reason: "Centre maintenance" }));
    assert.equal(response.status, count === 100 ? 201 : 409, await response.clone().text());
    assert.equal(written.length, count === 100 ? 102 : 0);
    if (count === 100) assert.equal(written[0].startDate.toDate().toISOString(), "2096-02-28T18:30:00.000Z");
  }
});

test("directory list/filter reads request only public card fields and preserve publication checks", async () => {
  const f = bookingFlowFixture({ records: { "hospitals/centre": { name: "Synthetic centre", status: "active", isPublic: true, contractDetails: { private: "large contract" } }, "services/package": { name: "7-day package", hospitalId: "centre", status: "active", publishedAt: {}, reviewStatus: "pending", draftPackage: { private: "proposed" } } }, overrides: {
    "@/services/firebase/admin": { getFirebaseAdminFirestore: () => f.firestore },
    "@/services/api/rateLimit": { allowRequest: () => true, requestFingerprint: () => "fixture" },
  } });
  const { GET } = f.load("app/api/public/hospitals/route.ts");
  for (const query of ["pageSize=2", "service=7-day%20package&pageSize=2"]) {
    const response = await GET(new Request(`https://test.local/api/public/hospitals?${query}`));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.documents.map(item => item.id), ["centre"]);
    assert.equal(body.documents[0].contractDetails, undefined);
  }
  assert.ok(f.calls.fields.some(fields => fields.includes("blockedDateRanges") && fields.includes("name")));
  assert.ok(f.calls.fields.some(fields => fields.includes("hospitalId") && fields.includes("reviewStatus") && fields.includes("publishedAt")));
  assert.ok(f.calls.fields.every(fields => !fields.includes("contractDetails") && !fields.includes("draftPackage")));
});

test("availability notification overflow fails before an atomic action instead of reading an unlimited list", async () => {
  for (const [count, allowed] of [[20, true], [21, false]]) {
    const records = Object.fromEntries(Array.from({ length: count }, (_, index) => [`users/hospital-${index}`, { role: "hospital", status: "active", hospitalId: "centre" }]));
    const f = bookingFlowFixture({ actor: { role: "admin", uid: "admin" }, records });
    // The fixture has one existing Hospital user too. Remove just that synthetic
    // fixture entry so the explicit edge counts stay exact; no live database.
    f.records.delete("users/partner");
    const action = f.load("services/hospitals/availabilityAdmin.ts").createAdminBlock({ firestore: f.firestore, adminUid: "admin", hospitalId: "centre", startDate: new Date("2099-10-25T00:00:00+05:30"), endDate: new Date("2099-10-26T00:00:00+05:30"), reason: "Maintenance", request: new Request("https://test.local") });
    if (allowed) { await action; assert.equal(f.values("notifications").length, 20); }
    else { await assert.rejects(action, error => error.status === 409); assert.equal(f.calls.writes.length, 0); }
  }
});

test("API metrics are opt-in, numeric and never include handler error messages or caller context", async t => {
  const logs = [];
  t.mock.method(console, "info", value => logs.push(JSON.parse(value)));
  t.mock.method(console, "error", value => logs.push(JSON.parse(value)));
  const previous = process.env.API_METRICS_ENABLED;
  try {
    delete process.env.API_METRICS_ENABLED;
    const { withApiTiming, timeApiStep } = loadTypeScript("services/api/timing.ts");
    const read = withApiTiming("GET /api/test/[id]", async () => { await timeApiStep("database", async () => {}); return Response.json({ ok: true }); });
    await read(); assert.equal(logs.length, 0);
    process.env.API_METRICS_ENABLED = "true";
    const response = await read();
    assert.match(response.headers.get("server-timing"), /database;dur=/);
    const metric = logs.find(entry => entry.event === "api_metrics");
    for (const key of ["totalMs", "processCpuUserMs", "processCpuSystemMs", "processRssBytes", "processHeapUsedBytes"]) assert.equal(typeof metric[key], "number");
    await withApiTiming("POST /api/test/[id]", async () => Response.json({ error: "private" }, { status: 503 }))();
    assert.ok(logs.some(entry => entry.event === "api_failed_response" && entry.status === 503));
    await assert.rejects(withApiTiming("POST /api/test/[id]", async () => { throw Error("private secret token"); })());
    assert.ok(logs.some(entry => entry.event === "api_unhandled_failure"));
    assert.doesNotMatch(JSON.stringify(logs), /private|secret|token|authorization/i);
  } finally { if (previous === undefined) delete process.env.API_METRICS_ENABLED; else process.env.API_METRICS_ENABLED = previous; }
});

test("large audit payload maps are index-exempt without changing queried top-level indexes", () => {
  const indexes = JSON.parse(readFileSync("firestore.indexes.json", "utf8"));
  for (const fieldPath of ["previousValues", "updatedValues", "device"]) assert.ok(indexes.fieldOverrides.some(item => item.collectionGroup === "auditLogs" && item.fieldPath === fieldPath && item.indexes.length === 0));
  assert.ok(indexes.indexes.some(item => item.collectionGroup === "auditLogs" && item.fields.some(field => field.fieldPath === "timestamp")));
});
