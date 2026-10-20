import { defineConfig } from "@playwright/test";
import { testDir, testOutputDir } from "./paths";
export default defineConfig({
  testDir, testMatch: "search-performance.spec.ts", workers: 1, timeout: 120_000,
  outputDir: testOutputDir("search-performance"),
  use: { browserName: "chromium", baseURL: "http://127.0.0.1:3107", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
});
