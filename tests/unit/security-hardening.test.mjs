import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

test("application source contains no private-key material, service accounts or public secret environment names", () => {
  const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? walk(`${path}/${entry.name}`) : [`${path}/${entry.name}`]);
  const paths = ["app", "components", "config", "contexts", "features", "hooks", "lib", "services", "utils", "scripts"]
    .flatMap(walk).concat([".env.example", "next.config.mjs"]);
  const patterns = [
    /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]{0,8}MII/,
    /NEXT_PUBLIC_[A-Z_]*(?:SECRET|PASSWORD|PRIVATE_KEY)\s*[:=]/,
    /"private_key_id"\s*:/,
  ];
  for (const path of paths) {
    if (!/\.(?:ts|tsx|mjs|js|json|md|txt|example|yml|yaml)$/.test(path)) continue;
    const source = readFileSync(path, "utf8");
    for (const pattern of patterns) assert.ok(!pattern.test(source), `Review possible credential exposure in ${path}`);
  }
});

test("changing User-Agent does not reset shared IP rate limits", () => {
  const { requestFingerprint, allowRequest } = loadTypeScript("services/api/rateLimit.ts");
  for (let attempt = 0; attempt < 8; attempt++) {
    const request = new Request("https://test.local/api/auth/password-reset", { headers: {
      "x-forwarded-for": "203.0.113.8", "user-agent": `changing-agent-${attempt}`,
    } });
    assert.equal(allowRequest(requestFingerprint(request, "password-reset"), 5, 60000), attempt < 5);
  }
});

test("shared API logs retain diagnostic codes but exclude raw error messages and private context", t => {
  const logs = [];
  t.mock.method(console, "error", line => logs.push(JSON.parse(line)));
  const { logApiError } = loadTypeScript("services/api/server.ts");
  logApiError("POST /api/contact", Object.assign(new Error("secret-smtp-password private@example.test"), { code: "auth/invalid-credential" }), {
    requestId: "ENQ-00000000-0000-4000-8000-000000000001", email: "private@example.test", token: "secret-token",
  });
  assert.equal(logs[0].errorCode, "auth/invalid-credential");
  assert.equal(logs[0].context.requestId, "ENQ-00000000-0000-4000-8000-000000000001");
  assert.doesNotMatch(JSON.stringify(logs), /secret-|private@example|email|message/);
  logApiError("GET /api/public/hospitals", { name: "invalid\nprivate@example.test", code: "secret=value" });
  assert.equal(logs[1].errorName, "Error"); assert.equal(logs[1].errorCode, undefined);
});

test("API routes never log raw caught errors or use unbounded body decoders", () => {
  const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? walk(`${path}/${entry.name}`) : entry.name === "route.ts" ? [`${path}/${entry.name}`] : []);
  for (const path of walk("app/api")) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /request\.(json|text|arrayBuffer|formData)\(/, path);
    assert.doesNotMatch(source, /console\.error\([^;]*(?:error\.message|authError\.message)/, path);
  }
});

test("baseline CSP blocks objects, foreign base URLs and framing without changing checkout script loading", async () => {
  const { default: config } = await import("../../next.config.mjs");
  const headers = (await config.headers())[0].headers;
  const policy = headers.find(header => header.key === "Content-Security-Policy")?.value;
  assert.equal(policy, "object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  assert.equal(headers.find(header => header.key === "X-Frame-Options")?.value, "DENY");
});
