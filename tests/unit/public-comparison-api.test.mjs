import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

function routeFixture(hospital) {
  const calls = { active: 0, maxActive: 0, fields: [], limit: 0 };
  const read = async (value) => {
    calls.active++;
    calls.maxActive = Math.max(calls.maxActive, calls.active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    calls.active--;
    return value;
  };
  const query = {
    where: () => query, orderBy: () => query,
    limit: (value) => { calls.limit = value; return query; },
    select: (...fields) => { calls.fields = fields; return query; },
    get: () => read({ size: 1, docs: [{ id: "package", data: () => ({ name: "7-day package", packageDurationDays: 7, status: "active", price: 12000, commissionPercentage: 20, lastAuditId: "private-audit" }) }] }),
  };
  const { GET } = loadTypeScript("app/api/public/hospitals/[hospitalId]/services/route.ts", {
    "@/services/firebase/admin": { getFirebaseAdminFirestore: () => ({ collection: (name) => name === "services" ? query : { doc: () => ({ get: () => read({ exists: Boolean(hospital), data: () => hospital }) }) } }) },
    "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status }), logApiError: () => {} },
    "@/services/api/rateLimit": { allowRequest: () => true, requestFingerprint: () => "test" },
  });
  return { GET, calls };
}

test("package endpoint overlaps independent reads and retains bounded public projection", async () => {
  const { GET, calls } = routeFixture({ status: "active", isPublic: true });
  const response = await GET(new Request("https://test.local/api/public/hospitals/centre/services?pageSize=24"), { params: Promise.resolve({ hospitalId: "centre" }) });
  assert.equal(response.status, 200);
  assert.equal(calls.maxActive, 2);
  assert.equal(calls.limit, 25);
  assert.ok(calls.fields.includes("price"));
  assert.ok(!calls.fields.includes("commissionPercentage"));
  const body = await response.json();
  assert.equal(body.documents[0].packageDurationDays, 7);
  assert.equal(body.documents[0].commissionPercentage, undefined);
  assert.equal(body.documents[0].lastAuditId, undefined);
});
test("parallel reads never expose packages for private, inactive, or missing centers", async () => {
  for (const hospital of [null, { status: "active", isPublic: false }, { status: "inactive", isPublic: true }]) {
    const { GET } = routeFixture(hospital);
    const response = await GET(new Request("https://test.local/api/public/hospitals/centre/services"), { params: Promise.resolve({ hospitalId: "centre" }) });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).documents, undefined);
  }
});
