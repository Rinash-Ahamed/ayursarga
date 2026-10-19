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
