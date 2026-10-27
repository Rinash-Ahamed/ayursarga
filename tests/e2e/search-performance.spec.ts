import { test, expect } from "@playwright/test";

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`image loading profile at ${viewport.width}px with slow image responses`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const requests: string[] = [];
    let releaseImages!: () => void;
    const imageGate = new Promise<void>((resolve) => { releaseImages = resolve; });
    const documents = Array.from({ length: 12 }, (_, index) => ({
      id: `image-centre-${index}`, name: `Care Centre ${index}`, city: "Palakkad", state: "Kerala", address: "Centre Road",
      imageUrls: [0, 1].map((photo) => `https://images.test/${index}-${photo}.svg`),
    }));
    await page.route("**/api/public/hospitals?*", (route) => route.fulfill({ json: { documents, cursor: null, hasMore: false } }));
    await page.route("https://images.test/**", async (route) => {
      requests.push(route.request().url());
      await imageGate;
      // Controlled slow image response, independent of external/CDN availability.
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({ contentType: "image/svg+xml", headers: { "cache-control": "public,max-age=31536000,immutable" }, body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#c9d8cd"/></svg>' });
    });
    await page.goto("/centers", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Care Centre 0", exact: true })).toBeVisible();
    const first = page.locator(".public-center-card:not(.public-center-skeleton) .public-center-card-image").first();
    await first.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
    const start = Date.now();
    releaseImages();
    await expect(first.locator("img")).toHaveCSS("opacity", "1");
    const coverVisibleMs = Date.now() - start;
    await page.waitForTimeout(600);
    const report = { width: viewport.width, simulatedImageLatencyMs: 250, coverVisibleMs, covers: requests.filter((url) => url.endsWith("-0.svg")).length, unrequestedGalleryPhotos: requests.filter((url) => url.endsWith("-1.svg")).length };
    console.log("SEARCH_IMAGE_PROFILE", JSON.stringify(report));
    await info.attach("search-image-profile", { body: JSON.stringify(report), contentType: "application/json" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(report.unrequestedGalleryPhotos).toBe(0);
    expect(report.covers).toBeLessThan(documents.length);
  });
}

// Production route, controlled public data and media. No authentication or cloud writes.
test("profile search rendering, navigation requests and input responsiveness", async ({ page }, info) => {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const imageRequests: string[] = [];
  const prefetches: string[] = [];
  let apiCalls = 0;
  const documents = Array.from({ length: 12 }, (_, index) => ({
    id: `test-centre-${index}`, name: `Ayurvedic Mother and Baby Centre ${index}`, city: index % 2 ? "Palakkad" : "Kozhikode", district: "Palakkad", state: "Kerala", address: "Centre Road", description: "Personalised Ayurvedic care for mothers and families with residential packages and professional guidance.",
    imageUrls: [0, 1].map((photo) => `https://images.test/centre-${index}-${photo}.svg`),
  }));
  await page.route("**/api/**", async (route) => {
    apiCalls++;
    await route.fulfill({ json: { documents, cursor: null, hasMore: false } });
  });
  await page.route("https://images.test/**", async (route) => {
    imageRequests.push(route.request().url());
    await route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#c9d8cd"/></svg>' });
  });
  // Record actual Next Link prefetching without visiting detail pages/cloud APIs.
  await page.route("**/centers/test-centre-*", async (route) => {
    prefetches.push(route.request().url());
    await route.fulfill({ status: 204, body: "" });
  });
  await page.addInitScript(() => {
    const metrics = { longTasks: [] as number[], shifts: [] as number[], frames: [] as number[] };
    (window as unknown as { searchMetrics: typeof metrics }).searchMetrics = metrics;
    new PerformanceObserver((list) => list.getEntries().forEach((entry) => metrics.longTasks.push(entry.duration))).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
      if (!(entry as PerformanceEntry & { hadRecentInput: boolean }).hadRecentInput) metrics.shifts.push((entry as PerformanceEntry & { value: number }).value);
    })).observe({ type: "layout-shift", buffered: true });
  });
  const started = Date.now();
  await page.goto("/centers");
  await expect(page.locator(".public-center-card")).toHaveCount(12);
  const resultsReadyMs = Date.now() - started;
  await page.waitForTimeout(1200);
  const initialImageRequests = imageRequests.length;
  // Slow scrolling exercises page painting, gallery lazy loading and Link prefetch.
  await page.evaluate(async () => {
    const metrics = (window as unknown as { searchMetrics: { frames: number[] } }).searchMetrics;
    let previous = performance.now();
    for (let frame = 0; frame < 90; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame((now) => { metrics.frames.push(now - previous); previous = now; scrollBy(0, 45); resolve(); }));
    }
    scrollTo(0, 0);
  });
  const latencies: number[] = [];
  const search = page.getByRole("searchbox", { name: "Centre or location" });
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    await search.fill("Palakkad");
    await expect(page.locator(".public-center-card")).toHaveCount(12); // district also matches
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    latencies.push(Date.now() - start);
    await search.fill("");
  }
  const metrics = await page.evaluate(() => {
    const data = (window as unknown as { searchMetrics: { frames: number[]; longTasks: number[]; shifts: number[] } }).searchMetrics;
    const frames = data.frames.slice().sort((a, b) => a - b);
    return { longTasks: data.longTasks.length, longTaskMs: Math.round(data.longTasks.reduce((a, b) => a + b, 0)), cls: data.shifts.reduce((a, b) => a + b, 0), frameP95Ms: Math.round(frames[Math.floor(frames.length * .95)] ?? 0), domElements: document.querySelectorAll("*").length };
  });
  const report = { ...metrics, resultsReadyMs, inputMedianMs: latencies.sort((a, b) => a - b)[2], initialImageRequests, totalImageRequests: imageRequests.length, apiCalls, detailPrefetches: prefetches.length };
  console.log("SEARCH_PROFILE", JSON.stringify(report));
  await info.attach("search-profile", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
  expect(apiCalls).toBe(1);
  expect(prefetches).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
