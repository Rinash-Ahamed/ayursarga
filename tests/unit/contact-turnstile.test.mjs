import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const fields = { name: "Visitor Sample", email: "visitor@gmail.com", phone: "9876543210", interest: "I need personal guidance", message: "Please help me compare care.", turnstileToken: "test-token" };
const request = (changes = {}) => new Request("https://contact.test/api/contact", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://contact.test" }, body: JSON.stringify({ ...fields, ...changes }) });
function fixture(t) {
  for (const [key, value] of Object.entries({ TURNSTILE_SECRET_KEY: "synthetic-secret", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "synthetic-public" })) {
    const previous = process.env[key]; process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  let result = { success: true, hostname: "contact.test", action: "contact_enquiry" };
  const emails = [], provider = [], logs = [];
  t.mock.method(console, "info", (line) => logs.push(line));
  t.mock.method(globalThis, "fetch", async (url, options) => {
    provider.push({ url, options });
    if (result instanceof Error) throw result;
    return result instanceof Response ? result : Response.json(result);
  });
  const route = loadTypeScript("app/api/contact/route.ts", {
    "@/services/email/emailService": { isEmailReady: () => true, sendEmail: async (email) => emails.push(email) },
    "@/services/api/rateLimit": { allowRequest: () => true, requestFingerprint: () => "synthetic" },
    "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status }), apiHealth: (_path, checks) => Response.json(checks), logApiError: () => {} },
  });
  return { ...route, emails, provider, logs, result: (value) => { result = value; } };
}

test("Contact and Ayu require provider-verified tokens bound to the hostname and action before SMTP", async (t) => {
  const f = fixture(t);
  assert.equal((await f.POST(request())).status, 200);
  const call = f.provider[0];
  assert.equal(call.url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
  assert.equal(call.options.cache, "no-store");
  assert.ok(call.options.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(call.options.body), { secret: "synthetic-secret", response: "test-token" });
  f.result({ success: true, hostname: "contact.test", action: "ayu_enquiry" });
  assert.equal((await f.POST(request({ source: "ayu" }))).status, 200);
  assert.equal(f.emails.length, 2);
  assert.doesNotMatch(JSON.stringify(f.logs) + JSON.stringify(f.emails), /synthetic-secret|test-token/);
});

test("missing, malformed and oversized tokens never call the provider or send mail", async (t) => {
  const f = fixture(t);
  for (const turnstileToken of [undefined, null, "", " ", 123, {}, "x".repeat(2049)]) {
    assert.equal((await f.POST(request({ turnstileToken }))).status, 400);
  }
  assert.equal(f.provider.length, 0); assert.equal(f.emails.length, 0);
});

test("expired/reused tokens, wrong hostname/action and non-boolean success fail closed", async (t) => {
  const f = fixture(t);
  for (const result of [
    { success: false, "error-codes": ["timeout-or-duplicate"] },
    { success: true, hostname: "other.test", action: "contact_enquiry" },
    { success: true, hostname: "contact.test", action: "ayu_enquiry" },
    { success: "true", hostname: "contact.test", action: "contact_enquiry" }, {},
  ]) {
    f.result(result); assert.equal((await f.POST(request())).status, 400);
  }
  assert.equal(f.emails.length, 0);
});

test("provider HTTP, JSON, network and timeout failures never send email or retry", async (t) => {
  const f = fixture(t);
  for (const result of [new Response("unavailable", { status: 503 }), new Response("not JSON"), null, new Error("network"), new DOMException("timeout", "TimeoutError")]) {
    f.result(result);
    assert.equal((await f.POST(request())).status, 503);
  }
  assert.equal(f.provider.length, 5); assert.equal(f.emails.length, 0);
});

test("missing either key blocks submissions and reports configuration as unavailable", async (t) => {
  const f = fixture(t);
  delete process.env.TURNSTILE_SECRET_KEY;
  assert.equal((await f.POST(request())).status, 503);
  assert.deepEqual((await f.GET().json()).find((check) => check.name === "turnstile"), { name: "turnstile", ready: false });
  process.env.TURNSTILE_SECRET_KEY = "synthetic-secret";
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  assert.equal((await f.POST(request())).status, 503);
  assert.equal(f.provider.length, 0); assert.equal(f.emails.length, 0);
});

test("a provider rejects reuse and only a freshly solved token can send another enquiry", async (t) => {
  const f = fixture(t);
  assert.equal((await f.POST(request())).status, 200);
  f.result({ success: false, "error-codes": ["timeout-or-duplicate"] });
  assert.equal((await f.POST(request())).status, 400);
  assert.equal(f.emails.length, 1);
  f.result({ success: true, hostname: "contact.test", action: "contact_enquiry" });
  assert.equal((await f.POST(request({ turnstileToken: "fresh-token" }))).status, 200);
  assert.equal(f.emails.length, 2);
});
