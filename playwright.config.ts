import { defineConfig } from "@playwright/test";

const port = 3000;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    browserName: "chromium",
    channel: "chrome",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile-320", use: { viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true } },
    { name: "mobile-360", use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
    { name: "tablet-768", use: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
    { name: "tablet-1024", use: { viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true } },
    { name: "desktop-1280", use: { viewport: { width: 1280, height: 800 } } },
    { name: "wide-1440", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npm run dev -- -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
