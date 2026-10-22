import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const { authEmail } = loadTypeScript("lib/authEmail.ts");
const actionUrl = "https://test-project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=test-only-code";
const resetRequest = (body = { email: "partner@example.com" }, headers = {}) => new Request("https://ayursarga.com/api/auth/password-reset", { method: "POST", headers: { "content-type": "application/json", origin: "https://ayursarga.com", ...headers }, body: JSON.stringify(body) });

test("invitation and reset emails share branded HTML/text, escape names and require HTTPS links", () => {
  for (const kind of ["hospital-invitation", "password-reset"]) {
    const result = authEmail({ kind, name: '<script>"Example"</script>', actionUrl });
    assert.match(result.html, /#1f3d2b/);
    assert.match(result.html, /#f9f5ea/);
    assert.match(result.html, /Ayursarga/);
    assert.match(result.html, /&lt;script&gt;/);
    assert.doesNotMatch(result.html, /<script>/);
    assert.match(result.html, /&amp;oobCode=/);
    assert.ok(result.text.includes(actionUrl));
    assert.ok(result.subject.includes("Ayursarga"));
    assert.ok(result.html.includes(kind === "hospital-invitation" ? "Set your password" : "Reset your password"));
  }
  assert.throws(() => authEmail({ kind: "password-reset", name: "", actionUrl: "javascript:alert(1)" }));
});

test("generated reset links use a fixed configured return URL, stay server-only and propagate SMTP rejection", async () => {
  const previous = process.env.APP_SITE_URL;
  process.env.APP_SITE_URL = "https://ayursarga.com";
  try {
    const messages = [];
    const generated = [];
    let reject = false;
    const service = loadTypeScript("services/auth/authEmailService.ts", {
      "@/services/email/emailService": { sendEmail: async (data) => { if (reject) throw new Error("SMTP unavailable"); messages.push(data); } },
    });
    const auth = { generatePasswordResetLink: async (...args) => { generated.push(args); return actionUrl; } };
    await service.sendAuthEmail(auth, { email: "partner@example.com", name: "Hospital", role: "hospital", invitation: true });
    await service.sendAuthEmail(auth, { email: "admin@example.com", name: "Admin", role: "admin" });
    assert.deepEqual(generated[0][1], { url: "https://ayursarga.com/hospital/login", handleCodeInApp: false });
    assert.equal(generated[1][1].url, "https://ayursarga.com/admin/login");
    assert.equal(messages[0].to, "partner@example.com");
    assert.equal(messages[0].subject, "Your Ayursarga Hospital Portal invitation");
    for (const [index, role, kind] of [[0, "hospital", "invite"], [1, "admin", "reset"]]) {
      const link = new URL(messages[index].html.match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&"));
      assert.equal(link.origin, "https://ayursarga.com");
      assert.equal(link.pathname, "/auth/reset-password");
      assert.equal(link.search, "");
      const fragment = new URLSearchParams(link.hash.slice(1));
      assert.equal(fragment.get("oobCode"), "test-only-code");
      assert.equal(fragment.get("role"), role);
      assert.equal(fragment.get("kind"), kind);
    }
    reject = true;
    await assert.rejects(service.sendAuthEmail(auth, { email: "partner@example.com", name: "Hospital", role: "hospital" }));
    process.env.APP_SITE_URL = "javascript:alert(1)";
    assert.throws(() => service.authEmailSiteUrl());
  } finally { if (previous === undefined) delete process.env.APP_SITE_URL; else process.env.APP_SITE_URL = previous; }
});

function resetFixture(options = {}) {
  const calls = { lookups: 0, emails: [], logs: [] };
  const user = { uid: "partner", disabled: false, ...options.user };
  const profile = { email: "partner@example.com", name: "Hospital", role: "hospital", status: "active", ...options.profile };
  const route = loadTypeScript("app/api/auth/password-reset/route.ts", {
    "@/services/firebase/admin": {
      getFirebaseAdminAuth: () => ({ getUserByEmail: async () => { calls.lookups++; if (options.unknown) throw { code: "auth/user-not-found" }; return user; } }),
      getFirebaseAdminFirestore: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ data: () => options.missingProfile ? undefined : profile }) }) }) }),
    },
    "@/services/auth/authEmailService": { authEmailSiteUrl: () => "https://ayursarga.com", sendAuthEmail: async (_auth, data) => { if (options.deliveryFailure) throw new Error(`Sensitive ${actionUrl}`); calls.emails.push(data); } },
    "@/services/email/emailService": { isEmailReady: () => !options.unconfigured },
    "@/services/api/server": { apiJson: (data, status = 200) => Response.json(data, { status }) },
    "@/services/api/rateLimit": { requestFingerprint: () => "fingerprint", allowRequest: (key) => key === "fingerprint" ? !options.ipLimited : !options.emailLimited },
  });
  return { calls, ...route };
}

test("public resets send only to eligible portal accounts without returning action links or account existence", async () => {
  for (const options of [{}, { profile: { role: "admin" } }, { unknown: true }, { user: { disabled: true } }, { profile: { role: "consumer" } }, { profile: { status: "archived" } }, { missingProfile: true }, { profile: { email: "someone-else@example.com" } }]) {
    const fixture = resetFixture(options);
    const response = await fixture.POST(resetRequest());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    const eligible = !options.unknown && !options.user?.disabled && !options.missingProfile && !["consumer", "admin"].includes(options.profile?.role) && options.profile?.status !== "archived" && options.profile?.email !== "someone-else@example.com";
    assert.equal(fixture.calls.emails.length, eligible ? 1 : 0);
  }
});

test("Admin reset delivery is restricted to the approved Admin address", async () => {
  const fixture = resetFixture({ profile: { role: "admin", email: "info@ayursarga.com" } });
  const response = await fixture.POST(resetRequest({ email: "info@ayursarga.com" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(fixture.calls.emails.length, 1);
  assert.equal(fixture.calls.emails[0].email, "info@ayursarga.com");
});

test("reset API rejects cross-site/invalid/oversize requests and rate limits before delivery", async () => {
  for (const [options, request, status] of [
    [{}, resetRequest({}, { "sec-fetch-site": "cross-site" }), 403],
    [{}, resetRequest({}, { origin: "https://untrusted.example" }), 403],
    [{}, resetRequest({ email: "not-an-email" }), 400],
    [{}, resetRequest({ email: "a".repeat(2500) }), 413],
    [{ unconfigured: true }, resetRequest(), 503],
    [{ ipLimited: true }, resetRequest(), 429],
    [{ emailLimited: true }, resetRequest(), 200],
  ]) {
    const fixture = resetFixture(options);
    assert.equal((await fixture.POST(request)).status, status);
    assert.equal(fixture.calls.lookups, 0);
    assert.equal(fixture.calls.emails.length, 0);
  }
});

test("public delivery errors do not reveal account existence or leak action tokens into logs", async () => {
  const oldError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args.join(" "));
  try {
    const fixture = resetFixture({ deliveryFailure: true });
    const response = await fixture.POST(resetRequest());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(logs.length, 1);
    assert.ok(!logs[0].includes("oobCode") && !logs[0].includes("partner@example.com"));
  } finally { console.error = oldError; }
});

test("shared SMTP transport is reused, preserves contact mail settings and treats recipient rejection as failure", async () => {
  const oldUser = process.env.GMAIL_USER;
  const oldPassword = process.env.GMAIL_APP_PASSWORD;
  process.env.GMAIL_USER = "test-sender@example.com";
  process.env.GMAIL_APP_PASSWORD = "test-only-not-a-real-secret";
  try {
    const messages = [];
    let creations = 0;
    let reject = false;
    const service = loadTypeScript("services/email/emailService.ts", { nodemailer: { createTransport: () => { creations++; return { sendMail: async (message) => { messages.push(message); return reject ? { accepted: [], rejected: [message.to] } : { accepted: [message.to], rejected: [] }; } }; } } });
    assert.equal(service.isEmailReady(), true);
    await service.sendEmail({ to: "recipient@example.com", subject: "Test", html: "<p>Test</p>", text: "Test" });
    await service.sendEmail({ to: "contact@example.com", subject: "Test", html: "<p>Test</p>", text: "Test", senderName: "Ayursarga Website", replyTo: "visitor@example.com" });
    assert.equal(creations, 1);
    assert.equal(messages[0].from, "Ayursarga <test-sender@example.com>");
    assert.equal(messages[1].from, "Ayursarga Website <test-sender@example.com>");
    assert.equal(messages[1].replyTo, "visitor@example.com");
    reject = true;
    await assert.rejects(service.sendEmail({ to: "recipient@example.com", subject: "Test", html: "Test", text: "Test" }));
  } finally {
    if (oldUser === undefined) delete process.env.GMAIL_USER; else process.env.GMAIL_USER = oldUser;
    if (oldPassword === undefined) delete process.env.GMAIL_APP_PASSWORD; else process.env.GMAIL_APP_PASSWORD = oldPassword;
  }
});

test("shared auth client uses the reset API and preserves error types without invoking Firebase email templates", async () => {
  const requests = [];
  const oldFetch = globalThis.fetch;
  let status = 200;
  globalThis.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return Response.json(status === 200 ? { ok: true } : { error: "Service unavailable" }, { status });
  };
  try {
    const { authService } = loadTypeScript("services/auth/authService.ts", {
      "firebase/auth": {},
      "@/services/auth/client": { getClientAuth: () => { throw new Error("Password email sending must not use browser Firebase Auth"); } },
      "@/services/auth/session": {},
    });
    await authService.resetPassword(" partner@example.com ");
    assert.deepEqual(requests[0], { url: "/api/auth/password-reset", body: { email: "partner@example.com" } });
    status = 429;
    await assert.rejects(authService.resetPassword("partner@example.com"), (error) => error.code === "too-many-requests");
    status = 503;
    await assert.rejects(authService.resetPassword("partner@example.com"), (error) => error.code === "email-delivery");
  } finally { globalThis.fetch = oldFetch; }
});

test("contact enquiries preserve their existing recipient, reply-to and template through shared delivery", async () => {
  const oldRecipient = process.env.CONTACT_TO_EMAIL;
  process.env.CONTACT_TO_EMAIL = "contact-inbox@example.com";
  try {
    const messages = [];
    const service = loadTypeScript("services/contact/contactEmailService.ts", {
      "@/services/email/emailService": { isEmailReady: () => true, sendEmail: async (message) => messages.push(message) },
    });
    assert.equal(service.isContactEmailReady(), true);
    await service.sendContactEmail({ name: "Visitor", email: "visitor@example.com", phone: "9876543210", interest: "Postnatal recovery", message: "Test enquiry", guidanceProfile: "" });
    assert.equal(messages[0].to, "contact-inbox@example.com");
    assert.equal(messages[0].replyTo, "visitor@example.com");
    assert.equal(messages[0].senderName, "Ayursarga Website");
    assert.equal(messages[0].subject, "New Ayursarga Enquiry - Postnatal recovery");
    assert.ok(messages[0].html.includes("A new journey begins."));
    assert.ok(messages[0].text.includes("Test enquiry"));
  } finally { if (oldRecipient === undefined) delete process.env.CONTACT_TO_EMAIL; else process.env.CONTACT_TO_EMAIL = oldRecipient; }
});
