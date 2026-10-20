import { defineConfig } from "@playwright/test";
import { testDir, testOutputDir } from "./paths";

export default defineConfig({
  testDir,
  testMatch: "toasts.spec.ts",
  outputDir: testOutputDir("toasts"),
  timeout: 30_000,
  workers: 2,
  reporter: "list",
  use: { browserName: "chromium", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "reduced-motion", use: { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" } },
  ],
});
