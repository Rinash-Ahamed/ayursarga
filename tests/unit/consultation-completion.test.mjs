import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
import { bookingFlowFixture } from "../helpers/bookingFlowFixture.mjs";

const { consultationCompletionEligibility: eligibility } = loadTypeScript("features/consultations/completion.ts");
const booking = { status: "confirmed", confirmedDate: "2026-11-12", confirmedTime: "09:30", confirmedEndTime: "10:00", slotStartTime: "09:30", slotEndTime: "12:00" };
const end = Date.parse("2026-11-12T10:00:00+05:30");
test("completion uses the saved exact end in IST, inclusively, not the broader preferred window", () => {
  assert.equal(eligibility(booking, end - 1).allowed, false);
  assert.equal(eligibility(booking, end).allowed, true);
  assert.equal(eligibility(booking, end).endsAt, "2026-11-12T04:30:00.000Z");
  assert.equal(eligibility({ ...booking, status: "cancelled" }, end).allowed, false);
  assert.equal(eligibility(booking, NaN).allowed, false);
  for (const invalid of [null, undefined, [], "confirmed", { status: "confirmed" }]) {
    assert.equal(eligibility(invalid, end).allowed, false);
  }
});
test("legacy appointments use their saved window end; invalid or missing schedules fail closed", () => {
  assert.equal(eligibility({ ...booking, confirmedTime: null, confirmedEndTime: null }, end).allowed, false);
  assert.equal(eligibility({ ...booking, confirmedTime: null, confirmedEndTime: null }, Date.parse("2026-11-12T12:00:00+05:30")).allowed, true);
  for (const changes of [{ confirmedDate: "2026-02-30" }, { confirmedDate: "12/11/2026" }, { confirmedEndTime: "09:00" },
    { confirmedEndTime: "25:00" }, { confirmedEndTime: null, slotEndTime: null }]) {
    assert.equal(eligibility({ ...booking, ...changes }, end + 86400000).allowed, false);
  }
});
const id = `consultation-${"a".repeat(64)}`;
const path = `consultationBookings/${id}`;
const patch = (f, body = { action: "completed", expectedAuditId: "opened" }) => f.load("app/api/consultations/[bookingId]/route.ts").PATCH(
  new Request("https://test.local/api/test", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  { params: Promise.resolve({ bookingId: id }) });
const fixture = (changes = {}, options = {}) => bookingFlowFixture({ actor: { role: "admin", uid: "admin" }, ...options,
  records: { [path]: { ...booking, consumerId: "patient", consultantId: "AS001", serviceName: "Doctor consultation", bookingReference: "AYURTEST01", lastAuditId: "opened", archivedAt: null, ...changes } } });
test("future completion is rejected atomically without bookings, audits, notifications, emails or finance changes", async () => {
  const f = fixture({ confirmedDate: "2099-12-01" });
  const before = f.records.get(path);
  assert.equal((await patch(f)).status, 409);
  assert.equal(f.records.get(path), before); assert.equal(f.calls.writes.length, 0);
  assert.equal(f.values("notifications").length, 0); assert.equal(f.values("consultationEmailEvents").length, 0);
});
test("past completion is audited once, retries are harmless, and consumers/other roles cannot complete", async () => {
  const f = fixture({ confirmedDate: "2001-01-01" });
  assert.equal((await patch(f)).status, 200);
  assert.equal(f.records.get(path).status, "completed"); assert.ok(f.records.get(path).completedAt);
  const audits = f.values("auditLogs").length, notices = f.values("notifications").length;
  assert.equal((await patch(f)).status, 200);
  assert.equal(f.values("auditLogs").length, audits); assert.equal(f.values("notifications").length, notices);
  for (const role of ["consumer", "hospital"]) {
    const denied = fixture({ confirmedDate: "2001-01-01" }, { actor: { role, uid: "patient" } });
    assert.equal((await patch(denied)).status, 403); assert.equal(denied.calls.writes.length, 0);
  }
});
