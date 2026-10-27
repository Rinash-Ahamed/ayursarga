import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { statSync } from "node:fs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const input = { name: "Test Visitor", email: "visitor@example.com", phone: "9876543210", interest: "I need personal guidance", message: "How do I compare hospitals?", guidanceProfile: "Enquiry sent through Ayu, the Ayursarga website guide.", website: "" };
const request = (body = input, contentType = "application/json") => new Request("https://test.local/api/contact", { method: "POST", headers: { "Content-Type": contentType }, body: typeof body === "string" ? body : JSON.stringify(body) });
function fixture(options = {}) {
  const emails = [];
  const route = loadTypeScript("app/api/contact/route.ts", {
    "@/services/email/emailService": { isEmailReady: () => !options.unavailable, sendEmail: async (email) => { if (options.fail) throw new Error("Simulated SMTP failure"); emails.push(email); } },
    "@/services/api/rateLimit": { allowRequest: () => !options.limited, requestFingerprint: () => "synthetic" },
    "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status }), apiHealth: () => Response.json({}), logApiError: () => {} },
  });
  return { ...route, emails };
}

test("Ayu uses the existing validated contact route, server-owned recipient and branded escaped email", async () => {
  const f = fixture();
  const response = await f.POST(request({ ...input, message: "Question <script>unsafe</script>", to: "attacker@example.com", recipient: "attacker@example.com" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(f.emails.length, 1);
  assert.equal(f.emails[0].to, process.env.CONTACT_TO_EMAIL?.trim() || "info@ayursarga.com");
  assert.equal(f.emails[0].replyTo, input.email);
  assert.match(f.emails[0].html, /Ayu/);
  assert.match(f.emails[0].html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.doesNotMatch(f.emails[0].html, /<script>|submitted a consultation request/);
  assert.match(f.emails[0].text, /Test Visitor/);
});

test("invalid contact fields, oversized/malformed bodies and unsupported content types never send email", async () => {
  const f = fixture();
  for (const change of [{ email: "bad" }, { phone: "123" }, { name: "" }, { interest: "Unknown" }]) {
    assert.equal((await f.POST(request({ ...input, ...change }))).status, 400);
  }
  assert.equal((await f.POST(request("{"))).status, 400);
  assert.equal((await f.POST(request(input, "text/plain"))).status, 415);
  assert.equal((await f.POST(request({ ...input, message: "x".repeat(17_000) }))).status, 413);
  assert.equal(f.emails.length, 0);
});

test("honeypots, throttling and mail failures preserve existing public-contact safeguards", async () => {
  const bot = fixture();
  assert.equal((await bot.POST(request({ ...input, website: "spam" }))).status, 200);
  assert.equal(bot.emails.length, 0);
  for (const [options, status] of [[{ limited: true }, 429], [{ unavailable: true }, 503], [{ fail: true }, 502]]) {
    const f = fixture(options);
    assert.equal((await f.POST(request())).status, status);
    assert.equal(f.emails.length, 0);
  }
});

test("shared enquiry transport requires an explicit acknowledgement and does not retry", async (t) => {
  const { sendContactEnquiry } = loadTypeScript("services/contact/contactClient.ts");
  let calls = 0;
  let response = Response.json({ ok: true });
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls++;
    assert.equal(url, "/api/contact");
    assert.equal(options.method, "POST");
    assert.equal(JSON.parse(options.body).message, input.message);
    return response;
  });
  await sendContactEnquiry(input);
  response = Response.json({ ok: false });
  await assert.rejects(sendContactEnquiry(input), /could not confirm/);
  response = Response.json({ error: "Please wait before sending again." }, { status: 429 });
  await assert.rejects(sendContactEnquiry(input), /Please wait/);
  assert.equal(calls, 3);
});

test("uncertain network/timeout delivery is not reported as success or automatically retried", async (t) => {
  const { sendContactEnquiry } = loadTypeScript("services/contact/contactClient.ts");
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new DOMException("Timeout", "AbortError"); });
  await assert.rejects(sendContactEnquiry(input), /delivery could not be confirmed/);
  assert.equal(calls, 1);
});

test("Ayu serves a small transparent responsive asset and a bounded curated guide", async () => {
  const metadata = await sharp("public/ayu-buddy.webp").metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.hasAlpha, true);
  assert.ok(metadata.width <= 256);
  assert.ok(statSync("public/ayu-buddy.webp").size < 30_000);
  const { AYU_GUIDE_TOPICS } = loadTypeScript("features/consumers/ayuGuide.ts");
  assert.equal(AYU_GUIDE_TOPICS.length, 6);
  for (const topic of AYU_GUIDE_TOPICS) assert.ok(topic.href.startsWith("/") && !topic.href.startsWith("//"));
});
