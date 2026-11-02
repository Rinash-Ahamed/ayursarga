import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
import { bookingFlowFixture, BookingTestAuthorizationError } from "../helpers/bookingFlowFixture.mjs";

const { hospitalContractContent, hasCurrentHospitalContract } = loadTypeScript("features/hospitals/contractApproval.ts");
const original = { name: "Centre", legalName: "Original Legal Entity", email: "centre@example.test", phone: "9876543210",
  hospitalPhone1: "9876543210", registeredAddress: "Registered address, Palakkad", address: "Service address, Palakkad",
  city: "Palakkad", district: "Palakkad", state: "Kerala", commissionPercentage: 10,
  registrationNumber: "123456", cinNumber: "NOT APPLICABLE", panNumber: "ABCDE1234F", gstin: "NOT APPLICABLE",
  contractEffectiveDate: "2026-11-02", contractExpiryDate: "2029-11-02", emergencyContact: "9876543210", emergencyReferralHospital: "Nearby Hospital",
  status: "pending", isPublic: false, contractStatus: "signed", contractGeneratedAt: Timestamp.fromMillis(1000), contractSignedAt: Timestamp.fromMillis(2000),
  contractGeneratedBy: "earlier-admin", contractSignedBy: "earlier-admin", contractUrl: "https://example.test/original-signed.pdf",
  imageUrls: Array.from({ length: 5 }, (_, index) => `https://images.test/${index}.webp`), archivedAt: null };
const context = { params: Promise.resolve({ hospitalId: "centre" }) };
function fixture(options = {}) {
  let f;
  f = bookingFlowFixture({ ...options, actor: { uid: "admin", role: "admin", ...options.actor },
    records: { "hospitals/centre": { ...original, ...options.hospital }, ...options.records }, overrides: {
      "@/services/firebase/adminAuthorization": { AdminAuthorizationError: BookingTestAuthorizationError, requireActiveAdmin: async () => {
        if (f.actor.role !== "admin") throw new BookingTestAuthorizationError("Denied", 403);
        return { uid: "admin", firestore: f.firestore, auth: { updateUser: async () => {}, revokeRefreshTokens: async () => {} } };
      } },
    } });
  f.firestore.batch = () => {
    const pending = [];
    return { update: (...args) => pending.push(["update", args]), set: (...args) => pending.push(["set", args]),
      commit: () => f.firestore.runTransaction(async transaction => {
        for (const [method, args] of pending) transaction[method](...args);
      }) };
  };
  const update = (action, data) => f.load("app/api/admin/hospitals/[hospitalId]/route.ts").PATCH(new Request("https://local.test/api/admin/hospitals/centre", {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data }),
  }), context);
  const activate = () => f.load("app/api/admin/hospitals/[hospitalId]/activate/route.ts").POST(new Request("https://local.test/api/admin/hospitals/centre/activate", { method: "POST" }), context);
  return { ...f, update, activate, current: () => f.records.get("hospitals/centre") };
}

test("pending material edits preserve the old signed agreement but require new generation and signing before activation", async () => {
  const f = fixture();
  const previousContent = hospitalContractContent(f.current());
  assert.equal((await f.update("update", { legalName: "Different Legal Entity" })).status, 200);
  assert.equal(f.current().contractNeedsRegeneration, true);
  assert.equal(f.current().contractSignedAt.toMillis(), original.contractSignedAt.toMillis());
  assert.equal(f.current().contractUrl, original.contractUrl);
  assert.equal(hasCurrentHospitalContract(f.current()), false);
  assert.equal((await f.activate()).status, 409);
  assert.equal((await f.update("contract_signed", { contractUrl: original.contractUrl, expectedContent: hospitalContractContent(f.current()) })).status, 409);
  assert.equal((await f.update("contract_generated", { expectedContent: previousContent })).status, 409);
  const content = hospitalContractContent(f.current());
  assert.equal((await f.update("contract_generated", { expectedContent: content })).status, 200);
  assert.equal(f.current().contractStatus, "generated");
  assert.equal((await f.activate()).status, 409);
  assert.equal((await f.update("contract_signed", { expectedContent: content, contractUrl: "https://example.test/new-signed.pdf" })).status, 200);
  assert.equal(f.current().contractSignedContent, content);
  assert.ok(f.current().contractSignedAt.toMillis() > original.contractSignedAt.toMillis());
  assert.equal((await f.activate()).status, 200);
  assert.equal(f.current().isPublic, true);
  const history = f.values("hospitalContractRevisions");
  assert.equal(history.length, 3);
  assert.equal(history[0].previousValues.contractUrl, original.contractUrl);
  assert.equal(history[0].previousValues.particulars.legalName, original.legalName);
  for (const revision of history) assert.ok(f.records.get(`auditLogs/${revision.lastAuditId}`));
});

test("generated previews and signing cannot approve a different current contract revision", async () => {
  const f = fixture({ hospital: { contractStatus: "not_generated", contractSignedAt: null, contractUrl: null } });
  const content = hospitalContractContent(f.current());
  assert.equal((await f.update("contract_generated", { expectedContent: content })).status, 200);
  assert.equal((await f.update("update", { commissionPercentage: 12 })).status, 200);
  assert.equal((await f.update("contract_signed", { expectedContent: content, contractUrl: "https://example.test/signed.pdf" })).status, 409);
  assert.equal((await f.update("contract_generated", { expectedContent: content })).status, 409);
  assert.equal(f.current().contractNeedsRegeneration, true);
});

test("unchanged legacy approvals and active centres remain usable without rewriting agreed contracts", async () => {
  const legacy = fixture();
  assert.equal(hasCurrentHospitalContract(legacy.current()), true);
  assert.equal((await legacy.update("update", { legalName: original.legalName })).status, 200);
  assert.equal((await legacy.update("update", { imageUrls: original.imageUrls })).status, 200);
  assert.equal(legacy.current().contractNeedsRegeneration, undefined);
  assert.equal(legacy.values("hospitalContractRevisions").length, 0);
  assert.equal((await legacy.activate()).status, 200);
  const active = fixture({ hospital: { status: "active", isPublic: true } });
  assert.equal((await active.update("update", { name: "Updated Centre Name" })).status, 200);
  assert.equal(active.current().isPublic, true);
  assert.equal(active.current().contractSignedAt, original.contractSignedAt);
  assert.equal(active.values("hospitalContractRevisions").length, 0);
});

test("partial/corrupt new bindings cannot activate, and missing required particulars cannot generate", async () => {
  for (const hospital of [{ contractGeneratedContent: "stale" }, { contractSignedContent: "stale" }, { contractNeedsRegeneration: true }]) {
    const f = fixture({ hospital });
    assert.equal((await f.activate()).status, 409);
    assert.equal(f.calls.writes.length, 0);
  }
  const f = fixture({ hospital: { panNumber: "", contractStatus: "not_generated" } });
  assert.equal((await f.update("contract_generated", { expectedContent: hospitalContractContent(f.current()) })).status, 409);
  assert.equal(f.calls.writes.length, 0);
});

test("rejected commits and unauthorized or injected requests never create partial approval/history", async () => {
  const failed = fixture({ failCommit: true });
  assert.equal((await failed.update("update", { legalName: "Different Entity" })).status, 503);
  assert.equal(failed.current().legalName, original.legalName);
  assert.equal(failed.values("hospitalContractRevisions").length, 0);
  for (const role of ["consumer", "hospital"]) {
    const f = fixture({ actor: { role } });
    assert.equal((await f.update("contract_generated", { expectedContent: hospitalContractContent(f.current()) })).status, 403);
    assert.equal((await f.activate()).status, 403);
    assert.equal(f.calls.writes.length, 0);
  }
  const f = fixture();
  assert.equal((await f.update("update", { contractNeedsRegeneration: false })).status, 400);
  assert.equal((await f.update("contract_generated", {})).status, 409);
  assert.equal(f.calls.writes.length, 0);
});

test("rules deny direct approval/activation and pending-particular bypasses, preserving private immutable history", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const admin = rules.split("function validAdminHospitalUpdate() {")[1].split("function validHospitalBookingTransition")[0];
  assert.match(admin, /resource.data.status != 'pending'/);
  for (const action of ["contract_generated", "contract_signed", "hospital_activated"]) assert.doesNotMatch(admin, new RegExp(`action == '${action}'`));
  assert.match(rules, /match \/hospitalContractRevisions\/\{revisionId\} \{[\s\S]*?allow read: if isAdmin\(\);[\s\S]*?allow create, update, delete: if false;/);
});
