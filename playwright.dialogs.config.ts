import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "dialogs.spec.ts",
  outputDir: "test-results/dialogs",
  timeout: 30_000,
  workers: 2,
  reporter: "list",
  use: { browserName: "chromium", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "mobile-portrait", use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
    { name: "mobile-landscape", use: { viewport: { width: 800, height: 360 }, isMobile: true, hasTouch: true } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
