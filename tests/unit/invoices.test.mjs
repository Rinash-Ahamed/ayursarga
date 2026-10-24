import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const input = { hospitalId: "hospital", invoiceDate: "2026-10-24", dueDate: "2026-11-01", description: "Commission for completed services",
  commissionAmount: "1000.00", gstRate: "18", taxMode: "cgst-sgst", placeOfSupply: "Kerala", sac: "", notes: "Payment instructions" };
const request = (changes = {}, requestId = "invoice-attempt-000001") => new Request("https://test.local/api/admin/invoices", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, requestId, ...changes }),
});
const { validateInvoiceInput, INVOICE_ISSUER } = loadTypeScript("features/billing/invoices.ts");

function fixture(options = {}) {
  const records = new Map([["hospitals/hospital", { name: "Hospital Centre", legalName: "Hospital Legal Name", address: "Service address", registeredAddress: "Registered address",
    gstin: "32ABCDE1234F1Z5", state: "Kerala", status: "active", email: "hospital@example.com" }]]);
  let sequence = 0;
  let queue = Promise.resolve();
  let commits = 0;
  const limits = [];
  const snapshot = (ref) => ({ id: ref.id, exists: records.has(ref.path), data: () => records.get(ref.path) });
  const firestore = {
    collection: (collection) => {
      const query = { orderBy: () => query, limit: (value) => { limits.push(value); return query; }, startAfter: () => query,
        get: async () => { const docs = [...records.keys()].filter((key) => key.startsWith(`${collection}/`)).slice(0, limits.at(-1) ?? 21).map((path) => snapshot({ id: path.split("/")[1], path })); return { docs, size: docs.length }; } };
      return { ...query, doc: (id = `audit-${++sequence}`) => { const ref = { id, path: `${collection}/${id}` }; return { ...ref, get: async () => snapshot(ref) }; } };
    },
    runTransaction: async (callback) => {
      const prior = queue; let release;
      queue = new Promise((resolve) => { release = resolve; }); await prior;
      const writes = [];
      try {
        const result = await callback({ get: async (ref) => snapshot(ref), getAll: async (...refs) => refs.map(snapshot),
          set: (ref, data) => writes.push({ ref, data }), create: (ref, data) => { assert.equal(records.has(ref.path), false); writes.push({ ref, data }); } });
        if (options.failCommit) throw new Error("Commit failure");
        writes.forEach(({ ref, data }) => records.set(ref.path, data)); commits++;
        return result;
      } finally { release(); }
    },
  };
  class AuthorizationError extends Error { constructor() { super("Denied"); this.status = 403; } }
  const route = loadTypeScript("app/api/admin/invoices/route.ts", {
    "@/services/firebase/adminAuthorization": { AdminAuthorizationError: AuthorizationError, requireActiveAdmin: async () => { if (options.role && options.role !== "admin") throw new AuthorizationError(); return { uid: "admin", firestore }; } },
    "@/services/api/server": { apiJson: (data, status = 200) => Response.json(data, { status }), logApiError: () => {} },
    "@/services/api/rateLimit": { allowRequest: () => !options.limited },
  });
  return { ...route, records, limits, commits: () => commits };
}

test("invoice commission and taxes use exact paise calculations with chosen tax treatment", () => {
  const split = validateInvoiceInput(input);
  assert.equal(split.isValid, true);
  assert.deepEqual(split.totals, { taxablePaise: 100000, cgstPaise: 9000, sgstPaise: 9000, igstPaise: 0, totalPaise: 118000 });
  assert.equal(validateInvoiceInput({ ...input, taxMode: "igst" }).totals.igstPaise, 18000);
  assert.equal(validateInvoiceInput({ ...input, taxMode: "none", gstRate: "0" }).totals.totalPaise, 100000);
  assert.equal(validateInvoiceInput({ ...input, commissionAmount: "123.45" }).totals.totalPaise, 14567);
  assert.equal(validateInvoiceInput({ ...input, commissionAmount: "0.05" }).totals.totalPaise, 5);
});

test("invoice validation rejects invalid money, taxes, dates and oversized fields", () => {
  for (const changes of [{ commissionAmount: "1e4" }, { commissionAmount: "-1" }, { commissionAmount: "0" }, { commissionAmount: "1.001" }, { commissionAmount: "" },
    { gstRate: "101" }, { gstRate: "" }, { gstRate: "18.001" }, { taxMode: "none" }, { taxMode: "invented" }, { invoiceDate: "24/10/2026" },
    { invoiceDate: "2026-02-30" }, { dueDate: "2026-10-23" }, { sac: "abc" }, { notes: "x".repeat(1001) }, { hospitalId: "../hospital" }]) {
    assert.equal(validateInvoiceInput({ ...input, ...changes }).isValid, false, JSON.stringify(changes));
  }
});

test("invoice issuance snapshots trusted hospital data, numbers and audits atomically; retries cannot issue twice", async () => {
  const f = fixture();
  const responses = await Promise.all([f.POST(request({ totalPaise: 1, invoiceNumber: "forged", billTo: { name: "Untrusted" } })), f.POST(request())]);
  assert.deepEqual(responses.map((response) => response.status), [201, 200]);
  const { invoice } = await responses[0].json();
  assert.equal(invoice.invoiceNumber, "AS/2026/00001"); assert.equal(invoice.totalPaise, 118000);
  assert.equal(invoice.billTo.name, "Hospital Legal Name"); assert.equal(invoice.billTo.address, "Registered address");
  assert.equal(invoice.issuer.gstin, "32ABGCA7749G1ZL");
  const invoices = [...f.records.entries()].filter(([key]) => key.startsWith("invoices/"));
  const audits = [...f.records.entries()].filter(([key]) => key.startsWith("auditLogs/"));
  assert.equal(invoices.length, 1); assert.equal(audits.length, 1);
  assert.equal(audits[0][1].updatedValues.lastAuditId, invoices[0][1].lastAuditId);
  assert.equal((await f.POST(request({ commissionAmount: "2000" }))).status, 409);
  const second = await f.POST(request({}, "invoice-attempt-000002"));
  assert.equal((await second.json()).invoice.invoiceNumber, "AS/2026/00002");
  const list = await f.GET(new Request("https://test.local/api/admin/invoices"));
  assert.equal(list.status, 200); assert.ok(f.limits.includes(21));
});

test("invoice routes deny Hospital and Consumer access; failed/invalid creates leave no invoice or audit", async () => {
  for (const role of ["hospital", "consumer", "anonymous"]) {
    const f = fixture({ role });
    assert.equal((await f.POST(request())).status, 403);
    assert.equal((await f.GET(new Request("https://test.local/api/admin/invoices"))).status, 403);
    assert.equal(f.commits(), 0);
  }
  for (const options of [{ failCommit: true }, { limited: true }, {}]) {
    const f = fixture(options);
    const response = await f.POST(request(options.failCommit || options.limited ? {} : { gstRate: "bad" }));
    assert.ok(response.status >= 400);
    assert.equal([...f.records.keys()].some((key) => /^(invoices|auditLogs|systemSettings)\//.test(key)), false);
  }
});

test("invoice template is branded, escapes details, snapshots GSTIN and keeps direct client writes denied", () => {
  const { buildInvoiceHtml } = loadTypeScript("features/billing/invoiceTemplate.ts");
  const html = buildInvoiceHtml({ ...input, ...validateInvoiceInput(input).totals, invoiceNumber: "AS/2026/00001", issuer: INVOICE_ISSUER,
    billTo: { name: "<script>test</script>", address: "Hospital address", email: "hospital@example.com", gstin: "32ABCDE1234F1Z5" } });
  assert.match(html, /#173e2b/); assert.match(html, /#b8872f/); assert.match(html, /32ABGCA7749G1ZL/);
  assert.match(html, /24\/10\/2026/); assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
  const rules = readFileSync("firestore.rules", "utf8").split("match /invoices/{invoiceId} {")[1].split("\n    }")[0];
  assert.match(rules, /allow read: if isAdmin\(\)/); assert.match(rules, /allow create, update, delete: if false/);
});
