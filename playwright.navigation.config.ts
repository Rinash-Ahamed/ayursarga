import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", testMatch: "nav-hydration.spec.ts", outputDir: "test-results/navigation", workers: 1,
  use: { browserName: "chromium", viewport: { width: 390, height: 844 } },
});
