import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const verifiedClaims = { email_verified: true, firebase: { sign_in_provider: "password", sign_in_second_factor: "totp" } };
const passwordClaims = { email_verified: true, firebase: { sign_in_provider: "password" } };
const { hasAdminTotpSession, isAdminSessionAfterCutoff } = loadTypeScript("features/auth/adminMfa.ts");

test("Admin cutoff denies pre-reset, same-second, missing and malformed claims while preserving legacy records", () => {
  assert.equal(isAdminSessionAfterCutoff({}, undefined), true);
  assert.equal(isAdminSessionAfterCutoff({}, 0), true);
  for (const auth_time of [undefined, 99, 100, "101", NaN]) assert.equal(isAdminSessionAfterCutoff({ auth_time }, 100), false);
  assert.equal(isAdminSessionAfterCutoff({ auth_time: 101 }, 100), true);
  for (const cutoff of [null, -1, "100", NaN, 1.5]) assert.equal(isAdminSessionAfterCutoff({ auth_time: 101 }, cutoff), false);
});

test("Admin proof requires native TOTP, password sign-in and verified email, not client/profile flags", () => {
  assert.equal(hasAdminTotpSession(verifiedClaims), true);
  for (const claims of [{}, passwordClaims, { ...verifiedClaims, email_verified: false }, { ...verifiedClaims, email_verified: "true" },
    { email_verified: true, firebase: { sign_in_provider: "password", sign_in_second_factor: "phone" } },
    { email_verified: true, firebase: { sign_in_provider: "google.com", sign_in_second_factor: "totp" } },
    { ...passwordClaims, mfaVerified: true, adminMfaVerified: true }]) assert.equal(hasAdminTotpSession(claims), false);
});

test("real shared API guard rejects password-only Admin and leaves active Hospital/Consumer access unchanged", async () => {
  let profile = { uid: "actor", role: "admin", status: "active" };
  let claims = passwordClaims;
  let revoked = false;
  const authorization = loadTypeScript("services/firebase/adminAuthorization.ts", {
    "@/services/firebase/admin": {
      getFirebaseAdminAuth: () => ({ verifyIdToken: async (_token, checkRevoked) => { assert.equal(checkRevoked, true); if (revoked) throw Error("revoked"); return { uid: "actor", ...claims }; } }),
      getFirebaseAdminFirestore: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => profile }) }) }) }),
    },
  });
  const request = new Request("https://test.local/", { headers: { Authorization: "Bearer test-token" } });
  await assert.rejects(authorization.requireActiveAdmin(request), (error) => error.status === 403);
  await assert.rejects(authorization.requireActiveUser(request), (error) => error.status === 403);
  claims = verifiedClaims;
  assert.equal((await authorization.requireActiveAdmin(request)).role, "admin");
  profile = { ...profile, adminSessionRevokedBefore: 100 };
  claims = { ...verifiedClaims, auth_time: 100 };
  await assert.rejects(authorization.requireActiveAdmin(request), error => error.status === 403);
  claims = { ...verifiedClaims, auth_time: 101 };
  assert.equal((await authorization.requireActiveAdmin(request)).role, "admin");
  profile = { ...profile, adminSessionRevokedBefore: undefined };
  for (const role of ["hospital", "consumer"]) {
    profile = { ...profile, role }; claims = passwordClaims;
    assert.equal((await authorization.requireActiveUser(request, [role])).role, role);
    await assert.rejects(authorization.requireActiveAdmin(request), (error) => error.status === 403);
  }
  revoked = true;
  await assert.rejects(authorization.requireActiveUser(request), (error) => error.status === 401);
});

function nativeFixture() {
  const calls = [];
  let profile = { uid: "admin", role: "admin", status: "active" };
  let claims = passwordClaims;
  let failResolution = false;
  const factors = [];
  const user = { uid: "admin", email: "admin@example.test", emailVerified: true, reload: async () => calls.push("reload"),
    getIdTokenResult: async () => ({ claims }), getIdToken: async () => "token" };
  const auth = { currentUser: user };
  const secret = { secretKey: "SYNTHETICPRIVATEKEY", enrollmentCompletionDeadline: "2099-01-01T00:00:00Z",
    generateQrCodeUrl: (email, issuer) => { calls.push({ qr: { email, issuer } }); return `otpauth://totp/${issuer}:${email}?secret=JBSWY3DPEHPK3PXP&issuer=${issuer}`; } };
  const factor = { hints: [{ factorId: "totp", uid: "native-factor", displayName: "Authenticator" }], resolveSignIn: async (assertion) => {
    calls.push({ resolution: assertion });
    if (failResolution) throw Object.assign(new Error("invalid"), { code: "auth/invalid-verification-code" });
    claims = verifiedClaims; return { user };
  } };
  const firebase = {
    getMultiFactorResolver: () => factor,
    multiFactor: () => ({ enrolledFactors: factors, getSession: async () => "native-session", enroll: async (...args) => { calls.push({ enroll: args }); factors.push({ factorId: "totp", uid: "native-factor" }); } }),
    TotpMultiFactorGenerator: { FACTOR_ID: "totp", generateSecret: async (session) => { calls.push({ generate: session }); return secret; },
      assertionForSignIn: (id, code) => ({ id, code }), assertionForEnrollment: (received, code) => { assert.equal(received, secret); return { code }; } },
  };
  const service = loadTypeScript("services/auth/adminMfaService.ts", {
    "firebase/auth": firebase, "@/services/auth/client": { getClientAuth: () => auth },
    "@/services/users/userService": { getUserProfile: async () => profile },
  });
  return { ...service, user, auth, calls, factors, factor, profile: (value) => { profile = value; }, claims: (value) => { claims = value; }, fail: (value) => { failResolution = value; } };
}

test("native resolver handles codes, rejects unsupported factors, retains failed challenges for retry and clears on success/cancel", async () => {
  const f = nativeFixture();
  const challenge = { code: "auth/multi-factor-auth-required" };
  f.captureAdminMfaChallenge(challenge);
  await assert.rejects(f.resolveAdminMfaChallenge("123"), /six-digit/);
  f.fail(true);
  await assert.rejects(f.resolveAdminMfaChallenge("123456"), /invalid/);
  f.fail(false);
  assert.equal((await f.resolveAdminMfaChallenge("654321")).uid, "admin");
  await assert.rejects(f.resolveAdminMfaChallenge("654321"), /expired/);
  f.captureAdminMfaChallenge(challenge); f.clearAdminMfaState();
  await assert.rejects(f.resolveAdminMfaChallenge("654321"), /expired/);
  f.factor.hints = [{ factorId: "phone", uid: "phone-factor" }];
  assert.throws(() => f.captureAdminMfaChallenge(challenge), /unavailable/);
  assert.deepEqual(f.calls.filter((call) => call.resolution).map((call) => call.resolution), [{ id: "native-factor", code: "123456" }, { id: "native-factor", code: "654321" }]);
});

test("setup only generates a native secret for an active verified Admin; valid code is required for enrollment", async () => {
  const f = nativeFixture();
  f.profile({ role: "hospital", status: "active" });
  await assert.rejects(f.prepareAdminMfaEnrollment(), /access to this portal/);
  f.profile({ role: "admin", status: "inactive" });
  await assert.rejects(f.prepareAdminMfaEnrollment(), /inactive/);
  f.profile({ role: "admin", status: "active" }); f.user.emailVerified = false;
  await assert.rejects(f.prepareAdminMfaEnrollment(), /Verify your Admin email/);
  assert.equal(f.calls.some((call) => call.generate), false);
  f.user.emailVerified = true;
  const setup = await f.prepareAdminMfaEnrollment();
  assert.equal(setup.key, "SYNTHETICPRIVATEKEY");
  assert.match(setup.qrUri, /^otpauth:\/\/totp\/Ayursarga:/);
  assert.deepEqual(f.calls.find(call => call.qr).qr, { email: "admin@example.test", issuer: "Ayursarga" });
  await assert.rejects(f.enrollAdminMfa("12"), /six-digit/);
  f.auth.currentUser = { ...f.user, uid: "other" };
  await assert.rejects(f.enrollAdminMfa("123456"), /expired/);
  f.auth.currentUser = f.user;
  assert.equal((await f.enrollAdminMfa("123456")).uid, "admin");
  assert.equal(f.calls.filter((call) => call.enroll).length, 1);
  await assert.rejects(f.prepareAdminMfaEnrollment(), /Sign in again/);
  await assert.rejects(f.enrollAdminMfa("123456"), /expired/);
});

test("session gate does not authorize enrollment or old password sessions simply because a factor exists", async () => {
  const f = nativeFixture();
  await assert.rejects(f.assertAdminMfaSession(f.user), /Set up your Admin authenticator/);
  f.factors.push({ factorId: "totp" });
  await assert.rejects(f.assertAdminMfaSession(f.user), /Sign in again/);
  f.claims(verifiedClaims);
  await f.assertAdminMfaSession(f.user);
});

test("password reauthentication resolves native MFA with a new code, not an application bypass", async () => {
  const f = nativeFixture();
  await assert.rejects(f.resolveMfaReauthentication({ code: "auth/multi-factor-auth-required" }), /six-digit/);
  assert.equal((await f.resolveMfaReauthentication({ code: "auth/multi-factor-auth-required" }, "123456")).user.uid, "admin");
});

test("native email verification rejects other action types and updates current user's token after success", async () => {
  const calls = [];
  let operation = "PASSWORD_RESET";
  const service = loadTypeScript("services/auth/emailVerificationService.ts", {
    "firebase/auth": { ActionCodeOperation: { VERIFY_EMAIL: "VERIFY_EMAIL" }, checkActionCode: async () => ({ operation }), applyActionCode: async () => calls.push("apply") },
    "@/services/auth/client": { getClientAuth: () => ({ currentUser: { reload: async () => calls.push("reload"), getIdToken: async (force) => calls.push(force) } }) },
  });
  await assert.rejects(service.verifyAdminEmail(""), /missing/);
  await assert.rejects(service.verifyAdminEmail("reset-code"), /verification link/);
  assert.equal(calls.length, 0);
  operation = "VERIFY_EMAIL";
  await service.verifyAdminEmail("verify-code");
  assert.deepEqual(calls, ["apply", "reload", true]);
});

test("verification-email exception requires an active Admin's matching identity and recent password, with throttling and honest delivery errors", async () => {
  let profile = { uid: "admin", role: "admin", status: "active", email: "admin@example.test" };
  let decoded = { uid: "admin", email: "admin@example.test", auth_time: Math.floor(Date.now() / 1000), firebase: { sign_in_provider: "password" } };
  let allow = true, ready = true, fail = false;
  const emails = [];
  const route = loadTypeScript("app/api/auth/admin-email-verification/route.ts", {
    "@/services/firebase/adminAuthorization": { requireVerifiedFirebaseUser: async () => ({ uid: "admin", decoded, auth: "native-auth", firestore: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => profile }) }) }) } }), AdminAuthorizationError: class extends Error {} },
    "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status }) },
    "@/services/api/rateLimit": { allowRequest: () => allow },
    "@/services/auth/authEmailService": { isAuthEmailReady: () => ready, sendAdminVerificationEmail: async (...args) => { if (fail) throw Error("private-provider-error"); emails.push(args); } },
  });
  const request = new Request("https://test.local/", { method: "POST", body: JSON.stringify({ email: "attacker@example.test", url: "https://evil.test" }) });
  assert.equal((await route.POST(request)).status, 200);
  assert.deepEqual(emails[0], ["native-auth", "admin@example.test", ""]);
  for (const role of ["hospital", "consumer"]) { profile = { ...profile, role }; assert.equal((await route.POST(request)).status, 403); }
  profile = { ...profile, role: "admin", email: "different@example.test" };
  assert.equal((await route.POST(request)).status, 403);
  profile.email = "admin@example.test";
  decoded.auth_time -= 600; assert.equal((await route.POST(request)).status, 403); decoded.auth_time += 600;
  allow = false; assert.equal((await route.POST(request)).status, 429); allow = true;
  ready = false; assert.equal((await route.POST(request)).status, 503); ready = true;
  fail = true;
  const result = await route.POST(request);
  assert.equal(result.status, 502); assert.doesNotMatch(await result.text(), /private-provider-error/);
  decoded.email_verified = true;
  const verified = await route.POST(request);
  assert.equal(verified.status, 200); assert.deepEqual(await verified.json(), { ok: true, alreadyVerified: true }); assert.equal(emails.length, 1);
});

test("Admin verification mail uses branded server-owned fragment links without exposing generated codes in JSON", async () => {
  const emails = [];
  const previous = process.env.APP_SITE_URL; process.env.APP_SITE_URL = "https://www.ayursarga.com";
  try {
    const service = loadTypeScript("services/auth/authEmailService.ts", { "@/services/email/emailService": { sendEmail: async (email) => emails.push(email) } });
    await service.sendAdminVerificationEmail({ generateEmailVerificationLink: async (email, options) => {
      assert.equal(email, "admin@example.test"); assert.equal(options.url, "https://www.ayursarga.com/admin/login");
      return "https://firebase.test/__/auth/action?mode=verifyEmail&oobCode=synthetic-code";
    } }, "admin@example.test", "Admin <Name>");
    assert.match(emails[0].subject, /Verify.*Admin email/);
    assert.match(emails[0].html, /#1f3d2b/); assert.match(emails[0].html, /Admin &lt;Name&gt;/);
    assert.match(emails[0].text, /https:\/\/www.ayursarga.com\/auth\/verify-email#oobCode=synthetic-code/);
    assert.doesNotMatch(emails[0].html, /firebase.test/);
  } finally { if (previous === undefined) delete process.env.APP_SITE_URL; else process.env.APP_SITE_URL = previous; }
});

test("verification client distinguishes an already verified email from a submitted delivery request", async (t) => {
  const f = nativeFixture();
  let result = { ok: true, alreadyVerified: true };
  t.mock.method(globalThis, "fetch", async () => Response.json(result));
  assert.equal(await f.requestAdminEmailVerification(), true);
  result = { ok: true };
  assert.equal(await f.requestAdminEmailVerification(), false);
});
