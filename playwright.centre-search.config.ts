import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", testMatch: "centre-search-ui.spec.ts", outputDir: "test-results/centre-search", workers: 2,
  use: { browserName: "chromium", reducedMotion: "reduce" },
  projects: [
    { name: "phone", use: { viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true } },
    { name: "phone-landscape", use: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
    { name: "tablet-landscape", use: { viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "webkit-phone", use: { browserName: "webkit", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "webkit-tablet", use: { browserName: "webkit", viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true } },
  ],
});
