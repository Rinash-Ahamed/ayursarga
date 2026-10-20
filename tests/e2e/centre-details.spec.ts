import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";
const bundle = bundleDialogHarness("tests/fixtures/centreDetailsHarness.tsx", Object.fromEntries(["next/link", "firebase/firestore", "@/services/hospitals/publicHospitalService"].map((name) => [name, "tests/fixtures/centreDetailsMocks.tsx"])));
async function mount(page: Page, blocked = false) {
  await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  for (const file of ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css"]) await page.addStyleTag({ content: readFileSync(file, "utf8") });
  await page.evaluate((value) => { window.centreDetailsBlocked = value; }, blocked);
  await page.addScriptTag({ content: bundle });
  await expect(page.locator(".public-centre-package")).toHaveCount(4);
}
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
