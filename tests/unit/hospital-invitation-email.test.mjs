import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

function fixture(options = {}) {
  class AuthorizationError extends Error { constructor() { super("Denied"); this.status = 403; } }
  const records = new Map([
    ["hospitals/centre", { name: "Hospital", email: "partner@example.com", status: options.inactive ? "inactive" : "active" }],
    ...(!options.newUser ? [["users/partner", { uid: "partner", name: "Hospital", email: "partner@example.com", role: options.conflictingRole ? "consumer" : "hospital", hospitalId: "centre", status: "active" }]] : []),
  ]);
  const calls = { emails: [], commits: 0, generatedAccount: 0, writes: [], lookup: 0 };
  const snapshot = (ref) => ({ id: ref.path.split("/")[1], ref, exists: records.has(ref.path), data: () => records.get(ref.path) });
  const firestore = {
    collection: (collection) => ({ doc: (id = "audit") => {
      const ref = { path: `${collection}/${id}` };
      return { ...ref, get: async () => snapshot(ref) };
    }, where: () => ({ get: async () => ({ docs: [] }) }) }),
    batch: () => {
      const pending = [];
      return { set: (ref, data) => pending.push({ ref, data }), update: (ref, data) => pending.push({ ref, data }), commit: async () => {
        if (options.failCommit) throw new Error("Atomic commit failed");
        calls.commits++;
        calls.writes.push(...pending);
        for (const { ref, data } of pending) records.set(ref.path, data);
      } };
    },
  };
  const auth = {
    getUserByEmail: async () => { calls.lookup++; if (options.newUser) throw { code: "auth/user-not-found" }; return { uid: "partner" }; },
    createUser: async () => { calls.generatedAccount++; return { uid: "partner" }; },
    deleteUser: async () => {}, updateUser: async () => {}, revokeRefreshTokens: async () => {},
  };
  const route = loadTypeScript("app/api/admin/hospitals/[hospitalId]/login-setup/route.ts", {
    "@/services/firebase/adminAuthorization": { AdminAuthorizationError: AuthorizationError, requireActiveAdmin: async () => { if (options.denied) throw new AuthorizationError(); return { uid: "admin", auth, firestore }; } },
    "@/services/firebase/admin": { isFirebaseAdminReady: () => true },
    "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status }), apiHealth: () => Response.json({}) },
    "@/services/email/emailService": { isEmailReady: () => !options.unconfigured },
    "@/services/auth/authEmailService": { authEmailSiteUrl: () => "https://ayursarga.com", sendAuthEmail: async (_auth, input) => { if (options.sendFailure) throw new Error("Sensitive token should not be logged"); calls.emails.push(input); } },
    "@/services/api/rateLimit": { allowRequest: () => !options.limited },
  });
  const post = () => route.POST(new Request("https://ayursarga.com/api/admin/hospitals/centre/login-setup", { method: "POST" }), { params: Promise.resolve({ hospitalId: "centre" }) });
  return { calls, records, post };
}

test("Admin hospital invitation sends only after audited provisioning and returns no reset token", async () => {
  for (const newUser of [false, true]) {
    const f = fixture({ newUser });
    const response = await f.post();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, email: "partner@example.com", emailSent: true });
    assert.equal(f.calls.commits, 1);
    assert.equal(f.calls.emails.length, 1);
    assert.deepEqual(f.calls.emails[0], { email: "partner@example.com", name: "Hospital", role: "hospital", invitation: true });
    assert.equal(f.records.get("auditLogs/audit").actorRole, "admin");
    assert.equal(f.records.get("users/partner").hospitalId, "centre");
    assert.equal(f.calls.generatedAccount, newUser ? 1 : 0);
  }
});

test("denied, unconfigured, limited, inactive, conflicting and failed provisioning never send invitations", async () => {
  const oldError = console.error;
  console.error = () => {};
  try {
    for (const [options, status] of [[{ denied: true }, 403], [{ unconfigured: true }, 503], [{ limited: true }, 429], [{ inactive: true }, 409], [{ conflictingRole: true }, 409], [{ failCommit: true }, 503]]) {
      const f = fixture(options);
      assert.equal((await f.post()).status, status);
      assert.equal(f.calls.emails.length, 0);
      assert.equal(f.calls.commits, 0);
    }
  } finally { console.error = oldError; }
});

test("invitation failure preserves provisioned records and reports retry instead of success", async () => {
  const oldError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args.join(" "));
  try {
    const f = fixture({ sendFailure: true });
    const response = await f.post();
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.match(body.error, /account is ready.*email could not be sent/);
    assert.equal(body.emailSent, undefined);
    assert.equal(f.calls.commits, 1);
    assert.ok(f.records.has("users/partner"));
    assert.equal(logs.length, 1);
    assert.ok(!logs[0].includes("Sensitive"));
  } finally { console.error = oldError; }
});

test("invitation client requires server-confirmed delivery and does not use Firebase's template sender", async () => {
  let response = { email: "partner@example.com", emailSent: true };
  const calls = [];
  const { sendHospitalLoginSetup } = loadTypeScript("services/auth/hospitalAccountService.ts", {
    "@/services/api/client": { authorizedApiRequest: async (url) => { calls.push(url); return response; } },
  });
  assert.equal(await sendHospitalLoginSetup("centre"), "partner@example.com");
  assert.equal(calls[0], "/api/admin/hospitals/centre/login-setup");
  response = { email: "partner@example.com" };
  await assert.rejects(sendHospitalLoginSetup("centre"));
});
