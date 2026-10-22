import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

test("password setup verifies and consumes the code through the shared Firebase Auth", async () => {
  const auth = {};
  const calls = [];
  let expired = false;
  const service = loadTypeScript("services/auth/passwordActionService.ts", {
    "@/services/auth/client": { getClientAuth: () => auth },
    "firebase/auth": {
      verifyPasswordResetCode: async (...args) => { calls.push(["verify", ...args]); if (expired) throw { code: "auth/expired-action-code" }; },
      confirmPasswordReset: async (...args) => { calls.push(["confirm", ...args]); if (expired) throw { code: "auth/invalid-action-code" }; },
    },
  });
  await assert.rejects(service.verifyPasswordAction(""));
  await assert.rejects(service.completePasswordAction("code", "weak"));
  assert.equal(calls.length, 0);
  await service.verifyPasswordAction("code");
  await service.completePasswordAction("code", "Test-password1");
  assert.deepEqual(calls, [["verify", auth, "code"], ["confirm", auth, "code", "Test-password1"]]);
  expired = true;
  await assert.rejects(service.verifyPasswordAction("code"));
  await assert.rejects(service.completePasswordAction("code", "Test-password1"));
  assert.match(service.passwordActionError({ code: "auth/expired-action-code" }), /expired/);
  assert.match(service.passwordActionError({ code: "auth/network-request-failed" }), /connection/);
});

test("concurrent code checks share a request, while completed and failed checks are never cached", async () => {
  let requests = 0;
  let reject = false;
  const service = loadTypeScript("services/auth/passwordActionService.ts", {
    "@/services/auth/client": { getClientAuth: () => ({}) },
    "firebase/auth": { verifyPasswordResetCode: async () => {
      requests++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (reject) throw { code: "auth/expired-action-code" };
    } },
  });
  await Promise.all([service.verifyPasswordAction("first"), service.verifyPasswordAction("first")]);
  assert.equal(requests, 1);
  await service.verifyPasswordAction("first");
  assert.equal(requests, 2);
  await Promise.all([service.verifyPasswordAction("first"), service.verifyPasswordAction("second")]);
  assert.equal(requests, 4);
  reject = true;
  const failures = await Promise.allSettled([service.verifyPasswordAction("first"), service.verifyPasswordAction("first")]);
  assert.ok(failures.every((result) => result.status === "rejected"));
  assert.equal(requests, 5);
  reject = false;
  await service.verifyPasswordAction("first");
  assert.equal(requests, 6);
});
