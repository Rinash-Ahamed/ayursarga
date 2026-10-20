import { resolve } from "node:path";

export const projectRoot = resolve(__dirname, "../..");
export const testDir = resolve(projectRoot, "tests/e2e");
export const testOutputDir = (suite = "") => resolve(projectRoot, "test-results", suite);
