import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", testMatch: "portal-performance.spec.ts", outputDir: "test-results/performance", workers: 1,
  reporter: "list", use: { browserName: "chromium" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
  ],
});
