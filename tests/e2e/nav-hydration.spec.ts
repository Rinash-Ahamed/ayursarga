import { test, expect } from "@playwright/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const paths = ["next/navigation", "@/contexts/AuthContext", "@/hooks/useAuth", "next/image", "@/components/ScrollLogo", "@/components/ModalLayer"];
const mocks = loadTypeScript("tests/fixtures/navHydrationMocks.tsx");
const overrides = Object.fromEntries(paths.map((path) => [path, mocks]));
const { default: Nav } = loadTypeScript("components/Nav.tsx", overrides);
const html = renderToString(createElement(Nav));
const bundle = bundleDialogHarness("tests/fixtures/navHydrationHarness.tsx", Object.fromEntries(paths.map((path) => [path, "tests/fixtures/navHydrationMocks.tsx"])));

test("server and browser paths may differ without hydration warnings; active links still follow navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/mainlogo.png", (route) => route.fulfill({ status: 204, body: "" }));
  await page.setContent(`<div id="fixture-root">${html}</div>`);
  // Reproduce the reported case: SSR at /, but the client router sees /admin.
  await page.evaluate(() => { window.navFixturePath = "/admin"; });
  await page.addScriptTag({ content: bundle });
  await expect.poll(() => page.evaluate(() => window.navFixtureReady)).toBe(true);
  const nav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(nav.getByRole("link", { name: "Home", exact: true })).not.toHaveAttribute("aria-current");
  await page.evaluate(() => window.updateNavFixturePath("/centers"));
  await expect(nav.getByRole("link", { name: "Search", exact: true })).toHaveAttribute("aria-current", "page");
  await page.evaluate(() => window.updateNavFixturePath("/contact"));
  await expect(nav.getByRole("link", { name: "Contact", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Search", exact: true })).not.toHaveAttribute("aria-current");
  await page.evaluate(() => window.updateNavFixturePath("/"));
  await expect(nav.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
  expect(errors.filter((error) => /hydration|hydrated|React error|early update/i.test(error))).toEqual([]);
});
