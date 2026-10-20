import { defineConfig } from "@playwright/test";
import { testDir, testOutputDir } from "./paths";
export default defineConfig({
  testDir, testMatch: "nav-hydration.spec.ts", outputDir: testOutputDir("navigation"), workers: 1,
  use: { browserName: "chromium", viewport: { width: 390, height: 844 } },
});
