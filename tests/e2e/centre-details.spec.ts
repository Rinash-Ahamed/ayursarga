import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";
const bundle = bundleDialogHarness("tests/fixtures/centreDetailsHarness.tsx", Object.fromEntries(["next/link", "firebase/firestore", "@/services/hospitals/publicHospitalService"].map((name) => [name, "tests/fixtures/centreDetailsMocks.tsx"])));
async function mount(page: Page, blocked = false, hold = false, fail = false) {
  await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  for (const file of ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css"]) await page.addStyleTag({ content: readFileSync(file, "utf8") });
  await page.evaluate(({ blocked, hold, fail }) => { window.centreDetailsBlocked = blocked; window.centreDetailsHold = hold; window.centreDetailsFail = fail; }, { blocked, hold, fail });
  await page.addScriptTag({ content: bundle });
  if (hold) {
    await expect(page.locator(".public-centre-loading-layout")).toBeVisible();
    // The initial skeleton can paint before React runs its data-loading effect.
    await page.waitForFunction(() => typeof window.finishCentreDetails === "function");
  }
  else await expect(page.locator(".public-centre-package")).toHaveCount(4);
}

test("centre loading reserves responsive content space without shifting a visible footer", async ({ page }, info) => {
  await mount(page, false, true);
  await expect(page.getByRole("status")).toHaveText("Preparing centre details…");
  await expect(page.locator(".public-centre-detail-page")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".public-centre-loading-layout")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".public-centre-loading-layout a,.public-centre-loading-layout button")).toHaveCount(0);
  expect((await page.getByTestId("detail-footer").boundingBox())!.y).toBeGreaterThan(page.viewportSize()!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const gallery = await page.locator(".public-centre-gallery-main").boundingBox();
  expect(gallery!.width).toBeGreaterThan(0); expect(gallery!.height).toBeGreaterThan(150);
  if (page.viewportSize()!.width <= 760) expect(gallery!.width / gallery!.height).toBeCloseTo(4 / 3, 1);
  await page.screenshot({ path: info.outputPath("centre-loading.png"), fullPage: true });
  await page.evaluate(() => {
    const state = window as unknown as { detailCLS: number };
    state.detailCLS = 0;
    if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!entry.hadRecentInput) state.detailCLS += entry.value;
    }).observe({ type: "layout-shift" });
    window.finishCentreDetails?.();
  });
  await expect(page.locator(".public-centre-package")).toHaveCount(4);
  await expect(page.locator(".public-centre-loading-layout")).toHaveCount(0);
  await expect(page.locator(".public-centre-detail-header h1")).toHaveText("Ayursarga Mother and Baby Wellness Centre");
  expect((await page.getByTestId("detail-footer").boundingBox())!.y).toBeGreaterThan(page.viewportSize()!.height);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as unknown as { detailCLS: number }).detailCLS)).toBeLessThan(.01);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("failed centre loading replaces skeletons with the existing recovery state", async ({ page }) => {
  await mount(page, false, true, true);
  await page.evaluate(() => window.finishCentreDetails?.());
  await expect(page.getByText("Centre details unavailable", { exact: true })).toBeVisible();
  await expect(page.locator(".public-centre-loading-layout")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Return to centre search" })).toHaveAttribute("href", /\/centers\?startDate=2099-10-25/);
  await expect(page.getByRole("link", { name: "Book Appointment", exact: true })).toHaveCount(0);
});
test("centre packages use two compact columns with working details and booking links", async ({ page }, info) => {
  await mount(page);
  const cards = page.locator(".public-centre-package");
  await expect(cards.locator("h3")).toHaveText(["7-day package", "14-day package", "21-day package", "28-day package"]);
  const first = cards.first();
  await expect(first.locator(".public-package-price")).toHaveText("₹14,000");
  const link = first.getByRole("link", { name: "Book Appointment", exact: true });
  await expect(link).toHaveAttribute("href", /hospitalId=alpha&serviceId=package-7&startDate=2099-10-25/);
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const layout = await cards.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    const button = element.querySelector("a")!.getBoundingClientRect();
    return { top: rect.top, left: rect.left, right: rect.right, height: rect.height, buttonBottom: button.bottom };
  }));
  expect(Math.abs(layout[0].top - layout[1].top)).toBeLessThanOrEqual(1);
  expect(layout[1].left).toBeGreaterThanOrEqual(layout[0].right - 1);
  expect(Math.abs(layout[0].height - layout[1].height)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout[0].buttonBottom - layout[1].buttonBottom)).toBeLessThanOrEqual(1);
  await first.getByRole("button", { name: "View more", exact: true }).click();
  await expect(first).toHaveAttribute("data-expanded", "true");
  await expect(first.locator(".public-centre-package-copy>p")).toContainText("throughout your stay.");
  await expect(first.locator(".public-package-procedures")).toContainText("Personalised specialist-supervised restorative wellness procedure");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await first.getByRole("button", { name: "View less", exact: true }).click();
  await expect(first.locator(".public-package-procedures")).toHaveCount(0);
  await page.locator("#packages").screenshot({ path: info.outputPath("packages-grid.png") });
});
test("sold-out centre packages remain visible but cannot be booked", async ({ page }) => {
  await mount(page, true);
  await expect(page.locator(".public-centre-services a")).toHaveCount(0);
  const buttons = page.locator(".public-centre-services").getByRole("button", { name: "Sold Out", exact: true });
  await expect(buttons).toHaveCount(4);
  for (const button of await buttons.all()) await expect(button).toBeDisabled();
});
