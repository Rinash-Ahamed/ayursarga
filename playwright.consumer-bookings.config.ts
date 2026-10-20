import { defineConfig } from "@playwright/test";
import responsiveConfig from "./playwright.centre-search.config";

export default defineConfig({
  ...responsiveConfig,
  testMatch: "consumer-bookings.spec.ts",
  outputDir: "test-results/consumer-bookings",
});
