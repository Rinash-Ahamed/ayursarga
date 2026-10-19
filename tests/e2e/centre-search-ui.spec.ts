import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";
const bundle = bundleDialogHarness("tests/fixtures/centreSearchHarness.tsx", {
  "next/link": "tests/fixtures/centreSearchMocks.tsx",
  "@/services/hospitals/publicHospitalService": "tests/fixtures/centreSearchMocks.tsx",
  "firebase/firestore": "tests/fixtures/centreSearchMocks.tsx",
});
test("search page reflows and retains live filtering, galleries and comparison", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://images.test/**", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#c9d8cd"/></svg>' }));
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  for (const file of ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css"]) await page.addStyleTag({ content: readFileSync(file, "utf8") });
  await page.addStyleTag({ content: ':root{--font-body:Arial,sans-serif;--font-display:Arial,sans-serif}' });
  await page.addScriptTag({ content: bundle });
  await expect(page.locator(".public-center-card")).toHaveCount(2);
  await expect(page.locator(".public-center-card-image img")).toHaveClass("is-loaded");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const edges = await page.locator('.public-search-heading,.public-search-filters,.public-comparison-workspace,.public-center-grid').evaluateAll((elements) => elements.map((element) => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right }; }));
  for (const edge of edges) {
    expect(Math.abs(edge.left - edges[0].left)).toBeLessThanOrEqual(1);
    expect(Math.abs(edge.right - edges[0].right)).toBeLessThanOrEqual(1);
  }
  if (info.project.use.hasTouch) {
    const fonts = await page.locator('input,select').evaluateAll((elements) => elements.map((el) => parseFloat(getComputedStyle(el).fontSize)));
    expect(fonts.every((size) => size >= 16)).toBe(true);
  }
  await page.screenshot({ path: info.outputPath("search.png"), fullPage: true });
  const search = page.getByRole("searchbox", { name: "Centre or location" });
  await search.fill("Palakkad");
  await expect(page.locator(".public-center-card")).toHaveCount(1);
  await search.fill("");
  await page.getByRole("button", { name: "Show next hospital image" }).click();
  await expect(page.locator(".public-center-image-nav>span")).toHaveText("2 / 10");
  await expect(page.getByRole("link", { name: "View details for Sanjeevani" })).toHaveAttribute("href", /\/centers\/beta/);
  await page.getByRole("combobox", { name: "First center", exact: true }).fill("Alpha");
  await page.getByRole("option", { name: /Alpha/ }).click();
  await page.getByRole("combobox", { name: "Second center", exact: true }).fill("Beta");
  await page.getByRole("option", { name: /Beta/ }).click();
  const duration = page.getByRole("combobox", { name: "Package to compare" });
  await expect(duration).toBeEnabled();
  await duration.selectOption("7");
  await page.getByRole("button", { name: "Compare package", exact: true }).click();
  await expect(page.locator(".public-comparison-package")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
