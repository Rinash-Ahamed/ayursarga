import { expect, test } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/",
  "/centers",
  "/contact",
  "/about/who-we-are",
  "/mission-vision",
] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("ayursarga-public-opening-seen", "true");
  });
});

test("public pages stay within the viewport", async ({ page }) => {
  for (const route of PUBLIC_ROUTES) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.locator("#site-nav").waitFor();

    const overflow = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((element) => {
          const style = getComputedStyle(element);
          if (style.position === "fixed" || style.visibility === "hidden" || style.display === "none") return false;
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && (rect.left < -1 || rect.right > viewportWidth + 1);
        })
        .slice(0, 5)
        .map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth,
        offenders,
      };
    });

    expect(overflow.documentWidth, `${route}: ${overflow.offenders.join(", ")}`).toBeLessThanOrEqual(overflow.viewportWidth + 1);
  }
});

test("navigation switches cleanly between compact and desktop layouts", async ({ page }, testInfo) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const compact = testInfo.project.use.viewport!.width <= 900;

  await expect(page.locator(".mobile-bottom-nav")).toBeVisible({ visible: compact });
  await expect(page.locator(".nav-links")).toBeVisible({ visible: !compact });
});

test("home hero and responsive content grids remain contained", async ({ page }, testInfo) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const hero = page.locator("#hero");
  await expect(hero).toBeVisible();

  const heroBounds = await hero.boundingBox();
  expect(heroBounds).not.toBeNull();
  expect(heroBounds!.x).toBeGreaterThanOrEqual(-1);
  expect(heroBounds!.x + heroBounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await expect(hero.locator("h1")).toBeVisible();

  if (testInfo.project.name === "mobile-360") {
    const columns = await page.locator(".wellness-path-grid").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
    );
    expect(columns).toBe(2);
  }
});

test("login dialog remains inside compact viewports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.use.viewport!.width > 900);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
  await page.waitForTimeout(1_000);
  await page.locator(".mobile-bottom-account > button").click();
  const dialog = page.locator(".nav-auth-dialog");
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});
