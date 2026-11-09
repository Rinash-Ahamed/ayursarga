import { defineConfig } from "@playwright/test";
import responsiveConfig from "./playwright.centre-search.config";
import { testOutputDir } from "./paths";
export default defineConfig({ ...responsiveConfig, testMatch:"public-media.spec.ts", outputDir:testOutputDir("public-media") });
