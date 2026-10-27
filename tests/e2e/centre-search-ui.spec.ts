import { expect, test, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";
const bundle = bundleDialogHarness("tests/fixtures/centreSearchHarness.tsx", {
  "next/link": "tests/fixtures/centreSearchMocks.tsx",
  "@/services/hospitals/publicHospitalService": "tests/fixtures/centreSearchMocks.tsx",
  "firebase/firestore": "tests/fixtures/centreSearchMocks.tsx",
});

const uploadedPhoto = (index: number) => `https://firebasestorage.googleapis.com/v0/b/gallery.test/o/${encodeURIComponent(`hospitals/centre/images/00000000-0000-4000-8000-${String(index).padStart(12, "0")}-1200.webp`)}?alt=media&token=synthetic`;

async function mountImageFixture(page: import("@playwright/test").Page, urls: string[]) {
  await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  await page.evaluate((images) => { window.centreSearchImageUrls = images; }, urls);
  for (const file of ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css"]) await page.addStyleTag({ content: readFileSync(file, "utf8") });
  await page.addScriptTag({ content: bundle });
  await expect(page.getByRole("heading", { name: /Ayursarga Mother and Baby/ })).toBeVisible();
  const frame = page.locator(".public-center-card-image").first();
  await frame.scrollIntoViewIfNeeded();
  return frame;
}

test("responsive covers do not preload galleries and rapid taps share one decode", async ({ page }) => {
  const requested: string[] = [];
  let releaseNext!: () => void;
  const nextGate = new Promise<void>((resolve) => { releaseNext = resolve; });
  const variants = new Map(await Promise.all([480, 800, 1200].map(async (width) => [width, await sharp({ create: { width, height: width * 3 / 4, channels: 3, background: "#c9d8cd" } }).webp({ quality: 82 }).toBuffer()] as const)));
  await page.route("https://firebasestorage.googleapis.com/**", async (route) => {
    const url = decodeURIComponent(route.request().url());
    requested.push(url);
    if (url.includes("000000000001-")) await nextGate;
    const width = Number(url.match(/-(480|800|1200)\.webp/)![1]);
    await route.fulfill({ contentType: "image/webp", body: variants.get(width)! });
  });
  const frame = await mountImageFixture(page, [uploadedPhoto(0), uploadedPhoto(1)]);
  await expect(frame.locator("img")).toHaveClass("is-loaded");
  await expect(frame.locator("img")).toHaveAttribute("loading", "eager");
  expect(requested).toHaveLength(1);
  expect(requested[0]).toContain("-480.webp");
  const before = await frame.boundingBox();
  await page.evaluate(() => {
    const original = HTMLImageElement.prototype.decode;
    let calls = 0;
    Object.defineProperty(window, "galleryDecodeCalls", { get: () => calls });
    HTMLImageElement.prototype.decode = function () { calls++; return original.call(this); };
    const button = document.querySelector<HTMLButtonElement>('[aria-label="Show next hospital image"]')!;
    button.click(); button.click();
  });
  await expect.poll(() => requested.length).toBe(2);
  expect(await page.evaluate(() => (window as unknown as { galleryDecodeCalls: number }).galleryDecodeCalls)).toBe(1);
  await expect(frame.locator("img")).toHaveClass("is-loaded");
  await expect(page.locator(".public-center-image-nav>span")).toHaveText("1 / 2");
  releaseNext();
  await expect(page.locator(".public-center-image-nav>span")).toHaveText("2 / 2");
  expect(await frame.boundingBox()).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("missing responsive variants retry the original and broken galleries keep their frame", async ({ page }) => {
  const requested: string[] = [];
  const photo = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#c9d8cd" } }).webp().toBuffer();
  await page.route("https://firebasestorage.googleapis.com/**", (route) => {
    const url = decodeURIComponent(route.request().url());
    requested.push(url);
    return url.includes("-1200.webp") ? route.fulfill({ contentType: "image/webp", body: photo }) : route.fulfill({ status: 404 });
  });
  const frame = await mountImageFixture(page, [uploadedPhoto(0)]);
  await expect(frame.locator("img")).toHaveClass("is-loaded");
  expect(requested).toHaveLength(2);
  expect(requested[1]).toContain("-1200.webp");
  const before = await frame.boundingBox();
  await page.unroute("https://firebasestorage.googleapis.com/**");
  await page.route("https://firebasestorage.googleapis.com/**", (route) => route.fulfill({ status: 404 }));
  // A failed reload also exercises final exhaustion without leaving a broken img.
  await frame.locator("img").evaluate((image: HTMLImageElement) => image.dispatchEvent(new Event("error")));
  await expect(frame).toHaveClass(/placeholder/);
  await expect(frame.locator("img")).toHaveCount(0);
  expect(await frame.boundingBox()).toEqual(before);
});
test("search page reflows and retains live filtering, galleries and comparison", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const photo = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#c9d8cd" } }).webp().toBuffer();
  await page.route("https://images.test/**", (route) => route.fulfill({ contentType: "image/webp", body: photo }));
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  for (const file of ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css"]) await page.addStyleTag({ content: readFileSync(file, "utf8") });
  await page.addStyleTag({ content: ':root{--font-body:Arial,sans-serif;--font-display:Arial,sans-serif}' });
  await page.addScriptTag({ content: bundle });
  await expect(page.locator(".public-center-card")).toHaveCount(2);
  await page.locator(".public-center-card").first().scrollIntoViewIfNeeded();
  await expect(page.locator(".public-center-card-image img")).toHaveClass("is-loaded");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const columns = await page.locator('.public-center-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(info.project.use.viewport!.width > 1100 ? 3 : 2);
  const cards = await page.locator('.public-center-card').evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().height));
  expect(Math.abs(cards[0] - cards[1])).toBeLessThanOrEqual(1);
  const imageRatio = await page.locator('.public-center-card-image').first().evaluate((el) => { const r = el.getBoundingClientRect(); return r.width / r.height; });
  expect(imageRatio).toBeCloseTo(4 / 3, 1);
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
  await expect(page.getByRole("link", { name: "View details for Sanjeevani" })).toHaveAttribute("href", /q=Palakkad/);
  await expect(page.locator(".public-center-toggle").first()).toHaveAttribute("data-prefetch", "disabled");
  await search.fill("");
  await page.getByRole("button", { name: "Show next hospital image" }).click();
  await expect(page.locator(".public-center-image-nav>span")).toHaveText("2 / 10");
  await expect(page.getByRole("link", { name: "View details for Sanjeevani" })).toHaveAttribute("href", /\/centers\/beta/);
  await expect(page.getByRole("button", { name: "Expand comparison", exact: true })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Expand comparison", exact: true }).click();
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

test("sold-out centres stay visible and only the details button navigates", async ({ page }) => {
  await page.route("https://images.test/**", (route) => route.fulfill({ status: 404 }));
  await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  for (const file of ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css"]) await page.addStyleTag({ content: readFileSync(file, "utf8") });
  await page.evaluate(() => { window.centreSearchBlocked = true; });
  await page.addScriptTag({ content: bundle });
  await expect(page.locator(".public-center-card")).toHaveCount(2);
  await page.getByLabel("Start date or expected delivery date").fill("25/10/2099");
  const card = page.locator(".public-center-card").first();
  await expect(card.getByText("Sold Out", { exact: true })).toBeVisible();
  await expect(page.locator(".public-center-card")).toHaveCount(2);
  await expect(card.locator("a")).toHaveCount(1);
  await expect(card.getByRole("link")).toContainText("View centre details");
  await expect(card.getByRole("link")).toHaveAttribute("href", /startDate=2099-10-25/);
  const url = page.url();
  await card.locator("h3").click();
  expect(page.url()).toBe(url);
  await page.getByLabel("Start date or expected delivery date").fill("26/10/2099");
  await expect(card.getByText("Sold Out", { exact: true })).toHaveCount(0);
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator(".public-center-card-image")).toHaveClass(/placeholder/);
  await expect(card.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("loading placeholders do not block search or comparison controls", async ({ page }) => {
  await page.route("https://images.test/**", (route) => route.fulfill({ status: 404 }));
  await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  for (const file of ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css"]) await page.addStyleTag({ content: readFileSync(file, "utf8") });
  await page.evaluate(() => { window.centreSearchDelay = 1200; });
  await page.addScriptTag({ content: bundle });
  await expect(page.locator('.public-center-grid')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.public-center-skeleton')).toHaveCount(12);
  await page.getByRole('searchbox', { name: 'Centre or location' }).fill('Palakkad');
  await page.getByRole('button', { name: 'Expand comparison', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'First center', exact: true })).toBeEnabled();
  await expect(page.locator('.public-center-skeleton')).toHaveCount(0);
  await expect(page.locator('.public-center-card')).toHaveCount(1);
  await expect(page.locator('.public-center-grid')).toHaveAttribute('aria-busy', 'false');
});

test("off-screen photos wait for scrolling and retain a skeleton until loaded", async ({ page }) => {
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 240 });
  const images: Route[] = [];
  await page.route("https://images.test/**", (route) => { images.push(route); });
  await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  for (const file of ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css"]) await page.addStyleTag({ content: readFileSync(file, "utf8") });
  // Keep the gallery beyond the intentional 320px warm-up margin at every width.
  // Short landscape headings alone do not guarantee that distance.
  await page.addStyleTag({ content: ".public-center-grid{margin-top:1000px}" });
  await page.addScriptTag({ content: bundle });
  await expect(page.locator('.public-center-card')).toHaveCount(2);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(images).toHaveLength(0);
  await expect(page.locator('.public-center-card-image img')).toHaveCount(0);
  const frame = page.locator('.public-center-card-image').first();
  await frame.scrollIntoViewIfNeeded();
  await expect.poll(() => images.length).toBe(1);
  await expect(frame).toHaveAttribute('aria-busy', 'true');
  await expect(frame.locator('.public-center-image-skeleton')).toBeVisible();
  await images[0].fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#c9d8cd"/></svg>' });
  await expect(frame.locator('img')).toHaveClass('is-loaded');
  await expect(frame).toHaveAttribute('aria-busy', 'false');
  await expect(frame.locator('.public-center-image-skeleton')).toHaveCount(0);
});

test("more results load incrementally without resetting the current filter", async ({ page }) => {
  await page.route("https://images.test/**", (route) => route.fulfill({ status: 404 }));
  await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  await page.evaluate(() => { window.centreSearchHasMore = true; });
  for (const file of ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css"]) await page.addStyleTag({ content: readFileSync(file, "utf8") });
  await page.addScriptTag({ content: bundle });
  await expect(page.locator('.public-center-card')).toHaveCount(2);
  expect(await page.evaluate(() => window.centreSearchCalls)).toEqual([null]);
  const search = page.getByRole('searchbox', { name: 'Centre or location' });
  await search.fill('Palakkad');
  await expect(page.locator('.public-center-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Show more centers' }).click();
  await expect(page.locator('.public-center-card')).toHaveCount(2);
  await expect(search).toHaveValue('Palakkad');
  expect(await page.evaluate(() => window.centreSearchCalls)).toEqual([null, 'next']);
  await expect(page.getByRole('button', { name: 'Show more centers' })).toHaveCount(0);
});
