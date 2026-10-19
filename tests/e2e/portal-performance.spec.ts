import { expect, test } from "@playwright/test";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";

const bundle = bundleDialogHarness("tests/fixtures/portalPerformanceHarness.tsx", {
  "@/services/hospitals/capacityService": "tests/fixtures/portalPerformanceMocks.tsx",
});
test.beforeEach(async ({ page }) => {
  await page.setContent('<div id="fixture-root"></div>');
  await page.addScriptTag({ content: bundle });
  await expect(page.getByRole("button", { name: "Update room availability" })).toBeEnabled();
});
test("measure confirmed room save interaction", async ({ page }) => {
  for (let index = 0; index < 3; index++) {
    await page.getByRole("spinbutton", { name: "Total rooms", exact: true }).fill(String(11 + index));
    const result = await page.evaluate(async () => {
      const counters = window.portalPerformanceCounters;
      const reads = counters.reads;
      const writes = counters.writes;
      const button = document.querySelector<HTMLButtonElement>('button.portal-button')!;
      const start = performance.now();
      button.click();
      await new Promise<void>((resolve) => {
        let sawBusy = false;
        const timer = setInterval(() => {
          sawBusy ||= button.disabled;
          if (sawBusy && !button.disabled && document.querySelector('.portal-toast')) { clearInterval(timer); resolve(); }
        }, 5);
      });
      return { totalMs: Math.round(performance.now() - start), reads: counters.reads - reads, writes: counters.writes - writes };
    });
    console.log(`room-save sample ${index + 1}: ${JSON.stringify(result)}`);
    expect(result.reads).toBe(0);
    expect(result.writes).toBe(1);
    await expect(page.getByRole("button", { name: "Update room availability" })).toBeEnabled();
  }
});

test("pending submissions stay disabled; errors do not announce success and a retry works", async ({ page }) => {
  await page.evaluate(() => { window.portalPerformanceCounters.fail = true; });
  const save = page.getByRole("button", { name: "Update room availability" });
  await save.click();
  await expect(page.getByRole("button", { name: "Saving..." })).toBeDisabled();
  await expect(page.locator(".portal-toast")).toContainText("Test save failed");
  expect(await page.evaluate(() => window.portalPerformanceCounters.writes)).toBe(1);
  await page.evaluate(() => { window.portalPerformanceCounters.fail = false; });
  await save.click();
  await expect(page.locator(".portal-toast")).toContainText("Room availability has been updated.");
  expect(await page.evaluate(() => window.portalPerformanceCounters.writes)).toBe(2);
  expect(await page.evaluate(() => window.portalPerformanceCounters.reads)).toBe(1);
});
