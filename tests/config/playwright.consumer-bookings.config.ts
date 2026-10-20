import { defineConfig } from "@playwright/test";
import responsiveConfig from "./playwright.centre-search.config";
import { testOutputDir } from "./paths";

export default defineConfig({
  ...responsiveConfig,
  testMatch: "consumer-bookings.spec.ts",
  outputDir: testOutputDir("consumer-bookings"),
});
