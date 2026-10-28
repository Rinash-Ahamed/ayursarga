import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

function fixture() {
  let role = "admin", enrolled = false, claims = { email_verified: true, firebase: { sign_in_provider: "password" } };
  let subscriber;
  let getProfile = async () => ({ uid: "actor", email: "actor@example.test", role, status: "active" });
  const calls = { signouts: 0, profiles: 0, resolves: 0, enrolls: 0, reauths: 0 };
  const auth = { currentUser: null };
  const user = { uid: "actor", email: "actor@example.test", emailVerified: true, reload: async () => {}, getIdToken: async () => "test-token", getIdTokenResult: async () => ({ claims }) };
  const nativeError = () => Object.assign(new Error("MFA"), { code: "auth/multi-factor-auth-required" });
  const firebase = {
    EmailAuthProvider: { credential: (email, password) => ({ email, password }) }, GoogleAuthProvider: class {},
    onIdTokenChanged: (_auth, listener) => { subscriber = listener; return () => { subscriber = undefined; }; },
    signInWithEmailAndPassword: async () => { if (enrolled) throw nativeError(); auth.currentUser = user; return { user }; },
    signInWithPopup: async () => { auth.currentUser = user; return { user }; },
    signOut: async () => { calls.signouts++; auth.currentUser = null; subscriber?.(null); },
    reauthenticateWithCredential: async () => { calls.reauths++; if (enrolled) throw nativeError(); return { user }; }, updatePassword: async () => {},
    multiFactor: () => ({ enrolledFactors: enrolled ? [{ factorId: "totp", uid: "factor" }] : [], getSession: async () => "session", enroll: async () => { calls.enrolls++; enrolled = true; } }),
    TotpMultiFactorGenerator: { FACTOR_ID: "totp", generateSecret: async () => ({ secretKey: "SYNTHETICKEY", enrollmentCompletionDeadline: "2099-01-01" }),
      assertionForEnrollment: (_secret, code) => ({ code }), assertionForSignIn: (_uid, code) => ({ code }) },
    getMultiFactorResolver: () => ({ hints: [{ factorId: "totp", uid: "factor" }], resolveSignIn: async ({ code }) => {
      calls.resolves++;
      if (code !== "123456") throw Object.assign(new Error("invalid"), { code: "auth/invalid-verification-code" });
      claims = { ...claims, firebase: { sign_in_provider: "password", sign_in_second_factor: "totp" } };
      auth.currentUser = user; return { user };
    } }),
  };
  const overrides = { "firebase/auth": firebase, "@/features/auth/errors": loadTypeScript("features/auth/errors.ts"), "@/services/auth/client": { getClientAuth: () => auth },
    "@/services/users/userService": { getUserProfile: async () => { calls.profiles++; return getProfile(); }, clearUserProfileCache: () => {} } };
  const mfa = loadTypeScript("services/auth/adminMfaService.ts", overrides);
  const { authService } = loadTypeScript("services/auth/authService.ts", { ...overrides, "@/services/auth/adminMfaService": mfa });
  return { authService, mfa, auth, user, calls, emit: (value) => subscriber?.(value),
    role: (value) => { role = value; }, enrolled: (value) => { enrolled = value; }, profile: (value) => { getProfile = value; } };
}
const credentials = { email: "actor@example.test", password: "synthetic-password" };

test("password-only Admin reaches enrollment, not an authorized profile", async () => {
  const f = fixture();
  await assert.rejects(f.authService.login(credentials, "admin"), (error) => error.code === "mfa-enrollment-required");
  assert.equal(f.calls.signouts, 0); assert.equal(f.auth.currentUser.uid, "actor");
  await assert.rejects(f.authService.getCurrentProfile(), (error) => error.code === "mfa-enrollment-required");
});

test("enrollment without a second-factor sign-in claim requires fresh password and OTP login, never a trusted enrollment flag", async () => {
  const f = fixture();
  await assert.rejects(f.authService.login(credentials, "admin"), (error) => error.code === "mfa-enrollment-required");
  await f.mfa.prepareAdminMfaEnrollment();
  await assert.rejects(f.authService.completeAdminMfaEnrollment("123456"), (error) => error.code === "mfa-sign-in-required");
  assert.equal(f.calls.enrolls, 1); assert.equal(f.calls.signouts, 1);
  await assert.rejects(f.authService.login(credentials, "admin"), (error) => error.code === "mfa-required");
  assert.equal((await f.authService.completeAdminMfa("123456")).role, "admin");
});

test("enrolled Admin cannot read profile via login before resolving the real native challenge; failed OTP can retry", async () => {
  const f = fixture(); f.enrolled(true);
  await assert.rejects(f.authService.login(credentials, "admin"), (error) => error.code === "mfa-required");
  assert.equal(f.calls.profiles, 0);
  await assert.rejects(f.authService.completeAdminMfa("000000"), (error) => error.code === "mfa-invalid-code");
  assert.equal(f.calls.profiles, 0);
  assert.equal((await f.authService.completeAdminMfa("123456")).role, "admin");
  assert.equal(f.calls.resolves, 2);
  assert.equal((await f.authService.getCurrentProfile()).role, "admin");
  await f.authService.logout();
  await assert.rejects(f.authService.completeAdminMfa("123456"), (error) => error.code === "mfa-session-expired");
});

test("Hospital password and Consumer Google sign-in remain independent of Admin enrollment requirements", async () => {
  const f = fixture(); f.role("hospital");
  assert.equal((await f.authService.login(credentials, "hospital")).role, "hospital");
  f.role("consumer");
  assert.equal((await f.authService.loginConsumerWithGoogle()).role, "consumer");
  assert.equal(f.calls.resolves, 0); assert.equal(f.calls.enrolls, 0);
});

test("an MFA challenge cannot grant the wrong role and cancellation clears pending resolver state", async () => {
  const f = fixture(); f.enrolled(true); f.role("hospital");
  await assert.rejects(f.authService.login(credentials, "admin"), (error) => error.code === "mfa-required");
  await assert.rejects(f.authService.completeAdminMfa("123456"), (error) => error.code === "role-mismatch");
  assert.equal(f.calls.signouts, 1);
  await assert.rejects(f.authService.login(credentials, "admin"), (error) => error.code === "mfa-required");
  await f.authService.logout();
  await assert.rejects(f.authService.completeAdminMfa("123456"), (error) => error.code === "mfa-session-expired");
});

test("Admin reauthentication needs a valid native OTP while Hospital reauthentication still accepts its password alone", async () => {
  const f = fixture(); f.enrolled(true); f.auth.currentUser = f.user;
  await assert.rejects(f.authService.reauthenticate("synthetic-password"), (error) => error.code === "mfa-invalid-code");
  await f.authService.reauthenticate("synthetic-password", "123456");
  assert.equal(f.calls.resolves, 1);
  f.role("hospital"); f.enrolled(false);
  await f.authService.reauthenticate("synthetic-password");
  assert.equal(f.calls.resolves, 1);
});

test("late profile loads cannot resurrect an authorized session after sign-out/unsubscription", async () => {
  const f = fixture(); f.role("hospital");
  let resolveProfile;
  f.profile(() => new Promise((resolve) => { resolveProfile = resolve; }));
  const snapshots = [];
  const unsubscribe = f.authService.subscribe((snapshot) => snapshots.push(snapshot), () => {});
  f.emit(f.user);
  await new Promise((resolve) => setImmediate(resolve));
  f.emit(null);
  resolveProfile({ role: "hospital", status: "active" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(snapshots, [{ user: null, profile: null }]);
  unsubscribe();
});
