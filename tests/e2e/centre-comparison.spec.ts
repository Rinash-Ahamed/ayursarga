import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";

const bundle = bundleDialogHarness("tests/fixtures/comparisonHarness.tsx", {
  "next/link": "tests/fixtures/comparisonMocks.tsx",
  "@/services/hospitals/publicHospitalService": "tests/fixtures/comparisonMocks.tsx",
});
test.beforeEach(async ({ page }) => {
  await page.route("https://images.test/**", (route) => route.fulfill({ status: 404 }));
  await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main class="centers-directory-page"><div id="fixture-root"></div></main></body></html>');
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
  const cards = page.locator(".public-comparison-package");
  await expect(cards.first().getByRole("region", { name: "Alpha facilities" })).toContainText("Free Wi-Fi");
  await expect(cards.first().getByRole("region", { name: "Alpha facilities" })).not.toContainText("Baby cradle");
  await expect(cards.last().getByRole("region", { name: "Beta facilities" })).toContainText("Baby cradle");
  await expect(cards.last().getByRole("region", { name: "Beta facilities" })).not.toContainText("Free Wi-Fi");
  await cards.first().locator(".public-comparison-facilities summary").click();
  await expect(cards.first().locator(".public-comparison-facilities")).toContainText("Garden");
  for (const [index, id] of ["alpha", "beta"].entries()) {
    const link = cards.nth(index).getByRole("link", { name: "View Centre Details", exact: true });
    await expect(link).toHaveAttribute("href", `/centers/${id}`);
    await expect(link).toHaveCSS("background-color", "rgb(31, 61, 43)");
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const layout = await cards.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    const button = element.querySelector(".public-comparison-details-button")!.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, buttonBottom: button.bottom };
  }));
  expect(layout[1].left).toBeGreaterThanOrEqual(layout[0].right - 1);
  expect(Math.abs(layout[0].top - layout[1].top)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout[0].buttonBottom - layout[1].buttonBottom)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => window.comparisonCalls)).toEqual(["alpha", "beta"]);
  await duration.selectOption("14");
  await expect(page.locator(".public-comparison-results")).toHaveCount(0);
  await page.getByRole("button", { name: "Compare package", exact: true }).click();
  await expect(page.locator(".public-comparison-duration>h3")).toHaveText("14-day package");
  expect(await page.evaluate(() => window.comparisonCalls.length)).toBe(2);
  expect(await page.evaluate(() => window.comparisonDetailCalls)).toEqual(["alpha", "beta"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("comparison-facilities.png"), fullPage: true });
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

test("a touch release selects once even if blur targets the page and no click arrives", async ({ page }) => {
  const input = page.getByRole("combobox", { name: "First center", exact: true });
  await input.fill("Alpha");
  const option = page.getByRole("option", { name: /Alpha/ });
  await expect(option).toBeVisible();
  await option.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0, clientX: 30, clientY: 30 });
  await input.evaluate((element) => element.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: document.body })));
  await expect(option).toBeVisible();
  await option.dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0, clientX: 30, clientY: 30 });
  await expect(page.locator(".public-comparison-picker.is-selected").first()).toContainText("Alpha");
  expect(await page.evaluate(() => window.comparisonCalls)).toEqual(["alpha"]);
});

test("dragged and cancelled gestures do not select; keyboard selection still works", async ({ page }) => {
  const input = page.getByRole("combobox", { name: "First center", exact: true });
  await input.fill("Alpha");
  const option = page.getByRole("option", { name: /Alpha/ });
  await option.dispatchEvent("pointerdown", { pointerId: 2, pointerType: "touch", isPrimary: true, button: 0, clientX: 20, clientY: 20 });
  await option.dispatchEvent("pointermove", { pointerId: 2, pointerType: "touch", clientX: 20, clientY: 60 });
  await option.dispatchEvent("pointerup", { pointerId: 2, pointerType: "touch", clientX: 20, clientY: 20 });
  await option.dispatchEvent("click", { detail: 1 });
  await expect(input).toHaveValue("Alpha");
  await option.dispatchEvent("pointerdown", { pointerId: 3, pointerType: "touch", isPrimary: true, button: 0, clientX: 20, clientY: 20 });
  await option.dispatchEvent("pointercancel", { pointerId: 3, pointerType: "touch" });
  await option.dispatchEvent("pointerup", { pointerId: 3, pointerType: "touch", clientX: 20, clientY: 20 });
  await option.dispatchEvent("click", { detail: 1 });
  expect(await page.evaluate(() => window.comparisonCalls)).toEqual([]);
  await option.focus();
  await option.press("Enter");
  await expect(page.locator(".public-comparison-picker.is-selected").first()).toContainText("Alpha");
  const second = page.getByRole("combobox", { name: "Second center", exact: true });
  await second.fill("Alpha");
  await expect(page.getByText("No matching active center found.")).toBeVisible();
  expect(await page.evaluate(() => window.comparisonCalls)).toEqual(["alpha"]);
});

test("a pointer release followed by a compatibility click commits only once", async ({ page }) => {
  await page.getByRole("combobox", { name: "First center", exact: true }).fill("Beta");
  await page.getByRole("option", { name: /Beta/ }).evaluate((element) => {
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 4, pointerType: "touch", isPrimary: true, button: 0, clientX: 20, clientY: 20 }));
    element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 4, pointerType: "touch", isPrimary: true, button: 0, clientX: 20, clientY: 20 }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  });
  await expect(page.locator(".public-comparison-picker.is-selected").first()).toContainText("Beta");
  expect(await page.evaluate(() => window.comparisonCalls)).toEqual(["beta"]);
});

test("suggestions fit the viewport when keyboard-sized space is limited", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 270 });
  await page.getByRole("combobox", { name: "First center", exact: true }).fill("Alpha");
  const list = page.getByRole("listbox", { name: "First center search results" });
  await expect(page.getByRole("option", { name: /Alpha/ })).toBeVisible();
  const bounds = await list.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(270);
  if (test.info().project.use.hasTouch) await page.getByRole("option", { name: /Alpha/ }).tap();
  else await page.getByRole("option", { name: /Alpha/ }).click();
  await expect(page.locator(".public-comparison-picker.is-selected").first()).toContainText("Alpha");
});
