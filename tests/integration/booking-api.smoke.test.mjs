import { test } from "node:test";
import assert from "node:assert/strict";

// Read-only production-build smoke checks. Never sign in or perform an
// authenticated mutation; successful writes are tested in local fixtures only.
const origin = new URL(process.env.AYURSARGA_SMOKE_ORIGIN || "http://127.0.0.1:3187");
if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || origin.pathname !== "/" || origin.username || origin.password) throw new Error("Smoke tests require an explicit loopback HTTP server.");
const read = (path, options = {}) => fetch(new URL(path, origin), { ...options, signal: AbortSignal.timeout(45000) });

test("fresh production build serves essential/deep health JSON and the themed expanded page", async () => {
  for (const [path, mode, count] of [["/api/health", "configuration", 3], ["/api/health?deep=true", "deep-configuration", 5]]) {
    const response = await read(path, { headers: { Accept: "application/json" } });
    assert.equal(response.status, 200, `${path}: configuration readiness`);
    assert.match(response.headers.get("cache-control"), /no-store/);
    const body = await response.json();
    assert.equal(body.mode, mode); assert.equal(body.dependencies.length, count); assert.equal(body.status, "ok");
    console.log(`${path}: HTTP ${response.status}, ${mode}, ${count} configured dependencies`);
  }
  const page = await read("/health?deep=true"); assert.equal(page.status, 200);
  const html = await page.text();
  for (const text of ["health-card", "Expanded checks", "Configuration checks passed", "Browser sign-in", "Hospital image uploads"]) assert.ok(html.includes(text), `Missing health page marker: ${text}`);
  const redirect = await read("/api/health?deep=true", { headers: { Accept: "text/html" }, redirect: "manual" });
  assert.equal(redirect.status, 307); assert.equal(new URL(redirect.headers.get("location"), origin).pathname + new URL(redirect.headers.get("location"), origin).search, "/health?deep=true");
});

test("protected booking/consultant mutations reject missing and invalid tokens without accessing or changing records", async () => {
  const endpoints = [
    ["POST", "/api/consumer/bookings"], ["POST", "/api/consumer/consultations"],
    ["PATCH", `/api/consultations/consultation-${"0".repeat(64)}`],
    ["PATCH", "/api/hospital/bookings/local-smoke-not-a-real-record"], ["POST", "/api/admin/consultants"],
  ];
  for (const authorization of [null, "Bearer deliberately-invalid-smoke-token"]) for (const [method, path] of endpoints) {
    const response = await read(path, { method, headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) }, body: "{}" });
    assert.equal(response.status, 401, `${method} ${path}`);
    assert.equal(typeof (await response.json()).error, "string");
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
  const details = await read("/api/consumer/bookings?id=local-smoke-not-a-real-record"); assert.equal(details.status, 401);
  console.log("11 protected HTTP requests denied as expected; no authenticated writes attempted");
});

test("public consultant queries enforce validation and execute the deployed bounded index without private fields", async () => {
  for (const query of ["", "?service=unknown", "?service=prenatal-doctor&cursor=-1"]) {
    const response = await read(`/api/public/consultants${query}`); assert.equal(response.status, 400);
  }
  const response = await read("/api/public/consultants?service=prenatal-doctor"); assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const page = await response.json(); assert.ok(Array.isArray(page.documents)); assert.ok(page.documents.length <= 12);
  for (const item of page.documents) for (const key of ["email", "contactNo", "whatsappNo", "address", "emergencyContactNo", "lastAuditId"]) assert.equal(key in item, false, `Private field: ${key}`);
  console.log(`Consultant query: HTTP 200; ${page.documents.length} eligible professionals (an empty result is valid)`);
});

test("Search Center public list/details/packages remain reachable and exclude management metadata", async () => {
  const response = await read("/api/public/hospitals?pageSize=2"); assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const page = await response.json(); assert.ok(Array.isArray(page.documents)); assert.ok(page.documents.length <= 2);
  const verify = (item) => { for (const key of ["commissionPercentage", "contractUrl", "contractUrl2", "createdBy", "updatedBy", "lastAuditId"]) assert.equal(key in item, false, `Private hospital field: ${key}`); };
  page.documents.forEach(verify);
  if (page.documents[0]) {
    const id = encodeURIComponent(page.documents[0].id);
    const detail = await read(`/api/public/hospitals/${id}`); assert.equal(detail.status, 200);
    const data = await detail.json(); verify(data.document ?? data.hospital ?? data);
    const services = await read(`/api/public/hospitals/${id}/services?pageSize=2`); assert.equal(services.status, 200);
    const packages = await services.json(); assert.ok(Array.isArray(packages.documents)); packages.documents.forEach(verify);
    console.log(`Search Center: list/details/packages HTTP 200; ${page.documents.length} initial centres checked`);
  } else console.log("Search Center list HTTP 200; no active public centres available for details/package HTTP checks");
  const pageResponse = await read("/centers"); assert.equal(pageResponse.status, 200);
  assert.ok((await pageResponse.text()).includes("centers-directory-page"));
});
