import { defineConfig } from "@playwright/test";
import responsiveConfig from "./playwright.centre-search.config";
import { testOutputDir } from "./paths";

export default defineConfig({ ...responsiveConfig, testMatch: "ayu-buddy.spec.ts", outputDir: testOutputDir("ayu-buddy") });
