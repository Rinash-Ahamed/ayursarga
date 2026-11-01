import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bookingFlowFixture } from "../helpers/bookingFlowFixture.mjs";

const email = "unique@example.test";
const hospital = { name: "Hospital", email, phone: "9876543210", hospitalPhone1: "9876543210", address: "A complete hospital address", city: "Palakkad", district: "Palakkad", state: "Kerala", commissionPercentage: 10 };
const consultant = { name: "Consultant", email, contactNo: "9876543210", whatsappNo: "9876543210", qualification: "BAMS", yearsExperience: 3, consultantCharge: 300, ayursargaCommissionPercentage: 10 };
const request = body => new Request("https://test.local/api/admin/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
function create(f, collectionName, values = {}) {
  return f.load(`app/api/admin/${collectionName}/route.ts`).POST(request({ ...(collectionName === "hospitals" ? hospital : consultant), ...values }));
}

for (const collectionName of ["hospitals", "consultants"]) {
  test(`${collectionName}: existing active, inactive and archived emails block creation without side effects`, async () => {
    for (const status of ["active", "inactive", "archived"]) {
      const f = bookingFlowFixture({ actor: { uid: "admin", role: "admin" }, records: { [`${collectionName}/existing`]: { email, status } } });
      const response = await create(f, collectionName, { email: "  UNIQUE@EXAMPLE.TEST  " });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).field, "email");
      assert.equal(f.calls.writes.length, 0);
      assert.equal(f.values("auditLogs").length, 0);
    }
  });
  test(`${collectionName}: simultaneous creates produce one record and one linked audit`, async () => {
    const f = bookingFlowFixture({ actor: { uid: "admin", role: "admin" } });
    const before = f.values(collectionName).length;
    const results = await Promise.all([create(f, collectionName), create(f, collectionName, { email: " UNIQUE@example.test " })]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    assert.equal(f.values(collectionName).length, before + 1);
    assert.equal(f.values("auditLogs").length, 1);
    const audit = f.values("auditLogs")[0];
    const record = f.records.get(`${collectionName}/${audit.recordId}`);
    assert.equal(record.email, email);
    assert.equal(record.lastAuditId, audit.id);
    assert.equal(f.values("systemSettings").length, 1);
  });
  test(`${collectionName}: invalid/unauthorized/failed requests cannot create partial records`, async () => {
    for (const role of ["consumer", "hospital"]) {
      const f = bookingFlowFixture({ actor: { role } });
      assert.equal((await create(f, collectionName)).status, 403);
      assert.equal(f.calls.writes.length, 0);
    }
    const f = bookingFlowFixture({ actor: { role: "admin" }, failCommit: true });
    const before = f.values(collectionName).length;
    assert.equal((await create(f, collectionName, { email: "bad" })).status, 400);
    const original = console.error; console.error = () => {};
    try { assert.equal((await create(f, collectionName)).status, 503); } finally { console.error = original; }
    assert.equal(f.values(collectionName).length, before);
    assert.equal(f.values("auditLogs").length, 0);
    assert.equal(f.values("systemSettings").length, 0);
  });
  test(`${collectionName}: retry after a lost response cannot create a duplicate or repeat its audit`, async () => {
    const f = bookingFlowFixture({ actor: { role: "admin" }, throwAfterCommit: true });
    const before = f.values(collectionName).length;
    const original = console.error; console.error = () => {};
    try { assert.equal((await create(f, collectionName)).status, 503); } finally { console.error = original; }
    assert.equal((await create(f, collectionName)).status, 409);
    assert.equal(f.values(collectionName).length, before + 1);
    assert.equal(f.values("auditLogs").length, 1);
  });
}
test("one hospital and one consultant may use the same email; uniqueness stays within each list", async () => {
  const f = bookingFlowFixture({ actor: { role: "admin" } });
  assert.equal((await create(f, "hospitals")).status, 201);
  assert.equal((await create(f, "consultants")).status, 201);
});
test("hospital and consultant direct client creation remain denied", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  for (const collectionName of ["hospitals", "consultants"]) {
    const block = rules.slice(rules.indexOf(`match /${collectionName}/{`)).split(/\n    match \//)[0];
    assert.match(block, /allow create(?:, update, delete)?: if false;/);
  }
});
