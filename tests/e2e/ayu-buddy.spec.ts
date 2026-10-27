import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";

const overrides = {
  "next/link": "tests/fixtures/centreSearchMocks.tsx", "next/image": "tests/fixtures/portalUiMocks.tsx",
};
const bundle = bundleDialogHarness("tests/fixtures/ayuBuddyHarness.tsx", overrides, { NEXT_PUBLIC_AYU_ONLINE: "true" });
const disabledBundle = bundleDialogHarness("tests/fixtures/ayuBuddyHarness.tsx", overrides, { NEXT_PUBLIC_AYU_ONLINE: "false" });
const photo = readFileSync("public/ayu-buddy.webp");

async function mount(page: Page, enabled = true) {
  await page.route("https://ayu.test/**", (route) => route.request().url().endsWith("ayu-buddy.webp")
    ? route.fulfill({ contentType: "image/webp", body: photo })
    : route.fulfill({ contentType: "text/html", body: '<html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main style="height:2500px"><h1>Ayursarga</h1><button>Background control</button></main><div id="fixture-root"></div></body></html>' }));
  await page.goto("https://ayu.test/");
  for (const file of ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css"]) await page.addStyleTag({ content: readFileSync(file, "utf8") });
  await page.addScriptTag({ content: enabled ? bundle : disabledBundle });
}
async function openForm(page: Page) {
  await page.getByRole("button", { name: "Ask Ayu, your Ayursarga guide" }).click();
  await page.getByRole("button", { name: "Send a question to our team" }).click();
  await page.getByLabel("Your name *", { exact: true }).fill("Test Visitor");
  await page.getByLabel("Email address *", { exact: true }).fill("visitor@example.com");
  await page.getByLabel("Phone number *", { exact: true }).fill("9876543210");
  await page.getByLabel("Your question *", { exact: true }).fill("How can I compare two hospitals?");
}

test("Ayu offers curated guidance with a viewport-safe, scroll-locked keyboard-accessible dialog", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mount(page);
  await page.evaluate(() => scrollTo({ top: 500, behavior: "instant" }));
  const launcher = page.getByRole("button", { name: "Ask Ayu, your Ayursarga guide" });
  await expect(launcher).toBeVisible();
  expect(await page.evaluate(() => (globalThis as typeof globalThis & { fixtureLazyLoads?: number }).fixtureLazyLoads ?? 0)).toBe(0);
  for (let round = 0; round < 2; round++) {
    await launcher.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Your little buddy for natural wellness");
    await expect(dialog).toContainText("not a live agent or medical adviser");
    expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
    await page.getByRole("button", { name: "Find the right care", exact: true }).click();
    await expect(dialog.getByRole("link", { name: /Search hospitals/ })).toHaveAttribute("href", "/centers");
    await expect(dialog.locator(".ayu-buddy-answer a")).toHaveText("Search hospitals");
    await expect(dialog.locator(".ayu-buddy-answer a")).toHaveCSS("text-decoration-line", "none");
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    if (!round) await page.screenshot({ path: info.outputPath("ayu-guide.png") });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
    expect(Math.abs(await page.evaluate(() => scrollY) - 500)).toBeLessThanOrEqual(1);
    await expect(launcher).toBeFocused();
  }
  expect(errors).toEqual([]);
  // One deferred dialog, reused from React's module cache on the second open.
  expect(await page.evaluate(() => (globalThis as typeof globalThis & { fixtureLazyLoads?: number }).fixtureLazyLoads)).toBe(1);
});

test("AYU_ONLINE=false renders nothing and loads no mascot, dialog or enquiry requests", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await mount(page, false);
  await page.getByRole("heading", { name: "Ayursarga", exact: true }).waitFor();
  await expect(page.getByRole("button", { name: "Ask Ayu, your Ayursarga guide" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(requests.filter((url) => /ayu-buddy\.webp|\/api\/contact/.test(url))).toEqual([]);
  expect(await page.evaluate(() => (globalThis as typeof globalThis & { fixtureLazyLoads?: number }).fixtureLazyLoads ?? 0)).toBe(0);
  expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
});

test("a failed helper chunk does not break or lock the website", async ({ page }) => {
  await mount(page);
  await page.evaluate(() => { (globalThis as typeof globalThis & { fixtureLazyFailure?: boolean }).fixtureLazyFailure = true; });
  await page.getByRole("button", { name: "Ask Ayu, your Ayursarga guide" }).click();
  await expect(page.getByRole("alert")).toContainText("Ayu is unavailable");
  expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  await page.getByRole("button", { name: "Background control", exact: true }).click();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("questions submit once through the existing email API and never claim success before acknowledgement", async ({ page }) => {
  await mount(page);
  const payloads: Record<string, string>[] = [];
  let complete!: () => void;
  const gate = new Promise<void>((resolve) => { complete = resolve; });
  await page.route("https://ayu.test/api/contact", async (route) => {
    payloads.push(route.request().postDataJSON());
    await gate;
    await route.fulfill({ json: { ok: true } });
  });
  await openForm(page);
  const dialog = page.getByRole("dialog");
  await dialog.locator("form").evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit(); });
  await expect.poll(() => payloads.length).toBe(1);
  await expect(page.getByRole("button", { name: "Close Ayu" })).toBeDisabled();
  await expect(page.getByText("Your question has been submitted.", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect(payloads[0].interest).toBe("I need personal guidance");
  expect(payloads[0].guidanceProfile).toContain("Ayu");
  expect(payloads[0].email).toBe("visitor@example.com");
  complete();
  await expect(dialog.getByRole("status")).toContainText("Your question has been submitted.");
  await page.getByRole("button", { name: "Close Ayu" }).click();
  await page.getByRole("button", { name: "Ask Ayu, your Ayursarga guide" }).click();
  await expect(page.getByText("Your question has been submitted.", { exact: true })).toHaveCount(0);
  expect(payloads).toHaveLength(1);
});

test("email failures stay visible, retain the question and allow an explicit retry", async ({ page }) => {
  await mount(page);
  let requests = 0;
  await page.route("https://ayu.test/api/contact", (route) => {
    requests++;
    return requests === 1 ? route.fulfill({ status: 502, json: { error: "We could not send your request. Please try again." } }) : route.fulfill({ json: { ok: true } });
  });
  await openForm(page);
  await page.getByRole("button", { name: "Send to Ayursarga", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not send");
  await expect(page.getByLabel("Your question *", { exact: true })).toHaveValue("How can I compare two hospitals?");
  expect(requests).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const fonts = await page.locator('input:not(.hp-field),textarea').evaluateAll((elements) => elements.map((element) => parseFloat(getComputedStyle(element).fontSize)));
  expect(fonts.every((size) => size >= 16)).toBe(true);
  await page.getByRole("button", { name: "Send to Ayursarga", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Your question has been submitted.");
  expect(requests).toBe(2);
});
