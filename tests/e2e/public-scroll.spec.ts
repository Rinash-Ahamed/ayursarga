import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";

const bundle = bundleDialogHarness("tests/fixtures/publicScrollHarness.tsx");
test("public scroll stays native, section anchors keep offsets and cards do not move on hover", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("about:blank");
  await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  for (const file of ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css"]) await page.addStyleTag({ content: readFileSync(file, "utf8") });
  await page.addScriptTag({ content: bundle });
  await expect(page.getByRole("link", { name: "Next section", exact: true })).toBeVisible();
  const card = page.locator(".process-journey>li");
  await card.scrollIntoViewIfNeeded();
  const before = await card.boundingBox();
  await card.hover();
  expect(await card.boundingBox()).toEqual(before);
  expect(await page.evaluate(() => {
    const wheel = new WheelEvent('wheel', { deltaY: 200, bubbles: true, cancelable: true });
    document.body.dispatchEvent(wheel);
    const touch = new Event('touchmove', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(touch);
    return !wheel.defaultPrevented && !touch.defaultPrevented && !document.documentElement.classList.contains('lenis');
  })).toBe(true);
  await page.getByRole("link", { name: "Next section", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Math.round(document.querySelector('#target>.section-inner')!.getBoundingClientRect().top))).toBe(100);
  expect(await page.evaluate(() => location.hash)).toBe('#target');
  await page.getByRole("link", { name: "Home section", exact: true }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => {
    const target = document.getElementById('target')!;
    window.dispatchEvent(new CustomEvent('ayursarga:scroll-to', { cancelable: true, detail: { target, offset: 20 } }));
  });
  await expect.poll(() => page.evaluate(() => Math.round(document.getElementById('target')!.getBoundingClientRect().top))).toBe(108);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
