import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", testMatch: "centre-comparison.spec.ts", outputDir: "test-results/comparison", workers: 1,
  use: { browserName: "chromium" },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
