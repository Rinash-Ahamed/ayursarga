import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

test("Settings retains Admin role protection and the server-controlled MFA flag", () => {
  const RequireRole = () => null, AdminSecurity = () => null;
  let enabled = false;
  const { default: Page } = loadTypeScript("app/admin/settings/page.tsx", {
    "@/components/auth/RequireRole": { RequireRole },
    "@/components/admin/AdminSecurity": { AdminSecurity },
    "@/config/adminMfaRecovery": { isAdminMfaRecoveryEnabled: () => enabled },
  });
  for (const value of [false, true]) {
    enabled = value; const page = Page();
    assert.equal(page.type, RequireRole); assert.equal(page.props.role, "admin");
    assert.equal(page.props.children.type, AdminSecurity); assert.equal(page.props.children.props.enabled, value);
  }
});

test("old security bookmarks redirect to Settings", () => {
  let target;
  const { default: Page } = loadTypeScript("app/admin/security/page.tsx", { "next/navigation": { redirect: path => { target = path; } } });
  Page(); assert.equal(target, "/admin/settings");
});

test("navigation source places Settings directly after Audit Logs and removes the account-menu security shortcut", () => {
  const source = readFileSync("components/portal/PortalShell.tsx", "utf8");
  assert.match(source, /\["Audit Logs", ROUTES.admin.audits, "audit"\],\s*\["Settings", ROUTES.admin.settings, "settings"\]/);
  assert.doesNotMatch(source, /href=\{ROUTES.admin.security\}/);
});
