// Local production-build lab only. API fixtures avoid cloud reads/writes.
import { chromium } from "@playwright/test";
import { gzipSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3189");
if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || origin.pathname !== "/" || origin.username || origin.password) throw Error("Only a loopback production server may be profiled.");
const phase = process.argv[3] ?? "baseline";
if (!/^[a-z-]{1,30}$/.test(phase)) throw Error("Use a simple report label.");
const browser = await chromium.launch({ headless: true });
const results = [];
const median = values => { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
try {
  for (const width of [390, 1440]) for (const path of ["/", "/centers", "/discover/online-consultation", "/app/bookings/consultation?service=prenatal-doctor", "/admin/login", "/hospital/login"]) {
    const samples = [];
    for (let sample = 0; sample < 3; sample++) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      const scripts = new Map(), pending = [];
      let apiRequests = 0, runtimeErrors = 0;
      page.on("pageerror", () => runtimeErrors++);
      page.on("response", response => {
        if (response.request().resourceType() === "script" && response.url().startsWith(origin.origin)) pending.push(response.body().then(body => scripts.set(response.url(), gzipSync(body).length)).catch(() => {}));
      });
      await page.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin.origin) return route.abort();
        if (url.pathname.startsWith("/api/")) {
          apiRequests++;
          if (url.pathname === "/api/public/hospitals") return route.fulfill({ json: { documents: Array.from({ length: 12 }, (_, i) => ({ id: `synthetic-${i}`, name: `Synthetic Centre ${i}`, city: "Palakkad", state: "Kerala", address: "Test Road", imageUrls: [] })), cursor: null, hasMore: false } });
          return route.fulfill({ status: 401, json: { error: "Synthetic anonymous session" } });
        }
        return route.continue();
      });
      await page.addInitScript(() => {
        sessionStorage.setItem("ayursarga-public-opening-seen", "true");
        window.readinessMetrics = { lcp: 0, cls: 0, longTaskMs: 0 };
        new PerformanceObserver(list => { for (const item of list.getEntries()) window.readinessMetrics.lcp = item.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver(list => { for (const item of list.getEntries()) if (!item.hadRecentInput) window.readinessMetrics.cls += item.value; }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver(list => { for (const item of list.getEntries()) window.readinessMetrics.longTaskMs += item.duration; }).observe({ type: "longtask", buffered: true });
      });
      const response = await page.goto(new URL(path, origin).href, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1600);
      await Promise.all(pending);
      const metrics = await page.evaluate(() => ({ ...window.readinessMetrics,
        domReadyMs: performance.getEntriesByType("navigation")[0].domContentLoadedEventEnd,
        overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
      samples.push({ ...metrics, status: response.status(), apiRequests, runtimeErrors, jsGzipBytes: [...scripts.values()].reduce((a, b) => a + b, 0) });
      await context.close();
    }
    const row = { width, path, samples, median: Object.fromEntries(["domReadyMs", "lcp", "cls", "longTaskMs", "jsGzipBytes"].map(key => [key, Number(median(samples.map(sample => sample[key])).toFixed(key === "cls" ? 6 : 2))])) };
    results.push(row);
    console.log(JSON.stringify(row));
  }
} finally { await browser.close(); }
mkdirSync("test-results/readiness", { recursive: true });
writeFileSync(`test-results/readiness/${phase}.json`, JSON.stringify({ phase, conditions: "Local production, unthrottled software-rendered Chromium, cold browser contexts, external origins blocked, synthetic directory data. Protected pages measure anonymous shells, not signed-in workloads. Three samples per route/width; not field CWV or load capacity.", results }, null, 2));
