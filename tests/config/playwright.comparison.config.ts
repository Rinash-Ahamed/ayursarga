import { defineConfig } from "@playwright/test";
import { testDir, testOutputDir } from "./paths";
export default defineConfig({
  testDir, testMatch: "centre-comparison.spec.ts", outputDir: testOutputDir("comparison"), workers: 1,
  use: { browserName: "chromium" },
  projects: [
    { name: "narrow-mobile", use: { viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "landscape", use: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "webkit-mobile", use: { browserName: "webkit", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "webkit-desktop", use: { browserName: "webkit", viewport: { width: 1440, height: 900 } } },
  ],
});
