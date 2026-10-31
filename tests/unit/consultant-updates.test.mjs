import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const fields = { name: "Edited Doctor", email: "doctor@example.test", contactNo: "9876543210", whatsappNo: "9876543210", qualification: "BAMS", yearsExperience: 3.5,
  consultantCharge: 900.5, ayursargaCommissionPercentage: 12.5, designation: "Doctor", lastWorkedCompany: "Centre", address: "Address", emergencyContactNo: "9876543210",
  preferredDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], availableDates: Array.from({length:31}, (_, index) => `2099-10-${String(index + 1).padStart(2, "0")}`),
  consultationServices: ["prenatal-doctor", "prenatal-dietitian", "prenatal-yoga", "lactation", "womens-wellness", "cosmetologist", "psychologist"],
  preferredTimeSlots: ["morning", "noon", "evening"], preferredSlotTimings: { morning: { startTime: "09:00", endTime: "12:00" }, noon: { startTime: "12:00", endTime: "15:00" }, evening: { startTime: "15:00", endTime: "18:00" } } };
class AuthError extends Error { constructor(status) { super("Denied"); this.status = status; } }
function fixture(options = {}) {
  let previous = { ...fields, name: "Original", employeeId: "AS001", employeeSequence: 1, createdAt: "original-date", createdBy: "creator", archivedAt: null, archivedBy: null, status: "active", imageUrl: "https://images.test/photo.webp", lastAuditId: "old" };
  if (options.archived) previous.archivedAt = "archive-date";
  if (options.legacy) {
    for (const key of ["consultantCharge", "ayursargaCommissionPercentage", "preferredDays", "availableDates", "preferredTimeSlots", "preferredSlotTimings", "consultationServices"]) delete previous[key];
  }
  const writes = [];
  const firestore = { collection: name => ({ doc: (id = "audit") => ({ path: `${name}/${id}`, id }) }), runTransaction: async callback => {
    const pending = [];
    const result = await callback({ get: async () => ({ exists: !options.missing, data: () => options.missing ? undefined : previous }), update: (ref, data) => pending.push([ref.path, data]), create: (ref, data) => pending.push([ref.path, data]) });
    if (options.fail) throw new Error("Synthetic commit failure");
    writes.push(...pending);
    if (pending.length) previous = { ...previous, ...pending[0][1] };
    return result;
  } };
  const { PATCH } = loadTypeScript("app/api/admin/consultants/[consultantId]/route.ts", {
    "@/services/firebase/adminAuthorization": { AdminAuthorizationError: AuthError, requireActiveAdmin: async () => { if (options.denied) throw new AuthError(options.denied); return { uid: "admin", firestore }; } },
    "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status }) },
    "@/services/api/audit": { requestAuditDevice: () => ({ userAgent: "test" }) },
  });
  return { writes, send: (body, id = "AS001") => PATCH(new Request("https://test.local/api/admin/consultants/AS001", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ consultantId: id }) }) };
}
test("full consultant edits including 31 dates and repeated saves preserve identity/photo and atomically audit current data", async () => {
  const f = fixture();
  for (const name of ["Edited Doctor", "Edited Again"]) assert.equal((await f.send({ action: "update", fields: { ...fields, name, imageUrl: "injected", employeeSequence: 99 } })).status, 200);
  assert.equal(f.writes.length, 4);
  const audit = f.writes[3][1];
  assert.equal(audit.previousValues.name, "Edited Doctor");
  assert.equal(audit.updatedValues.name, "Edited Again");
  assert.equal(audit.updatedValues.imageUrl, "https://images.test/photo.webp");
  assert.equal(audit.updatedValues.employeeSequence, 1);
  assert.equal(audit.updatedValues.createdBy, "creator");
  assert.equal(audit.updatedValues.availableDates.length, 31);
  assert.equal(audit.updatedValues.lastAuditId, "audit");
  assert.equal(audit.actorRole, "admin");
});
test("status-only saves preserve legacy profiles without forcing new pricing or availability", async () => {
  const f = fixture({ legacy: true });
  assert.equal((await f.send({ action: "status_change", status: "inactive", fields: { name: "Injected" } })).status, 200);
  assert.equal(f.writes[1][1].updatedValues.name, "Original");
  assert.equal(f.writes[1][1].updatedValues.status, "inactive");
  assert.equal(f.writes[1][1].action, "status_change");
  assert.equal(Object.hasOwn(f.writes[1][1].updatedValues, "consultantCharge"), false);
});
test("unauthenticated/unauthorized, missing, archived and invalid saves cannot create partial writes", async () => {
  for (const [options, body, id, expected] of [
    [{denied:401}, {action:"update",fields}, "AS001",401], [{denied:403}, {action:"update",fields}, "AS001",403],
    [{missing:true}, {action:"update",fields}, "AS001",404], [{archived:true}, {action:"update",fields}, "AS001",409],
    [{}, {action:"update",fields}, "../AS001",400], [{}, {action:"delete"}, "AS001",400], [{}, {action:"status_change",status:"archived"}, "AS001",400],
    [{}, {action:"update",fields:{...fields,consultantCharge:-1}}, "AS001",400], [{}, {action:"update",fields:{...fields,availableDates:["2099-02-30"]}}, "AS001",400],
    [{}, {action:"update",fields:{...fields,preferredDays:["invalid"]}}, "AS001",400], [{fail:true}, {action:"update",fields}, "AS001",503],
  ]) {
    const f = fixture(options);
    assert.equal((await f.send(body,id)).status, expected);
    assert.equal(f.writes.length, 0);
  }
});
