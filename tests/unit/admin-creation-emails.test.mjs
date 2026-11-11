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

test('hospital creation rejects explicit blank or null required particulars without a record, counter or audit',async()=>{
  for(const field of ['legalName','registeredAddress','name','email','phone','hospitalPhone1','address','city','district','state','commissionPercentage'])for(const value of ['', '   ', null]){
    const f=bookingFlowFixture({actor:{uid:'admin',role:'admin'}});
    const before=['hospitals','systemSettings','auditLogs'].map(collection=>f.values(collection).length);
    const response=await create(f,'hospitals',{[field]:value});
    assert.equal(response.status,400,field);assert.equal(f.calls.writes.length,0);
    assert.deepEqual(['hospitals','systemSettings','auditLogs'].map(collection=>f.values(collection).length),before);
  }
});

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

test("hospital display IDs are atomic, sequential and independent of internal IDs or email edits", async () => {
  const f = bookingFlowFixture({ actor: { role: "admin" }, records: {
    "systemSettings/hospitalCreationSequence": { value: 25 },
    "hospitals/legacy": { name: "Legacy", email: "legacy@example.test" },
  } });
  const responses = await Promise.all([
    create(f, "hospitals", { email: "first@example.test", hospitalCode: "AH999", hospitalSequence: 999 }),
    create(f, "hospitals", { email: "second@example.test" }),
  ]);
  assert.deepEqual(responses.map(response => response.status), [201, 201]);
  const saved = await Promise.all(responses.map(response => response.json()));
  assert.deepEqual(saved.map(record => record.hospitalCode), ["AH001", "AH002"]);
  for (const result of saved) {
    assert.notEqual(result.hospitalId, result.hospitalCode);
    const record = f.records.get(`hospitals/${result.hospitalId}`);
    assert.equal(record.hospitalCode, result.hospitalCode);
    const audit = f.records.get(`auditLogs/${record.lastAuditId}`);
    assert.equal(audit.updatedValues.hospitalCode, result.hospitalCode);
    assert.equal(audit.recordId, result.hospitalId);
  }
  assert.equal(f.records.get("systemSettings/hospitalCreationSequence").value, 27);
  assert.equal(f.records.get("systemSettings/hospitalCreationSequence").hospitalSequence, 2);
  assert.equal(f.records.get("hospitals/legacy").hospitalCode, undefined);
});

test("hospital codes continue beyond AH999 and do not reuse a higher stored sequence", async () => {
  const f = bookingFlowFixture({ actor: { role: "admin" }, records: {
    "systemSettings/hospitalCreationSequence": { value: 2000, hospitalSequence: 998 },
    "hospitals/old": { hospitalCode: "AH999", hospitalSequence: 999, email: "old@example.test" },
  } });
  const response = await create(f, "hospitals");
  assert.equal(response.status, 201);
  assert.equal((await response.json()).hospitalCode, "AH1000");
});

test("hospital ID fields are display-only and excluded from client write allowlists", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  assert.doesNotMatch(rules, /['"]hospital(?:Code|Sequence)['"]/);
  for (const path of ["components/admin/HospitalsManager.tsx", "components/admin/HospitalDetails.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /hospitalCode/);
    assert.match(source, /Hospital ID/);
    assert.doesNotMatch(source, /name=["']hospital(?:Code|Sequence)["']/);
  }
  for (const path of ["components/hospital/HospitalProfile.tsx", "features/hospitals/partnerContractTemplate.ts", "features/hospitals/contractPdf.ts"]) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /hospitalCode|hospitalSequence/);
  }
});
