import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";

const bundle = bundleDialogHarness("tests/fixtures/comparisonHarness.tsx", {
  "next/link": "tests/fixtures/comparisonMocks.tsx",
  "@/services/hospitals/publicHospitalService": "tests/fixtures/comparisonMocks.tsx",
});
test.beforeEach(async ({ page }) => {
  await page.route("https://images.test/**", (route) => route.fulfill({ status: 404 }));
  await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: bundle });
});
async function choose(page: Page, label: string, name: string) {
  await page.getByRole("combobox", { name: label, exact: true }).fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).click();
}
test("compare only chosen packages with image frames and no extra requests on compare", async ({ page }) => {
  await choose(page, "First center", "Alpha");
  await choose(page, "Second center", "Beta");
  const duration = page.getByRole("combobox", { name: "Package to compare" });
  await expect(duration).toBeEnabled();
  await duration.selectOption("7");
  await page.getByRole("button", { name: "Compare package", exact: true }).click();
  await expect(page.locator(".public-comparison-package")).toHaveCount(2);
  await expect(page.locator(".public-comparison-image")).toHaveCount(2);
  await expect(page.locator(".public-comparison-duration>h3")).toHaveText("7-day package");
  expect(await page.evaluate(() => window.comparisonCalls)).toEqual(["alpha", "beta"]);
  await duration.selectOption("14");
  await expect(page.locator(".public-comparison-results")).toHaveCount(0);
  await page.getByRole("button", { name: "Compare package", exact: true }).click();
  await expect(page.locator(".public-comparison-duration>h3")).toHaveText("14-day package");
  expect(await page.evaluate(() => window.comparisonCalls.length)).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("changing a center cancels obsolete packages and handles no matching durations", async ({ page }) => {
  await choose(page, "First center", "Alpha");
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await choose(page, "First center", "Gamma");
  await choose(page, "Second center", "Beta");
  await expect(page.getByText("No matching package duration is currently available.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Compare package", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "First center", exact: true })).toBeVisible();
  await expect(page.locator(".public-comparison-results")).toHaveCount(0);
});

test("touch selection survives a Safari-style blur with no related target", async ({ page }) => {
  const input = page.getByRole("combobox", { name: "First center", exact: true });
  await input.fill("Alpha");
  const option = page.getByRole("option", { name: /Alpha/ });
  await expect(option).toBeVisible();
  // Safari may not focus the tapped button before blurring a search input.
  await input.evaluate((element) => element.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null })));
  await expect(option).toBeVisible();
  if (test.info().project.use.hasTouch) await option.tap();
  else await option.click();
  await expect(page.locator(".public-comparison-picker.is-selected").first()).toContainText("Alpha");
});

test("comparison waits for a completed search before displaying an empty result", async ({ page }) => {
  await page.evaluate(() => { window.comparisonSearchDelay = 600; });
  await page.getByRole("combobox", { name: "First center", exact: true }).fill("Unknown");
  await expect(page.getByRole("status")).toHaveText("Searching centers...");
  await expect(page.getByText("No matching active center found.")).toHaveCount(0);
  await expect(page.getByText("No matching active center found.")).toBeVisible();
});

test("outside taps close results and refocusing restores matching options", async ({ page }) => {
  const input = page.getByRole("combobox", { name: "First center", exact: true });
  await input.fill("Alpha");
  await expect(page.getByRole("option", { name: /Alpha/ })).toBeVisible();
  await page.getByRole("heading", { name: "Compare two Ayurvedic centers" }).click();
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await input.focus();
  await expect(page.getByRole("option", { name: /Alpha/ })).toBeVisible();
});

test("search failures are not misreported as no matching centers", async ({ page }) => {
  await page.evaluate(() => { window.comparisonSearchFails = true; });
  await page.getByRole("combobox", { name: "First center", exact: true }).fill("Alpha");
  await expect(page.getByRole("alert")).toHaveText("We could not search centers right now.");
  await expect(page.getByText("No matching active center found.")).toHaveCount(0);
});
