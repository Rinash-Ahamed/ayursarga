import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";

const bundle = bundleDialogHarness("tests/fixtures/adminMfaHarness.tsx", Object.fromEntries([
  "next/link", "next/image", "@/hooks/useAuth", "@/services/auth/adminMfaService",
].map((name) => [name, "tests/fixtures/adminMfaMocks.tsx"])));
const securityBundle = bundleDialogHarness("tests/fixtures/adminSecurityHarness.tsx", {
  "@/components/portal/PortalShell": "tests/fixtures/adminSecurityMocks.tsx",
  "@/services/auth/adminMfaReplacementService": "tests/fixtures/adminSecurityMocks.tsx",
});
async function mount(page: Page, enrolled = true, recoveryEnabled = false, security = false) {
  await page.setContent('<html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  for (const file of ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css", "app/portal.css"]) await page.addStyleTag({ content: readFileSync(file, "utf8") });
  await page.evaluate(value => { Object.assign(window, { recoveryEnabled: value }); }, recoveryEnabled);
  await page.addScriptTag({ content: security ? securityBundle : bundle });
  if (!security) await page.evaluate((value) => { (window as unknown as { adminMfaFixture: { enrolled: boolean } }).adminMfaFixture.enrolled = value; }, enrolled);
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
  expect(await page.evaluate(() => (window as unknown as { fixtureLazyLoads?: number }).fixtureLazyLoads ?? 0)).toBe(0);
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
test("first-time Admin setup uses a local QR, manual fallback and code-gated enrollment", async ({ page }) => {
  await mount(page, false); await password(page);
  await expect(page.getByRole("heading", { name: "Secure your Admin account" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { fixtureLazyLoads?: number }).fixtureLazyLoads ?? 0)).toBe(1);
  await expect(page.locator(".portal-mfa-setup")).not.toContainText("Firebase");
  await expect(page.locator(".portal-mfa-setup")).not.toContainText("Hospital and Consumer");
  await expect(page.locator(".portal-mfa-setup")).toContainText("Connect your authenticator app once");
  const setupButton = await page.getByRole("button", { name: "Set up authenticator", exact: true }).boundingBox();
  const emailButton = await page.getByRole("button", { name: "Send email verification", exact: true }).boundingBox();
  expect(emailButton!.y).toBeGreaterThanOrEqual(setupButton!.y + setupButton!.height + 8);
  await page.getByRole("button", { name: "Send email verification", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Check your inbox");
  expect((await results(page)).calls.email).toBe(1);
  await page.getByRole("button", { name: "Set up authenticator", exact: true }).click();
  const qr = page.getByRole("img", { name: "Authenticator setup QR code" });
  await expect(qr).toBeVisible();
  const bounds = await qr.boundingBox();
  expect(Math.abs(bounds!.width - bounds!.height)).toBeLessThan(1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(page.locator(".portal-mfa-key code")).not.toBeVisible();
  await page.locator(".portal-mfa-manual summary").click();
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
test("QR rendering failure opens manual setup without granting access or requesting a remote QR", async ({ page }) => {
  await mount(page, false);
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  await page.evaluate(() => { (window as unknown as { adminMfaFixture: { invalidQr: boolean } }).adminMfaFixture.invalidQr = true; });
  await password(page);
  await page.getByRole("button", { name: "Set up authenticator", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("QR code could not be displayed");
  await expect(page.locator(".portal-mfa-key code")).toBeVisible();
  expect((await results(page)).authorized).toBe(false);
  expect(requests).toEqual([]);
  await page.getByLabel("Authenticator code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Verify and enable MFA", exact: true }).click();
  await expect.poll(async () => (await results(page)).authorized).toBe(true);
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

test("recovery flag only exposes instructions and a mailto request, never an MFA bypass", async ({ page }) => {
  await mount(page);
  await expect(page.getByText("Lost access to your authenticator?")).toHaveCount(0);
  await mount(page, true, true);
  await page.getByText("Lost access to your authenticator?").click();
  await expect(page.getByRole("link", { name: "Request recovery help by email" })).toHaveAttribute("href", /^mailto:info@ayursarga.com/);
  await expect(page.getByText("This opens your email app.", { exact: false })).toBeVisible();
  expect((await results(page)).calls).toEqual({ login: 0, verify: 0, prepare: 0, enroll: 0, email: 0, cancel: 0 });
});

test("signed-in replacement is flag-gated, confirmation-protected and prevents duplicate actions", async ({ page }) => {
  await mount(page, true, false, true);
  await expect(page.getByRole("button", { name: "Replace authenticator", exact: true })).toHaveCount(0);
  await mount(page, true, true, true);
  await page.getByLabel("Current password", { exact: true }).fill("synthetic-password1");
  await page.getByLabel("Current authenticator code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Replace authenticator", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { adminSecurityFixture: { calls: number } }).adminSecurityFixture.calls)).toBe(0);
  await page.getByRole("button", { name: "Replace authenticator", exact: true }).click();
  await page.getByRole("button", { name: "Replace and sign out", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alert")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { adminSecurityFixture: { calls: number } }).adminSecurityFixture.calls)).toBe(1);
  await expect(page.getByLabel("Current password", { exact: true })).toHaveValue("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
