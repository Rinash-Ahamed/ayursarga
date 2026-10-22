import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
const { validateConsultantFields, consultantFormValues, formatConsultantTimeSlot } = loadTypeScript("features/consultants/validation.ts");
const legacy = { name: "Doctor Sample", email: "doctor@example.com", contactNo: "9876543210", whatsappNo: "9876543210", qualification: "BAMS", yearsExperience: 3.5 };

test("consultant update rules allow every validated profile field without broadening status or identity edits", () => {
  // Source-contract regression, not a substitute for emulator/deployed-rule tests.
  const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
  const consultantRules = rules.split("match /consultants/{consultantId} {")[1]?.split("match /availability/")[0];
  assert.ok(consultantRules, "Consultant rules must exist");
  const updateBranch = consultantRules.split("linkedAuditAction() == 'update'")[1]?.split("linkedAuditAction() == 'status_change'")[0];
  const allowed = [...updateBranch.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  const profileFields = Object.keys(validateConsultantFields(legacy).data);
  assert.deepEqual(allowed.toSorted(), [...profileFields, "updatedAt", "updatedBy", "lastAuditId"].toSorted());
  assert.match(consultantRules, /allow update: if isAdmin\(\)/);
  assert.match(consultantRules, /hasValidConsultantFields\(\)/);
  assert.match(consultantRules, /hasLinkedAudit\('consultants', consultantId\)/);
  assert.match(consultantRules, /allow delete: if false/);
});
test("legacy consultants default to optional empty preferences", () => {
  const result = validateConsultantFields(legacy);
  assert.equal(result.isValid, true);
  assert.equal(result.data.designation, "");
  assert.equal(result.data.consultantCharge, null);
  assert.deepEqual(result.data.preferredTimeSlots, []);
  assert.deepEqual(result.data.consultationServices, []);
});

test("explicit consultant service assignments survive form parsing and reject invalid or duplicate values", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries(legacy)) form.set(key, String(value));
  form.append("consultationServices", "psychologist"); form.append("consultationServices", "prenatal-yoga");
  const result = validateConsultantFields(consultantFormValues(form));
  assert.equal(result.isValid, true);
  assert.deepEqual(result.data.consultationServices, ["prenatal-yoga", "psychologist"]);
  for (const consultationServices of ["lactation", ["invented"], ["lactation", "lactation"], [null], {}]) {
    assert.equal(validateConsultantFields({ ...legacy, consultationServices }).isValid, false);
  }
});

test("consultant charges preserve blank, zero and decimal amounts through form validation", () => {
  for (const [raw, expected] of [[undefined, null], [null, null], ["", null], ["  ", null], ["0", 0], [0, 0], ["900.50", 900.5], [1250.75, 1250.75]]) {
    const result = validateConsultantFields({ ...legacy, consultantCharge: raw });
    assert.equal(result.isValid, true);
    assert.equal(result.data.consultantCharge, expected);
  }
  const form = new FormData();
  for (const [key, value] of Object.entries(legacy)) form.set(key, String(value));
  form.set("consultantCharge", "900.50");
  assert.equal(validateConsultantFields(consultantFormValues(form)).data.consultantCharge, 900.5);
});

test("invalid charges are rejected before they reach the API or audited update", () => {
  for (const consultantCharge of [-1, "-1", "abc", NaN, Infinity, true, {}, [], "1.001", "1e3", "9007199254740991"]) {
    const result = validateConsultantFields({ ...legacy, consultantCharge });
    assert.equal(result.isValid, false, String(consultantCharge));
    assert.ok(result.errors.consultantCharge);
  }
});

test("consultant service sends validated charges and preserves atomic audited edit behavior", async () => {
  const calls = [];
  const service = loadTypeScript("services/consultants/consultantService.ts", {
    "@/services/firestore/firestoreService": { firestoreTimestamp: { server: () => "server-time" } },
    "@/services/firestore/auditService": { getAuditActorId: () => "admin", updateAuditedDocument: async (...args) => calls.push({ kind: "update", args }) },
    "@/services/api/client": { authorizedApiRequest: async (url, options) => { calls.push({ kind: "create", url, body: JSON.parse(options.body) }); return { employeeId: "AS001" }; } },
  });
  assert.equal(await service.createConsultant({ ...legacy, consultantCharge: "900.50" }), "AS001");
  assert.equal(calls[0].body.consultantCharge, 900.5);
  await service.updateConsultant("AS001", { ...legacy, consultantCharge: 0 }, {});
  assert.equal(calls[1].args[2].consultantCharge, 0);
  assert.deepEqual(calls[1].args[3], { action: "update", actorRole: "admin" });
  await service.updateConsultant("AS001", { ...legacy, consultantCharge: "" }, {});
  assert.equal(calls[2].args[2].consultantCharge, null);
  assert.throws(() => service.updateConsultant("AS001", { ...legacy, consultantCharge: -1 }, {}));
  await assert.rejects(service.createConsultant({ ...legacy, consultantCharge: -1 }));
  assert.equal(calls.length, 3);
});

test("creation API checks Admin access and charge validation before its atomic consultant/audit write", async () => {
  class AuthorizationError extends Error { constructor() { super("Denied"); this.status = 403; } }
  for (const scenario of ["allowed", "invalid", "denied"]) {
    const writes = [];
    let commits = 0;
    const firestore = {
      collection: (name) => ({ doc: (id = "audit") => ({ path: `${name}/${id}` }), orderBy: () => ({ limit: () => ({ query: true }) }) }),
      runTransaction: async (callback) => {
        const pending = [];
        const result = await callback({
          get: async (ref) => ref.query ? { docs: [] } : { data: () => ({ value: 0 }) },
          create: (ref, data) => pending.push({ path: ref.path, data }),
          set: (ref, data) => pending.push({ path: ref.path, data }),
        });
        commits++;
        writes.push(...pending);
        return result;
      },
    };
    const { POST } = loadTypeScript("app/api/admin/consultants/route.ts", {
      "@/services/firebase/adminAuthorization": { AdminAuthorizationError: AuthorizationError, requireActiveAdmin: async () => { if (scenario === "denied") throw new AuthorizationError(); return { uid: "admin", firestore }; } },
      "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status }) },
    });
    const response = await POST(new Request("https://test.local/api/admin/consultants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...legacy, consultationServices: ["lactation"], consultantCharge: scenario === "invalid" ? -1 : 900.5 }) }));
    assert.equal(response.status, scenario === "allowed" ? 201 : scenario === "denied" ? 403 : 400);
    assert.equal(commits, scenario === "allowed" ? 1 : 0);
    if (scenario === "allowed") {
      const consultant = writes.find((write) => write.path === "consultants/AS001");
      const audit = writes.find((write) => write.path === "auditLogs/audit");
      assert.equal(consultant.data.consultantCharge, 900.5);
      assert.deepEqual(consultant.data.consultationServices, ["lactation"]);
      assert.equal(audit.data.updatedValues.consultantCharge, 900.5);
      assert.deepEqual(audit.data.updatedValues.consultationServices, ["lactation"]);
      assert.equal(audit.data.actorRole, "admin");
    } else assert.equal(writes.length, 0);
  }
});
test("designation and multi-select preferences survive form parsing in canonical order", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries(legacy)) form.set(key, String(value));
  form.set("designation", "  Ayurvedic Doctor  ");
  form.append("preferredTimeSlots", "evening");
  form.append("preferredTimeSlots", "morning");
  const result = validateConsultantFields(consultantFormValues(form));
  assert.equal(result.isValid, true);
  assert.equal(result.data.designation, "Ayurvedic Doctor");
  assert.deepEqual(result.data.preferredTimeSlots, ["morning", "evening"]);
});
test("invalid, duplicate or non-array preferences and oversized designation are rejected", () => {
  for (const preferredTimeSlots of ["morning", ["night"], ["morning", "morning"], [null], {}]) {
    assert.equal(validateConsultantFields({ ...legacy, preferredTimeSlots }).isValid, false);
  }
  assert.equal(validateConsultantFields({ ...legacy, designation: "x".repeat(121) }).isValid, false);
  assert.equal(validateConsultantFields({ ...legacy, preferredTimeSlots: ["morning", "noon", "evening"] }).isValid, true);
});
test("custom consultant times persist and format without locale or timezone changes", () => {
  const preferredSlotTimings = { morning: { startTime: "09:30", endTime: "11:45" }, noon: { startTime: "12:15", endTime: "14:30" } };
  const result = validateConsultantFields({ ...legacy, preferredTimeSlots: ["morning", "noon"], preferredSlotTimings });
  assert.equal(result.isValid, true);
  assert.deepEqual(result.data.preferredSlotTimings, preferredSlotTimings);
  assert.equal(formatConsultantTimeSlot("morning", result.data.preferredSlotTimings), "Morning: 9:30 AM – 11:45 AM");
});
test("invalid, reversed and unselected timing entries are rejected", () => {
  for (const timing of [null, "09:30", {}, { startTime: "", endTime: "12:00" }, { startTime: "25:00", endTime: "12:00" }, { startTime: "12:00", endTime: "09:00" }, { startTime: "09:00", endTime: "09:00" }]) {
    assert.equal(validateConsultantFields({ ...legacy, preferredTimeSlots: ["morning"], preferredSlotTimings: { morning: timing } }).isValid, false);
  }
  assert.equal(validateConsultantFields({ ...legacy, preferredTimeSlots: [], preferredSlotTimings: { morning: { startTime: "09:00", endTime: "12:00" } } }).isValid, false);
});
