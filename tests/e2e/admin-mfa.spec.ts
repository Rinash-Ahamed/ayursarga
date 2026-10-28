import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";

const bundle = bundleDialogHarness("tests/fixtures/adminMfaHarness.tsx", Object.fromEntries([
  "next/link", "next/image", "@/hooks/useAuth", "@/services/auth/adminMfaService",
].map((name) => [name, "tests/fixtures/adminMfaMocks.tsx"])));
async function mount(page: Page, enrolled = true) {
  await page.setContent('<html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  for (const file of ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css", "app/portal.css"]) await page.addStyleTag({ content: readFileSync(file, "utf8") });
  await page.addScriptTag({ content: bundle });
  await page.evaluate((value) => { (window as unknown as { adminMfaFixture: { enrolled: boolean } }).adminMfaFixture.enrolled = value; }, enrolled);
}
async function password(page: Page) {
  await page.getByLabel("Email address", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password1");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function results(page: Page) {
  return page.evaluate(() => (window as unknown as { adminMfaFixture: { authorized: boolean; calls: Record<string, number> } }).adminMfaFixture);
}
test("Admin challenge preserves failed-code retry, prevents duplicate submits and grants access only after verification", async ({ page }) => {
  await mount(page);
  await password(page);
  await expect(page.getByRole("heading", { name: "Verify Admin sign-in" })).toBeVisible();
  expect((await results(page)).authorized).toBe(false);
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page.getByLabel("Authenticator code", { exact: true }).fill("000000");
  await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
  await expect(page.locator(".portal-form-error")).toContainText("valid six-digit");
  expect((await results(page)).authorized).toBe(false);
  await page.getByLabel("Authenticator code", { exact: true }).fill("123456");
  await page.locator("form").evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit(); });
  await expect.poll(async () => (await results(page)).authorized).toBe(true);
  expect((await results(page)).calls.verify).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("first-time Admin setup uses a private native key, explicit email request and code-gated enrollment", async ({ page }) => {
  await mount(page, false); await password(page);
  await expect(page.getByRole("heading", { name: "Secure your Admin account" })).toBeVisible();
  await page.getByRole("button", { name: "Send email verification", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Check your inbox");
  expect((await results(page)).calls.email).toBe(1);
  await page.getByRole("button", { name: "Set up authenticator", exact: true }).click();
  await expect(page.locator(".portal-mfa-key code")).toHaveText("SYNTHETICKEYFORLOCALTESTONLY");
  expect((await results(page)).authorized).toBe(false);
  await page.getByLabel("Authenticator code", { exact: true }).fill("000000");
  await page.getByRole("button", { name: "Verify and enable MFA", exact: true }).click();
  await expect(page.locator(".portal-mfa-setup [role=alert]")).toContainText("valid six-digit");
  await expect(page.locator(".portal-mfa-key code")).toBeVisible();
  await page.getByLabel("Authenticator code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Verify and enable MFA", exact: true }).click();
  await expect.poll(async () => (await results(page)).authorized).toBe(true);
  expect((await results(page)).calls.enroll).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (page.viewportSize()!.width <= 600) await expect(page.getByLabel("Authenticator code", { exact: true })).toHaveCSS("font-size", "16px");
});
test("configuration failure never authorizes Admin and cancellation remains available", async ({ page }) => {
  await mount(page, false);
  await page.evaluate(() => { (window as unknown as { adminMfaFixture: { rejectSetup: boolean } }).adminMfaFixture.rejectSetup = true; });
  await password(page);
  await page.getByRole("button", { name: "Set up authenticator", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("enable Firebase Identity Platform");
  expect((await results(page)).authorized).toBe(false);
  await page.getByRole("button", { name: "Cancel sign-in", exact: true }).click();
  expect((await results(page)).calls.cancel).toBe(1);
});
