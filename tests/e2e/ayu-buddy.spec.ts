import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { bundleDialogHarness } from "../helpers/bundleDialogHarness";

const overrides = {
  "next/link": "tests/fixtures/centreSearchMocks.tsx", "next/image": "tests/fixtures/portalUiMocks.tsx",
};
const bundle = bundleDialogHarness("tests/fixtures/ayuBuddyHarness.tsx", overrides, { NEXT_PUBLIC_AYU_ONLINE: "true", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "synthetic-site-key" });
const disabledBundle = bundleDialogHarness("tests/fixtures/ayuBuddyHarness.tsx", overrides, { NEXT_PUBLIC_AYU_ONLINE: "false" });
const contactBundle = bundleDialogHarness("tests/fixtures/contactHarness.tsx", {
  "./Reveal": "tests/fixtures/contactMotionMocks.tsx", "./MagneticButton": "tests/fixtures/contactMotionMocks.tsx",
}, { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "synthetic-site-key" });
const photo = readFileSync("public/ayu-buddy.webp");

async function mount(page: Page, enabled = true, contact = false) {
  // Mock the provider script, never solve real challenges or send email in tests.
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", (route) => route.fulfill({ contentType: "application/javascript", body: `
    window.verificationWidgets = []; window.verificationLoads = (window.verificationLoads || 0) + 1;
    window.turnstile = {
      render(element, options) {
        const id = String(window.verificationWidgets.length);
        const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Complete test verification';
        button.onclick = () => options.callback('synthetic-token-' + id);
        element.appendChild(button);
        window.verificationWidgets.push({element, options});
        if (!window.holdVerification) setTimeout(() => options.callback('synthetic-token-' + id), 20);
        return id;
      },
      remove(id) { const widget = window.verificationWidgets[Number(id)]; if (widget) widget.element.replaceChildren(); }
    };
  ` }));
  await page.route("https://ayu.test/**", (route) => route.request().url().endsWith("ayu-buddy.webp")
    ? route.fulfill({ contentType: "image/webp", body: photo })
    : route.fulfill({ contentType: "text/html", body: '<html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main style="height:2500px"><h1>Ayursarga</h1><button>Background control</button></main><div id="fixture-root"></div><div id="contact-root"></div></body></html>' }));
  await page.goto("https://ayu.test/");
  for (const file of ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css"]) await page.addStyleTag({ content: readFileSync(file, "utf8") });
  await page.addScriptTag({ content: contact ? contactBundle : enabled ? bundle : disabledBundle });
}
async function openForm(page: Page) {
  await page.getByRole("button", { name: "Ask Ayu, your Ayursarga guide" }).click();
  await page.getByRole("button", { name: "Send a question to our team" }).click();
  await page.getByLabel("Your name *", { exact: true }).fill("Test Visitor");
  await page.getByLabel("Email address *", { exact: true }).fill("visitor@gmail.com");
  await page.getByLabel("Phone number *", { exact: true }).fill("9876543210");
  await page.getByLabel("Your question *", { exact: true }).fill("How can I compare two hospitals?");
  await page.locator(".enquiry-verification").scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Send to Ayursarga", exact: true })).toBeEnabled();
}

test("Ayu offers curated guidance with a viewport-safe, scroll-locked keyboard-accessible dialog", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mount(page);
  await page.evaluate(() => scrollTo({ top: 500, behavior: "instant" }));
  const launcher = page.getByRole("button", { name: "Ask Ayu, your Ayursarga guide" });
  await expect(launcher).toBeVisible();
  expect(await page.evaluate(() => (globalThis as typeof globalThis & { fixtureLazyLoads?: number }).fixtureLazyLoads ?? 0)).toBe(0);
  for (let round = 0; round < 2; round++) {
    await launcher.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Your little buddy for natural wellness");
    await expect(dialog).toContainText("not a live agent or medical adviser");
    expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
    await page.getByRole("button", { name: "Find the right care", exact: true }).click();
    await expect(dialog.getByRole("link", { name: /Search hospitals/ })).toHaveAttribute("href", "/centers");
    await expect(dialog.locator(".ayu-buddy-answer a")).toHaveText("Search hospitals");
    await expect(dialog.locator(".ayu-buddy-answer a")).toHaveCSS("text-decoration-line", "none");
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    if (!round) await page.screenshot({ path: info.outputPath("ayu-guide.png") });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
    expect(Math.abs(await page.evaluate(() => scrollY) - 500)).toBeLessThanOrEqual(1);
    await expect(launcher).toBeFocused();
  }
  expect(errors).toEqual([]);
  // One deferred dialog, reused from React's module cache on the second open.
  expect(await page.evaluate(() => (globalThis as typeof globalThis & { fixtureLazyLoads?: number }).fixtureLazyLoads)).toBe(1);
});

test("AYU_ONLINE=false renders nothing and loads no mascot, dialog or enquiry requests", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await mount(page, false);
  await page.getByRole("heading", { name: "Ayursarga", exact: true }).waitFor();
  await expect(page.getByRole("button", { name: "Ask Ayu, your Ayursarga guide" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(requests.filter((url) => /ayu-buddy\.webp|\/api\/contact/.test(url))).toEqual([]);
  expect(await page.evaluate(() => (globalThis as typeof globalThis & { fixtureLazyLoads?: number }).fixtureLazyLoads ?? 0)).toBe(0);
  expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
});

test("a failed helper chunk does not break or lock the website", async ({ page }) => {
  await mount(page);
  await page.evaluate(() => { (globalThis as typeof globalThis & { fixtureLazyFailure?: boolean }).fixtureLazyFailure = true; });
  await page.getByRole("button", { name: "Ask Ayu, your Ayursarga guide" }).click();
  await expect(page.getByRole("alert")).toContainText("Ayu is unavailable");
  expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  await page.getByRole("button", { name: "Background control", exact: true }).click();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("questions submit once through the existing email API and never claim success before acknowledgement", async ({ page }) => {
  await mount(page);
  const payloads: Record<string, string>[] = [];
  let complete!: () => void;
  const gate = new Promise<void>((resolve) => { complete = resolve; });
  await page.route("https://ayu.test/api/contact", async (route) => {
    expect((await route.request().allHeaders()).origin).toBe("https://ayu.test");
    payloads.push(route.request().postDataJSON());
    await gate;
    await route.fulfill({ json: { ok: true } });
  });
  await openForm(page);
  const dialog = page.getByRole("dialog");
  await dialog.locator("form").evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit(); });
  await expect.poll(() => payloads.length).toBe(1);
  await expect(page.getByRole("button", { name: "Close Ayu" })).toBeDisabled();
  await expect(page.getByText("Your question has been submitted.", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect(payloads[0].interest).toBe("I need personal guidance");
  expect(payloads[0].guidanceProfile).toContain("Ayu");
  expect(payloads[0].email).toBe("visitor@gmail.com");
  expect(payloads[0].source).toBe("ayu");
  expect(payloads[0].turnstileToken).toMatch(/^synthetic-token-/);
  complete();
  await expect(dialog.getByRole("status")).toContainText("Your question has been submitted.");
  await page.getByRole("button", { name: "Close Ayu" }).click();
  await page.getByRole("button", { name: "Ask Ayu, your Ayursarga guide" }).click();
  await expect(page.getByText("Your question has been submitted.", { exact: true })).toHaveCount(0);
  expect(payloads).toHaveLength(1);
});

test("email failures stay visible, retain the question and allow an explicit retry", async ({ page }) => {
  await mount(page);
  let requests = 0;
  await page.route("https://ayu.test/api/contact", (route) => {
    requests++;
    return requests === 1 ? route.fulfill({ status: 502, json: { error: "We could not send your request. Please try again." } }) : route.fulfill({ json: { ok: true } });
  });
  await openForm(page);
  await page.getByRole("button", { name: "Send to Ayursarga", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not send");
  await expect(page.getByLabel("Your question *", { exact: true })).toHaveValue("How can I compare two hospitals?");
  expect(requests).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const fonts = await page.locator('input:not(.hp-field),textarea').evaluateAll((elements) => elements.map((element) => parseFloat(getComputedStyle(element).fontSize)));
  expect(fonts.every((size) => size >= 16)).toBe(true);
  await page.getByRole("button", { name: "Send to Ayursarga", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Your question has been submitted.");
  expect(requests).toBe(2);
});

test("Ayu rejects scanner placeholders before sending and accepts corrected visitor details", async ({ page }) => {
  await mount(page);
  let requests = 0;
  await page.route("https://ayu.test/api/contact", (route) => { requests++; return route.fulfill({ json: { ok: true } }); });
  await openForm(page);
  await page.getByLabel("Email address *", { exact: true }).fill("zaproxy@example.com");
  await page.getByLabel("Phone number *", { exact: true }).fill("9999999999");
  await page.getByRole("button", { name: "Send to Ayursarga", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("real email address");
  expect(requests).toBe(0);
  await page.getByLabel("Email address *", { exact: true }).fill("visitor@gmail.com");
  await page.getByRole("button", { name: "Send to Ayursarga", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("repeated-digit placeholder");
  expect(requests).toBe(0);
  await page.getByLabel("Phone number *", { exact: true }).fill("9876543210");
  await page.getByRole("button", { name: "Send to Ayursarga", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Your question has been submitted.");
  expect(requests).toBe(1);
});

test("Ayu loads verification only for enquiries, blocks expired tokens and obtains a new token after rejection", async ({ page }) => {
  await mount(page);
  const requests: Record<string, string>[] = [];
  await page.route("https://ayu.test/api/contact", (route) => { requests.push(route.request().postDataJSON()); return route.fulfill({ status: 400, json: { error: "Please complete the security verification again before sending." } }); });
  await page.getByRole("button", { name: "Ask Ayu, your Ayursarga guide" }).click();
  expect(await page.evaluate(() => document.querySelectorAll('script[src*="challenges.cloudflare.com"]').length)).toBe(0);
  await page.getByRole("button", { name: "Close Ayu" }).click();
  await openForm(page);
  await page.evaluate(() => {
    const state = window as unknown as { holdVerification: boolean; verificationWidgets: { options: Record<string, () => void> }[] };
    state.holdVerification = true;
    state.verificationWidgets.at(-1)!.options["expired-callback"]();
  });
  const submit = page.getByRole("button", { name: "Send to Ayursarga", exact: true });
  await expect(submit).toBeDisabled();
  await page.locator("form").evaluate((form: HTMLFormElement) => form.requestSubmit());
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "Complete test verification" }).click();
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("verification again");
  await expect(submit).toBeDisabled();
  await expect(page.getByLabel("Your question *", { exact: true })).toHaveValue("How can I compare two hospitals?");
  await page.getByRole("button", { name: "Complete test verification" }).click();
  await submit.click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[0].turnstileToken).not.toBe(requests[1].turnstileToken);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("blocked provider script keeps Ayu usable and offers verification retry without sending", async ({ page }) => {
  await mount(page);
  let loads = 0, sends = 0;
  await page.route("https://challenges.cloudflare.com/**", (route) => { loads++; return route.abort(); });
  await page.route("https://ayu.test/api/contact", (route) => { sends++; return route.fulfill({ json: { ok: true } }); });
  await page.getByRole("button", { name: "Ask Ayu, your Ayursarga guide" }).click();
  await page.getByRole("button", { name: "Send a question to our team" }).click();
  await page.locator(".enquiry-verification").scrollIntoViewIfNeeded();
  await expect(page.getByRole("alert")).toContainText("Verification is unavailable");
  await expect(page.getByRole("button", { name: "Send to Ayursarga", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Retry verification" }).click();
  await expect.poll(() => loads).toBe(2);
  expect(sends).toBe(0);
  await page.getByRole("button", { name: "Close Ayu" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Contact defers verification below the fold, sends its token once and retains form data on failure", async ({ page }) => {
  await mount(page, true, true);
  expect(await page.evaluate(() => document.querySelectorAll('script[src*="challenges.cloudflare.com"]').length)).toBe(0);
  const form = page.locator(".contact-form");
  await page.getByLabel("Your name", { exact: true }).fill("Visitor Sample");
  await page.getByLabel("Phone number", { exact: true }).fill("9876543210");
  await page.getByLabel("Email address", { exact: true }).fill("visitor@gmail.com");
  await page.getByLabel("Care you are interested in").selectOption("I need personal guidance");
  await page.getByLabel("How can we help", { exact: true }).fill("Please help me find care.");
  await form.locator(".enquiry-verification").scrollIntoViewIfNeeded();
  const submit = page.getByRole("button", { name: "Request personal guidance", exact: true });
  await expect(submit).toBeEnabled();
  const payloads: Record<string, string>[] = [];
  await page.route("https://ayu.test/api/contact", (route) => { payloads.push(route.request().postDataJSON()); return route.fulfill({ status: 503, json: { error: "Security verification is unavailable. Please retry." } }); });
  await form.evaluate((element: HTMLFormElement) => { element.requestSubmit(); element.requestSubmit(); });
  await expect(page.getByRole("alert")).toContainText("Security verification is unavailable");
  expect(payloads).toHaveLength(1);
  expect(payloads[0].source).toBe("contact");
  expect(payloads[0].turnstileToken).toMatch(/^synthetic-token-/);
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue("visitor@gmail.com");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
