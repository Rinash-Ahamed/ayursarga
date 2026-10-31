import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

function fixture(options = {}) {
  const calls = { storage: 0, client: 0 };
  const { platformHealthReport } = loadTypeScript("services/api/platformHealth.ts", {
    "@/config/firebaseConfig": { getFirebaseClientConfig: () => { calls.client++; if (options.clientMissing) throw new Error("secret-config-must-not-appear"); return {}; } },
    "@/services/firebase/admin": { isFirebaseAdminReady: () => !options.firebaseMissing, isFirebaseAdminStorageReady: () => { calls.storage++; return !options.storageMissing; } },
    "@/services/contact/contactEmailService": { isContactEmailReady: () => !options.emailMissing },
    "@/services/auth/authEmailService": { isAuthEmailReady: () => !options.authEmailMissing },
    "@/services/payments/razorpay": { getRazorpayReadiness: () => ({ apiConfigured: !options.paymentsMissing, webhookConfigured: !options.webhookMissing }) },
  });
  return { calls, platformHealthReport };
}

test("essential health covers Firebase, contact and auth emails without deep probes", () => {
  const f = fixture();
  const report = f.platformHealthReport();
  assert.equal(report.mode, "configuration");
  assert.equal(report.status, "ok");
  assert.deepEqual(report.dependencies.map((item) => item.name), ["firebase-admin", "contact-email", "auth-email"]);
  assert.deepEqual(f.calls, { storage: 0, client: 0 });
});

test("deep health adds bounded configuration checks and reports missing settings without details", () => {
  for (const options of [{}, { clientMissing: true }, { storageMissing: true }, { emailMissing: true }, { authEmailMissing: true }, { firebaseMissing: true }, { paymentsMissing: true }, { webhookMissing: true }]) {
    const f = fixture(options);
    const report = f.platformHealthReport(true);
    assert.equal(report.mode, "deep-configuration");
    assert.equal(report.dependencies.length, 6);
    assert.equal(report.status, Object.keys(options).length ? "degraded" : "ok");
    assert.deepEqual(f.calls, { storage: 1, client: 1 });
    assert.ok(!JSON.stringify(report).includes("secret-config"));
  }
});

test("JSON health status matches shared checks, disables caching and preserves deep HTML redirects", async () => {
  for (const options of [{}, { authEmailMissing: true }]) {
    const f = fixture(options);
    const route = loadTypeScript("app/api/health/route.ts", { "@/services/api/platformHealth": f });
    const response = route.GET(new Request("https://test.local/api/health?deep=true", { headers: { accept: "application/json" } }));
    assert.equal(response.status, options.authEmailMissing ? 503 : 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.mode, "deep-configuration");
    const redirect = route.GET(new Request("https://test.local/api/health?deep=true", { headers: { accept: "text/html" } }));
    assert.equal(redirect.status, 307);
    assert.equal(redirect.headers.get("location"), "https://test.local/health?deep=true");
  }
});

test("themed page uses the same deep checks and explicitly describes its configuration-only scope", async () => {
  const f = fixture();
  const { default: HealthPage } = loadTypeScript("app/health/page.tsx", {
    "@/services/api/platformHealth": f,
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "next/image": (props) => React.createElement("img", { ...props, priority: undefined }),
  });
  const html = renderToStaticMarkup(await HealthPage({ searchParams: Promise.resolve({ deep: "true" }) }));
  for (const text of ["Expanded checks", "Invitations &amp; password resets", "Hospital image uploads", "Browser sign-in", "Configuration checks passed", "does not send emails", "Configured"]) assert.ok(html.includes(text), text);
  assert.equal(f.calls.storage, 1);
});

test("auth email readiness checks sender and canonical URL without creating links or sending mail", () => {
  const oldSite = process.env.APP_SITE_URL;
  try {
    let ready = true;
    const { isAuthEmailReady } = loadTypeScript("services/auth/authEmailService.ts", {
      "@/services/email/emailService": { isEmailReady: () => ready, sendEmail: () => { throw new Error("Health must not send emails"); } },
    });
    process.env.APP_SITE_URL = "https://www.ayursarga.com";
    assert.equal(isAuthEmailReady(), true);
    ready = false;
    assert.equal(isAuthEmailReady(), false);
    ready = true;
    process.env.APP_SITE_URL = "javascript:alert(1)";
    assert.equal(isAuthEmailReady(), false);
  } finally { if (oldSite === undefined) delete process.env.APP_SITE_URL; else process.env.APP_SITE_URL = oldSite; }
});
