import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";
import type { DialogFixtureKind } from "../fixtures/dialogHarness";

const bundle = bundleDialogHarness();
const styles = ["app/globals.css", "app/portal.css"].map((file) => readFileSync(file, "utf8")).join("\n");

async function mount(page: Page, kind: DialogFixtureKind) {
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture-root"></div></body></html>');
  await page.addStyleTag({ content: styles });
  await page.addScriptTag({ content: bundle });
  await page.evaluate((value) => window.mountDialogFixture(value), kind);
  await expect(page.locator("#open-confirm")).toBeVisible();
}

async function expectCentred(page: Page) {
  const bounds = await page.getByRole("dialog").last().boundingBox();
  expect(bounds).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(-1);
  expect(bounds!.y).toBeGreaterThanOrEqual(-1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2)).toBeLessThan(2);
}

test("Admin and Hospital confirmations stay centred at top, middle and bottom; repeated cancel and confirm restore scroll", async ({ page }) => {
  test.setTimeout(120_000);
  for (const kind of ["image", "package", "booking", "activation", "audit", "treatment"] as const) {
    await mount(page, kind);
    for (const position of [0, 2500, 6000]) {
      await page.evaluate((top) => window.scrollTo(0, top), position);
      const before = await page.evaluate(() => ({ y: window.scrollY, style: document.body.style.cssText }));
      await page.locator("#open-confirm").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectCentred(page);
      await expect(page.locator("body > .app-modal-layer")).toHaveCount(1);
      const locked = await page.evaluate(() => ({ top: document.body.style.top, y: window.scrollY, height: document.body.getBoundingClientRect().top }));
      expect(parseFloat(locked.top) + before.y).toBe(0);
      await page.mouse.wheel(0, 650);
      await page.waitForTimeout(60);
      expect(await page.evaluate(() => window.scrollY)).toBe(locked.y);
      expect(await page.evaluate(() => document.body.getBoundingClientRect().top)).toBe(locked.height);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await page.evaluate(() => window.scrollY)).toBe(before.y);
      expect(await page.evaluate(() => document.body.style.cssText)).toBe(before.style);
      await page.locator("#open-confirm").click();
      await page.getByRole("button", { name: "Confirm action", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await page.evaluate(() => window.scrollY)).toBe(before.y);
      await expect(page.locator("#open-confirm")).toBeFocused();
    }
    await expect(page.getByTestId("confirmed")).toHaveText("3");
    await page.evaluate(() => window.scrollTo(0, 500));
    expect(await page.evaluate(() => window.scrollY)).toBe(500);
  }
});

test("viewport changes reposition the open dialog and existing scroll styles are restored", async ({ page }) => {
  await mount(page, "image");
  await page.evaluate(() => {
    document.body.style.overflowY = "auto";
    document.body.style.overscrollBehaviorY = "contain";
    document.documentElement.style.scrollBehavior = "smooth";
    window.scrollTo({ top: 1700, behavior: "instant" });
  });
  const before = await page.evaluate(() => ({ body: document.body.style.cssText, root: document.documentElement.style.cssText }));
  await page.locator("#open-confirm").click();
  await page.setViewportSize({ width: 800, height: 360 });
  await expect.poll(async () => page.locator(".app-modal-layer").evaluate((element) => Math.round(element.getBoundingClientRect().height))).toBe(360);
  await expectCentred(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await expect.poll(async () => page.locator(".app-modal-layer").evaluate((element) => Math.round(element.getBoundingClientRect().height))).toBe(800);
  await expectCentred(page);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => document.body.style.cssText)).toBe(before.body);
  expect(await page.evaluate(() => document.documentElement.style.cssText)).toBe(before.root);
  expect(await page.evaluate(() => window.scrollY)).toBe(1700);
});

test("touch swipes on the backdrop cannot move the background", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch);
  await mount(page, "image");
  await page.evaluate(() => window.scrollTo(0, 2400));
  await page.locator("#open-confirm").click();
  const top = await page.evaluate(() => document.body.getBoundingClientRect().top);
  const session = await page.context().newCDPSession(page);
  const height = page.viewportSize()!.height;
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 2, y: height * 0.8 }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 2, y: height * 0.2 }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(await page.evaluate(() => document.body.getBoundingClientRect().top)).toBe(top);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => window.scrollY)).toBe(2400);
  await session.detach();
});

test("keyboard focus stays in the dialog, Escape and backdrop dismiss it, typing does not remount it", async ({ page }) => {
  await mount(page, "activation");
  await page.locator("#open-confirm").click();
  await page.getByRole("textbox", { name: "Details" }).fill("https://example.com/signed-contract.pdf");
  await expect(page.getByRole("textbox")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Confirm action" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#open-confirm")).toBeFocused();
  await page.locator("#open-confirm").click();
  await page.locator(".app-modal-layer").click({ position: { x: 2, y: 2 } });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("long dialogs scroll internally; background is fixed; busy operations cannot be dismissed", async ({ page }) => {
  await mount(page, "tall");
  await page.evaluate(() => window.scrollTo(0, 2300));
  await page.locator("#open-confirm").click();
  await expectCentred(page);
  await page.getByRole("dialog").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(page.getByRole("button", { name: "Confirm action" })).toBeVisible();
  expect(await page.getByRole("dialog").evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => window.scrollY)).toBe(2300);
  await mount(page, "busy");
  await page.locator("#open-confirm").click();
  await page.keyboard.press("Escape");
  await page.locator(".app-modal-layer").click({ position: { x: 2, y: 2 } });
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Working..." })).toBeDisabled();
});

test("contract preview shares the lock and nested confirmations cannot unlock its background", async ({ page }) => {
  await mount(page, "preview");
  await page.evaluate(() => window.scrollTo(0, 2100));
  await page.locator("#open-confirm").click();
  await expectCentred(page);
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(2);
  await expectCentred(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
  await page.getByRole("button", { name: "Close preview", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(2100);
  expect(await page.evaluate(() => document.body.style.position)).toBe("");
});
