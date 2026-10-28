import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

function fixture() {
  const now = Math.floor(Date.now() / 1000);
  const state = { enabled: true, allow: true, calls: [], audits: new Map(), fail: "", role: "admin", status: "active",
    decoded: { uid: "admin", email: "admin@example.test", email_verified: true, auth_time: now,
      firebase: { sign_in_provider: "password", sign_in_second_factor: "totp" } },
    account: { email: "admin@example.test", emailVerified: true, disabled: false,
      multiFactor: { enrolledFactors: [{ uid: "factor-original", factorId: "totp" }] } } };
  let queue = Promise.resolve();
  const firestore = { collection: name => ({ doc: id => ({ id,
    get: async () => ({ exists: true, data: () => ({ uid: "admin", role: state.role, status: state.status, ...state.profileChanges }) }),
    create: async data => { if (state.fail === "audit") throw Error("private-error"); const key = name + id; if (state.audits.has(key)) throw Object.assign(Error("exists"), { code: 6 }); state.audits.set(key, data); },
  }) }), runTransaction: work => {
    const result = queue.then(async () => {
      const writes = [];
      const result = await work({ get: ref => ref.get(), create: (ref, data) => writes.push(() => ref.create(data)), update: (_ref, data) => writes.push(() => { state.profileChanges = data; }) });
      for (const write of writes) await write();
      return result;
    });
    queue = result.catch(() => undefined); return result;
  } };
  const auth = {
    verifyIdToken: async (_token, revoked) => { assert.equal(revoked, true); return state.decoded; },
    getUser: async uid => { assert.equal(uid, "admin"); return state.account; },
    updateUser: async (uid, data) => { state.calls.push(["update", uid, data]); if (state.fail === "update") throw Error("private-error"); },
    revokeRefreshTokens: async uid => { state.calls.push(["revoke", uid]); if (state.fail === "revoke") throw Error("private-error"); },
  };
  const route = loadTypeScript("app/api/admin/authenticator/route.ts", {
    "@/config/adminMfaRecovery": { isAdminMfaRecoveryEnabled: () => state.enabled },
    "@/services/firebase/admin": { getFirebaseAdminAuth: () => auth, getFirebaseAdminFirestore: () => firestore },
    "@/services/api/rateLimit": { allowRequest: () => state.allow },
    "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status }) },
    "firebase-admin/firestore": { FieldValue: { serverTimestamp: () => "timestamp" } },
  });
  const send = (body = { confirmation: "replace-my-authenticator", factorId: "factor-original" }, token = true) => route.POST(new Request("https://test.local/api/admin/authenticator", {
    method: "POST", headers: token ? { Authorization: "Bearer synthetic" } : {}, body: JSON.stringify(body),
  }));
  return { state, send };
}

test("replacement is server-flagged and requires an active Admin with native TOTP, password and verified email", async () => {
  const f = fixture(); f.state.enabled = false; assert.equal((await f.send()).status, 403); f.state.enabled = true;
  assert.equal((await f.send(undefined, false)).status, 401);
  for (const role of ["hospital", "consumer"]) { f.state.role = role; assert.equal((await f.send()).status, 403); }
  f.state.role = "admin"; f.state.status = "archived"; assert.equal((await f.send()).status, 403); f.state.status = "active";
  for (const claim of [{ sign_in_provider: "password" }, { sign_in_provider: "google.com", sign_in_second_factor: "totp" }]) {
    f.state.decoded.firebase = claim; assert.equal((await f.send()).status, 403);
  }
  assert.equal(f.state.calls.length, 0); assert.equal(f.state.audits.size, 0);
});

test("replacement rejects stale/future authentication, missing confirmation, target injection and changed factors", async () => {
  for (const age of [600, -600, NaN]) {
    const f = fixture(); f.state.decoded.auth_time = Math.floor(Date.now()/1000) - age;
    assert.equal((await f.send()).status, 401); assert.equal(f.state.calls.length, 0);
  }
  const f = fixture();
  for (const body of [{}, { confirmation: "replace-my-authenticator", factorId: "factor-original", uid: "other-admin" }]) assert.equal((await f.send(body)).status, 400);
  assert.equal((await f.send({ confirmation: "replace-my-authenticator", factorId: "new-factor" })).status, 409);
  f.state.account.multiFactor.enrolledFactors.push({ uid: "another", factorId: "totp" });
  assert.equal((await f.send()).status, 409); assert.equal(f.state.calls.length, 0);
});

test("replacement claims once before native Auth changes, revokes sessions and appends outcomes without touching operational data", async () => {
  const f = fixture();
  const results = await Promise.all([f.send(), f.send()]);
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.ok(results.every(r => [200, 401, 403, 409].includes(r.status)));
  assert.deepEqual(f.state.calls, [["update", "admin", { multiFactor: { enrolledFactors: [] } }], ["revoke", "admin"]]);
  assert.deepEqual([...f.state.audits.values()].map(a => a.updatedValues.outcome), ["started", "completed"]);
  assert.ok([...f.state.audits.keys()].every(key => key.startsWith("auditLogs")));
  assert.ok(f.state.profileChanges.adminSessionRevokedBefore >= f.state.decoded.auth_time);
  assert.equal(f.state.profileChanges.updatedBy, "admin");
  assert.ok(f.state.audits.has("auditLogs" + f.state.profileChanges.lastAuditId));
  assert.equal((await f.send()).status, 403, "old native MFA token is denied even if native revocation check still accepts it");
});

test("rate limits, audit failure and ambiguous Auth/revocation failure never claim success or replay mutation", async () => {
  const limited = fixture(); limited.state.allow = false; assert.equal((await limited.send()).status, 429); assert.equal(limited.state.calls.length, 0);
  for (const failure of ["audit", "update", "revoke"]) {
    const f = fixture(); f.state.fail = failure; const response = await f.send();
    assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private-error/);
    if (failure === "audit") assert.equal(f.state.calls.length, 0);
    else {
      assert.equal([...f.state.audits.values()].at(-1).updatedValues.outcome, "unknown");
      const before = f.state.calls.length;
      assert.equal((await f.send()).status, 403); assert.equal(f.state.calls.length, before);
    }
  }
});

test("replacement client reauthenticates before sending, sends no password/code/target UID and signs out after uncertain responses", async (t) => {
  const calls = []; let reject = false, failReauth = false;
  const oldWindow = globalThis.window;
  globalThis.window = { location: { assign: url => calls.push(["navigate", url]) } };
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; });
  const service = loadTypeScript("services/auth/adminMfaReplacementService.ts", {
    "firebase/auth": { multiFactor: () => ({ enrolledFactors: [{ uid: "original", factorId: "totp" }] }) },
    "@/services/auth/client": { getClientAuth: () => ({ currentUser: { reload: async () => calls.push(["reload"]) } }) },
    "@/services/auth/authService": { authService: { reauthenticate: async () => { calls.push(["reauth"]); if (failReauth) throw Error("invalid-code"); }, logout: async () => calls.push(["logout"]) } },
    "@/services/api/client": { authorizedApiRequest: async (_url, options) => { calls.push(["post", JSON.parse(options.body)]); if (reject) throw Error("network"); return { ok: true }; } },
  });
  await service.replaceAdminAuthenticator("synthetic-password", "123456");
  assert.deepEqual(calls.map(c => c[0]), ["reauth", "reload", "post", "logout", "navigate"]);
  assert.deepEqual(calls[2][1], { confirmation: "replace-my-authenticator", factorId: "original" });
  calls.length = 0; reject = true;
  await assert.rejects(service.replaceAdminAuthenticator("synthetic-password", "123456"), /network/);
  assert.deepEqual(calls.at(-1), ["navigate", "/admin/login?authenticator=check"]);
  calls.length = 0; failReauth = true;
  await assert.rejects(service.replaceAdminAuthenticator("synthetic-password", "123456"));
  assert.deepEqual(calls, [["reauth"]]);
});
