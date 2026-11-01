import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

class AuthError extends Error { constructor(status) { super("Denied"); this.status = status; } }
function fixture(options = {}) {
  let user = { role: "consumer", status: "active", email: "user@test.local", hospitalId: "centre", lastAuditId: "old", createdAt: "original", archivedAt: null, ...options.user };
  const writes = [];
  const firestore = { collection: name => ({ doc: (id = "audit") => ({ path: `${name}/${id}`, id }) }), runTransaction: async callback => {
    const pending = [];
    const result = await callback({
      get: async ref => ({ data: () => ref.path.startsWith("hospitals/") ? { status: "active", email: "user@test.local", ...options.hospital } : options.missing ? undefined : user }),
      update: (ref, data) => pending.push([ref.path, data]), create: (ref, data) => pending.push([ref.path, data]),
    });
    if (options.fail) throw new Error("Synthetic commit failure");
    writes.push(...pending);
    if (pending.length) user = { ...user, ...pending[0][1] };
    return result;
  } };
  const { PATCH } = loadTypeScript("app/api/admin/users/[userId]/status/route.ts", {
    "@/services/firebase/adminAuthorization": { AdminAuthorizationError: AuthError, requireActiveAdmin: async () => {
      if (options.denied) throw new AuthError(options.denied);
      return { uid: "admin", firestore, auth: { getUser: async () => ({ disabled: !!options.disabled }) } };
    } },
    "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status }) },
    "@/services/api/audit": { requestAuditDevice: () => ({ userAgent: "test" }) },
  });
  return { writes, send: (body = { status: "inactive", expectedAuditId: "old" }, userId = "user") => PATCH(new Request("https://test.local/api/admin/users/user/status", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ userId }) }) };
}

test("both account roles support audited reversible status changes and retries without archive/delete", async () => {
  for (const role of ["consumer", "hospital"]) {
    const f = fixture({ user: { role } });
    assert.equal((await f.send()).status, 200);
    assert.equal((await f.send()).status, 200);
    assert.equal(f.writes.length, 2);
    const audit = f.writes[1][1];
    assert.equal(audit.action, "status_change");
    assert.equal(audit.updatedValues.createdAt, "original");
    assert.equal(audit.updatedValues.archivedAt, null);
    assert.equal(audit.updatedValues.status, "inactive");
    assert.equal(audit.updatedValues.lastAuditId, "audit");
    assert.equal((await f.send({ status: "active", expectedAuditId: "audit" })).status, 200);
    assert.equal(f.writes.length, 4);
    assert.equal(f.writes[3][1].previousValues.status, "inactive");
    assert.equal(f.writes[3][1].updatedValues.status, "active");
    assert.ok(f.writes.every(([path]) => path.startsWith("users/") || path.startsWith("auditLogs/")));
  }
});

test("denied, invalid, archived, stale and failed requests never partially write", async () => {
  for (const [options, body, id, expected] of [
    [{ denied: 401 }, undefined, "user", 401], [{ denied: 403 }, undefined, "user", 403],
    [{ user: { role: "admin" } }, undefined, "user", 403], [{ missing: true }, undefined, "user", 404],
    [{ user: { status: "archived" } }, undefined, "user", 409], [{ user: { archivedAt: "date" } }, undefined, "user", 409],
    [{}, { status: "archived", expectedAuditId: "old" }, "user", 400], [{}, { status: "inactive" }, "user", 400],
    [{}, undefined, "../user", 400], [{}, undefined, "admin", 400],
    [{ user: { lastAuditId: "newer" } }, undefined, "user", 409], [{ fail: true }, undefined, "user", 503],
  ]) {
    const f = fixture(options);
    assert.equal((await f.send(body, id)).status, expected);
    assert.equal(f.writes.length, 0);
  }
});

test("hospital login activation cannot bypass centre activation, official email, archive or disabled Auth", async () => {
  for (const options of [
    { hospital: { status: "inactive" } }, { hospital: { status: "pending" } }, { hospital: { archivedAt: "date" } },
    { hospital: { email: "another@test.local" } }, { user: { hospitalId: null } }, { disabled: true },
  ]) {
    const f = fixture({ ...options, user: { role: "hospital", status: "inactive", ...options.user } });
    assert.equal((await f.send({ status: "active", expectedAuditId: "old" })).status, 409);
    assert.equal(f.writes.length, 0);
  }
});

test("shared server authorization blocks inactive Consumer and Hospital profiles even with valid tokens", async () => {
  let profile = { uid: "account", role: "consumer", status: "active" };
  const authorization = loadTypeScript("services/firebase/adminAuthorization.ts", {
    "@/services/firebase/admin": {
      getFirebaseAdminAuth: () => ({ verifyIdToken: async () => ({ uid: "account" }) }),
      getFirebaseAdminFirestore: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => profile }) }) }) }),
    },
  });
  const request = new Request("https://test.local/", { headers: { Authorization: "Bearer valid-test-token" } });
  for (const role of ["consumer", "hospital"]) {
    profile = { ...profile, role, status: "active" };
    assert.equal((await authorization.requireActiveUser(request, [role])).role, role);
    profile.status = "inactive";
    await assert.rejects(authorization.requireActiveUser(request, [role]), error => error.status === 403);
    profile.status = "active";
    assert.equal((await authorization.requireActiveUser(request, [role])).role, role);
  }
});
