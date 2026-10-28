import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const valid = { name: "Visitor Sample", email: "visitor@gmail.com", phone: "9876543210", interest: "I need personal guidance", message: "Please help me compare care options.", website: "" };
const request = (body = valid, headers = { Origin: "https://contact.test" }) => new Request("https://contact.test/api/contact", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
function fixture(t, realLimit = false) {
  const emails = [], logs = [], errors = [];
  t.mock.method(console, "info", (line) => logs.push(JSON.parse(line)));
  const rate = loadTypeScript("services/api/rateLimit.ts");
  const route = loadTypeScript("app/api/contact/route.ts", {
    "@/services/contact/turnstile": { isTurnstileReady: () => true, verifyEnquiryTurnstile: async () => "valid" },
    "@/services/email/emailService": { isEmailReady: () => true, sendEmail: async (email) => emails.push(email) },
    "@/services/api/rateLimit": realLimit ? rate : { allowRequest: () => true, requestFingerprint: () => "private-hash" },
    "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status }), apiHealth: () => Response.json({}), logApiError: (...args) => errors.push(args) },
  });
  return { ...route, emails, logs, errors };
}

test("the reported scanner sample and repeated-digit phones are rejected server-side without SMTP", async (t) => {
  const f = fixture(t);
  const sample = { ...valid, name: "ZAP", email: "zaproxy@example.com", phone: "9999999999", interest: "Ayurvedic hospital partnership", message: "Zaproxy alias impedit expedita quisquam pariatur exercitationem." };
  assert.equal((await f.POST(request(sample))).status, 400);
  assert.equal((await f.POST(request({ ...sample, email: valid.email }))).status, 400);
  assert.equal(f.emails.length, 0);
  assert.deepEqual(f.logs.map((log) => log.reason), ["placeholder_email", "placeholder_phone"]);
});

test("reserved email domains, malformed controls/types, oversize fields and invalid sources cannot send", async (t) => {
  const f = fixture(t);
  for (const change of [{ email: "person@sub.example.org" }, { email: "person@EXAMPLE.NET" }, { email: "person@address.test" }, { email: "person@host.invalid" },
    { name: "x" }, { name: "12345" }, { name: "A\r\nB" }, { name: "x".repeat(101) }, { name: {} }, { email: "x".repeat(160) + "@gmail.com" },
    { phone: "0000000000" }, { phone: "12345" }, { phone: 9876543210 }, { source: "other" }, { source: "ayu", message: "" }, { message: "bad\u0000message" }, { message: "x".repeat(3001) }]) {
    assert.equal((await f.POST(request({ ...valid, ...change }))).status, 400, JSON.stringify(change));
  }
  assert.equal(f.emails.length, 0);
});

test("genuine Unicode names, plus-addressing, multiline enquiries and optional Contact messages remain usable", async (t) => {
  const f = fixture(t);
  for (const change of [{ name: "ദേവിക നായർ", email: "visitor+care@gmail.com", message: "Hello\nPlease call me about care options." }, { name: "O'Neil", email: "person@myexample.com", message: "" }]) {
    assert.equal((await f.POST(request({ ...valid, ...change }))).status, 200);
  }
  assert.equal(f.emails.length, 2);
});

test("cross-site, absent and opaque origins cannot trigger mail; normal site and localhost requests are allowed", async (t) => {
  const f = fixture(t);
  for (const headers of [{}, { Origin: "null" }, { Origin: "https://evil.test" }, { Origin: "https://contact.test", "Sec-Fetch-Site": "cross-site" }, { Origin: "https://contact.test/path" }]) {
    assert.equal((await f.POST(request(valid, headers))).status, 403);
  }
  assert.equal(f.emails.length, 0);
  assert.equal((await f.POST(request(valid, { Origin: "https://contact.test", "Sec-Fetch-Site": "same-origin" }))).status, 200);
  const { isContactRequestOriginAllowed } = loadTypeScript("services/contact/contactRequestSecurity.ts");
  assert.equal(isContactRequestOriginAllowed(new Request("http://localhost:3000/api/contact", { headers: { Origin: "http://localhost:3000" } })), true);
});

test("a configured canonical origin works behind internal hosting URLs without trusting arbitrary origins", (t) => {
  const previous = process.env.APP_SITE_URL;
  process.env.APP_SITE_URL = "https://www.ayursarga.com";
  t.after(() => { if (previous === undefined) delete process.env.APP_SITE_URL; else process.env.APP_SITE_URL = previous; });
  const { isContactRequestOriginAllowed } = loadTypeScript("services/contact/contactRequestSecurity.ts");
  assert.equal(isContactRequestOriginAllowed(new Request("http://internal:8080/api/contact", { headers: { Origin: "https://www.ayursarga.com" } })), true);
  assert.equal(isContactRequestOriginAllowed(new Request("http://internal:8080/api/contact", { headers: { Origin: "https://evil.test" } })), false);
});

test("new reference, reported source and server timestamp correlate email and logs without recording private form contents", async (t) => {
  const f = fixture(t);
  const response = await f.POST(request({ ...valid, source: "ayu", requestId: "attacker-controlled", receivedAt: "1900-01-01" }, { Origin: "https://contact.test", "X-Forwarded-For": "203.0.113.7", Authorization: "Bearer private-token", Cookie: "private-cookie" }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.match(result.requestId, /^ENQ-[a-f0-9-]{36}$/);
  assert.equal(f.logs.length, 1);
  assert.equal(f.logs[0].requestId, result.requestId);
  assert.equal(f.logs[0].source, "ayu");
  assert.equal(f.logs[0].outcome, "smtp_accepted");
  assert.equal(Number.isNaN(Date.parse(f.logs[0].receivedAt)), false);
  assert.match(f.emails[0].subject, new RegExp(result.requestId));
  assert.match(f.emails[0].text, new RegExp(result.requestId));
  assert.match(f.emails[0].text, /Ayu helper/);
  assert.match(f.emails[0].html, /not verified identity/);
  assert.doesNotMatch(JSON.stringify(f.logs), /Visitor Sample|visitor@gmail|9876543210|Please help|203\.0\.113|private-token|private-cookie/);
  assert.doesNotMatch(f.emails[0].text, /attacker-controlled|1900-01-01/);
});

test("changing User-Agent cannot evade the contact limit while other API fingerprint behavior is unchanged", async (t) => {
  const f = fixture(t, true);
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await f.POST(request(valid, { Origin: "https://contact.test", "X-Forwarded-For": "203.0.113.8", "User-Agent": `client-${attempt}` }));
    assert.equal(response.status, attempt < 5 ? 200 : 429);
  }
  assert.equal(f.emails.length, 5);
  const { requestFingerprint } = loadTypeScript("services/api/rateLimit.ts");
  const a = request(valid, { "X-Forwarded-For": "203.0.113.8", "User-Agent": "one" });
  const b = request(valid, { "X-Forwarded-For": "203.0.113.8", "User-Agent": "two" });
  assert.notEqual(requestFingerprint(a, "other-api"), requestFingerprint(b, "other-api"));
  assert.equal(requestFingerprint(a, "contact", { includeUserAgent: false }), requestFingerprint(b, "contact", { includeUserAgent: false }));
});

test("shared browser validation prevents junk requests and carries only a safe server reference on failure", async (t) => {
  const { sendContactEnquiry } = loadTypeScript("services/contact/contactClient.ts");
  let calls = 0;
  const reference = "ENQ-00000000-0000-4000-8000-000000000001";
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    calls++;
    assert.equal(JSON.parse(options.body).source, "ayu");
    return Response.json({ error: "Could not confirm sending.", requestId: reference }, { status: 502 });
  });
  await assert.rejects(sendContactEnquiry({ ...valid, email: "zaproxy@example.com" }), /real email/);
  assert.equal(calls, 0);
  await assert.rejects(sendContactEnquiry(valid, "ayu"), new RegExp(reference));
  assert.equal(calls, 1);
});
