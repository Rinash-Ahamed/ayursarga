import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";

const bundle = bundleDialogHarness("tests/fixtures/toastHarness.tsx");
const styles = ["app/globals.css", "app/portal.css"].map((file) => readFileSync(file, "utf8")).join("\n");

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  await page.addStyleTag({ content: styles });
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => window.mountToastFixture());
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
});

test("one action displays once, expires, and cannot replay during background renders, tab focus or page revisit", async ({ page }) => {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(1);
  await page.clock.runFor(4000);
  await page.getByRole("button", { name: "Background update" }).click();
  await page.clock.runFor(2500);
  await expect(page.locator(".portal-toast")).toHaveCount(0);
  await page.clock.runFor(60000);
  await page.getByRole("button", { name: "Background update" }).click();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByRole("button", { name: "Toggle page" }).click();
  await page.getByRole("button", { name: "Toggle page" }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(0);
});

test("identical legitimate repeated actions and failures receive a fresh lifetime", async ({ page }) => {
  for (const name of ["Save", "Save", "Fail action", "Fail action", "Warn", "Inform"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".portal-toast")).toHaveCount(1);
    await page.clock.runFor(8500);
    await expect(page.locator(".portal-toast")).toHaveCount(0);
  }
});

test("clearing or leaving a page dismisses its toast without a stale replay", async ({ page }) => {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear message" }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(1);
  await page.getByRole("button", { name: "Toggle page" }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle page" }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(0);
});

test("stored authentication errors do not replay on remount; a new failed attempt still notifies", async ({ page }) => {
  await page.getByRole("button", { name: "Auth failure" }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(1);
  await page.clock.runFor(8500);
  await page.getByRole("button", { name: "Toggle page" }).click();
  await page.getByRole("button", { name: "Toggle page" }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(0);
  await page.getByRole("button", { name: "Auth failure" }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(1);
});

test("returning from a suspended tab expires old toasts even when their timers did not run", async ({ page }) => {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(1);
  const later = await page.evaluate(() => Date.now() + 60000);
  await page.clock.setSystemTime(later);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator(".portal-toast")).toHaveCount(0);
  await page.getByRole("button", { name: "Background update" }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(1);
});

test("an expired authentication error first observed on a different page is not a new event", async ({ page }) => {
  await page.getByRole("button", { name: "Toggle page" }).click();
  await page.getByRole("button", { name: "Auth failure" }).click();
  await page.clock.runFor(15000);
  await page.getByRole("button", { name: "Toggle page" }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(0);
  await page.getByRole("button", { name: "Auth failure" }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(1);
});

test("superseded API failures are ignored, current failures display once, and retries remain legitimate", async ({ page }) => {
  await page.getByRole("button", { name: "Open data" }).click();
  await page.clock.runFor(20);
  await expect(page.getByTestId("requests")).toHaveText("1");
  await page.getByRole("button", { name: "Change query" }).click();
  await page.clock.runFor(20);
  await expect(page.getByTestId("requests")).toHaveText("2");
  await page.getByRole("button", { name: "Reject oldest" }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(0);
  await page.getByRole("button", { name: "Reject latest" }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(1);
  await page.clock.runFor(8500);
  await expect(page.locator(".portal-toast")).toHaveCount(0);
  await page.getByRole("button", { name: "Retry request" }).click();
  await expect(page.getByTestId("requests")).toHaveText("3");
  await page.getByRole("button", { name: "Reject latest" }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(1);
  await page.getByRole("button", { name: "Retry request" }).click();
  await expect(page.getByTestId("requests")).toHaveText("4");
  await page.getByRole("button", { name: "Resolve latest" }).click();
  await expect(page.locator(".portal-toast")).toHaveCount(0);
});

test("an async action completing after its page unmounts cannot surface a delayed toast", async ({ page }) => {
  await page.getByRole("button", { name: "Start delayed action" }).click();
  await page.getByRole("button", { name: "Leave delayed page" }).click();
  await page.clock.runFor(15000);
  await expect(page.locator(".portal-toast")).toHaveCount(0);
});
