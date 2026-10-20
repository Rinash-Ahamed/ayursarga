import { defineConfig } from "@playwright/test";
import { testDir, testOutputDir } from "./paths";
export default defineConfig({
  testDir, testMatch: ["portal-ui.spec.ts", "date-format.spec.ts"], outputDir: testOutputDir("portal-ui"), workers: 2,
  timeout: 120_000, use: { browserName: "chromium", actionTimeout: 10_000, reducedMotion: "reduce", screenshot: "only-on-failure" },
  projects: [
    { name: "phone-320", use: { viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true } },
    { name: "phone-390", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "landscape", use: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
    { name: "tablet-768", use: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
    { name: "tablet-1024", use: { viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "wide", use: { viewport: { width: 1920, height: 1080 } } },
    { name: "webkit-phone", use: { browserName: "webkit", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
