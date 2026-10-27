import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { portalUiBundle } from "../helpers/portalUiBundle";

const styles = ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css", "app/portal.css"].map((file) => readFileSync(file, "utf8")).join("\n");

async function mount(page: Page, screen: string, unavailable = false) {
  await page.evaluate(() => window.unmountPortalUi?.());
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await page.setContent('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  await page.addStyleTag({ content: styles });
  await page.addScriptTag({ content: portalUiBundle });
  await page.evaluate(({ screen, unavailable }) => {
    // about:blank is not a secure context; production HTTPS provides this API.
    if (!crypto.randomUUID) Object.defineProperty(crypto, "randomUUID", { value: () => "00000000-0000-4000-8000-000000000001" });
    Object.assign((window as unknown as { consumerBookingFixture: object }).consumerBookingFixture, { unavailablePackage: unavailable });
    window.mountPortalUi(screen);
  }, { screen, unavailable });
}

async function checkLayout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const overflow = await page.locator(".portal-consumer-focus-content *, .consumer-content-body *, .consumer-portal-footer *").evaluateAll((elements) => elements.filter((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.width > 0 && bounds.right > innerWidth + 1;
  }).map((element) => element.className));
  expect(overflow).toEqual([]);
}

test("booking history identifies the centre, package, dates, prices and response", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mount(page, "consumer-bookings");
  const cards = page.locator(".consumer-booking-row");
  await expect(cards).toHaveCount(3);
  await expect(cards.first().getByRole("heading")).toContainText("Ayursarga Mother and Baby");
  await expect(cards.first().locator(".consumer-booking-package")).toHaveText("14-day package");
  await expect(cards.first()).toContainText("Requested care dates");
  await expect(cards.first()).toContainText("₹24,000");
  await expect(cards.first()).toContainText("2 adult bystanders");
  await expect(cards.locator("dt").filter({ hasText: /^Booked on$/ })).toHaveCount(3);
  await expect(cards.nth(1)).toContainText("Scheduled care date");
  await expect(cards.getByText("Confirmed appointment", { exact: true })).toHaveCount(0);
  await expect(cards.nth(1)).toContainText("Your preferred care dates are available.");
  await expect(cards.first()).toContainText("appointment is not confirmed yet");
  await expect(cards.first()).toContainText("AYUR000000");
  await cards.first().getByText("Your request notes", { exact: true }).click();
  await expect(cards.first()).toContainText("Please confirm room accessibility.");
  await checkLayout(page);
  await page.screenshot({ path: testInfo.outputPath("booking-history.png"), fullPage: true });
  await cards.first().getByRole("button", { name: "Cancel booking" }).click();
  await expect(cards.first().locator(".portal-status")).toHaveText("cancelled");
  await expect(cards.first().getByRole("button")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("request summary and mandatory consent remain usable at every size", async ({ page }, testInfo) => {
  await mount(page, "consumer-request");
  const summary = page.getByRole("region", { name: "Selected centre and package" });
  await expect(summary).toContainText("Ayursarga Mother and Baby");
  await expect(summary).toContainText("14-day package");
  await expect(summary).toContainText("₹24,000");
  await summary.getByText("View included procedures", { exact: true }).click();
  await expect(summary).toContainText("Head Massage");
  await expect(summary).toContainText("3 days");
  const submit = page.getByRole("button", { name: "Book Appointment", exact: true });
  await expect(submit).toBeDisabled();
  await expect(page.locator('[name="endDate"]')).toHaveCount(0);
  await page.locator('[name="bookingTerms"]').check();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator('[name="date"]')).toHaveAttribute("aria-invalid", "true");
  await page.locator('[name="date"]').fill("2099-10-25");
  await page.locator('[name="bookingTerms"]').uncheck();
  await expect(submit).toBeDisabled();
  await page.locator('[name="bookingTerms"]').check();
  await checkLayout(page);
  await page.screenshot({ path: testInfo.outputPath("booking-request.png"), fullPage: true });
  await submit.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { consumerBookingFixture: { navigatedTo: string } }).consumerBookingFixture.navigatedTo)).toBe("/app/bookings?booking=booking-0");
  expect(await page.evaluate(() => (window as unknown as { consumerBookingFixture: { bookingInputs: { expectedPackageVersion?: string }[] } }).consumerBookingFixture.bookingInputs.at(-1)?.expectedPackageVersion)).toBe("a".repeat(64));
});

test("sold-out booking dates disable submission but other dates remain bookable", async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { bookingSoldOut: boolean }).bookingSoldOut = true; });
  // The fixture stays on about:blank, so set this before the actual component mounts.
  await page.evaluate(() => { (window as unknown as { bookingSoldOut: boolean }).bookingSoldOut = true; });
  await mount(page, "consumer-request");
  const submit = page.getByRole("button", { name: "Book Appointment", exact: true });
  await expect(submit).toBeDisabled();
  await page.locator('[name="bookingTerms"]').check();
  await expect(submit).toBeEnabled();
  await page.locator('[name="date"]').fill("2099-10-25");
  await expect(submit).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("Sold Out");
  await page.locator('[name="date"]').fill("2099-10-26");
  await expect(submit).toBeEnabled();
});

test("search start or EDD date prefills booking and legacy end dates are not editable", async ({ page }) => {
  await mount(page, "consumer-request-prefilled");
  await expect(page.getByRole("textbox", { name: "Preferred start date / Expected Delivery Date", exact: true })).toHaveValue("25/10/2099");
  await expect(page.locator('[name="date"]')).toHaveValue("2099-10-25");
  await expect(page.locator('[name="endDate"]')).toHaveCount(0);
  const submit = page.getByRole("button", { name: "Book Appointment", exact: true });
  await expect(submit).toBeDisabled();
  await page.locator('[name="bookingTerms"]').check();
  await expect(submit).toBeEnabled();
  await page.locator('[name="bookingTerms"]').uncheck();
  await expect(submit).toBeDisabled();
  await checkLayout(page);
});

test("unavailable packages cannot be submitted", async ({ page }) => {
  await mount(page, "consumer-request", true);
  await expect(page.getByRole("button", { name: "Book Appointment", exact: true })).toBeDisabled();
  await expect(page.locator(".portal-form-error")).toContainText("no longer available");
  await checkLayout(page);
});

test("new automatically confirmed bookings display consistently without hospital approval", async ({ page }) => {
  for (const role of ["consumer", "hospital", "admin"]) {
    await mount(page, `${role}-auto-confirmed`);
    const card = page.locator(role === "consumer" ? ".consumer-booking-row" : ".operational-booking-card");
    await expect(card).toHaveCount(1);
    await expect(card.locator(".portal-status")).toHaveText(/confirmed/i);
    await expect(card).toContainText("Booked on");
    await expect(card).not.toContainText("Confirmed appointment");
    await expect(card).not.toContainText("awaiting");
    await expect(card.getByRole("button", { name: "Confirm", exact: true })).toHaveCount(0);
    if (role === "consumer") {
      await expect(card).toContainText("Your booking is confirmed.");
      await expect(card.getByRole("button", { name: "Cancel booking", exact: true })).toBeEnabled();
    }
    if (role === "hospital") {
      await expect(card.getByRole("button", { name: "Start treatment", exact: true })).toBeEnabled();
      await expect(card.getByRole("button", { name: "Reschedule", exact: true })).toHaveCount(0);
    }
    await checkLayout(page);
  }
});

test("consumer treatment timeline follows Hospital start and completion without a separate ongoing action", async ({ page }) => {
  await mount(page, "consumer-auto-confirmed");
  const timeline = page.locator(".portal-treatment-trail");
  const checkStage = async (index: number, label: string) => {
    await expect(timeline).toHaveAttribute("aria-label", `Treatment progress: ${label}`);
    await expect(timeline.locator('[aria-current="step"]')).toHaveText(label);
    await expect(timeline.locator('.portal-treatment-dot[data-active="true"]')).toHaveCount(1);
    await expect(timeline.locator('.portal-treatment-step').nth(index).locator('.portal-treatment-dot')).toHaveAttribute("data-active", "true");
    await expect(page.getByText(`Treatment: ${label}`, { exact: true })).toBeVisible();
    const dots = await timeline.locator(".portal-treatment-dot").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
    expect(Math.max(...dots) - Math.min(...dots)).toBeLessThanOrEqual(1);
    await checkLayout(page);
  };
  const switchPortal = async (screen: string) => page.evaluate((name) => {
    window.unmountPortalUi?.();
    window.mountPortalUi(name);
  }, screen);
  await checkStage(0, "Yet to be started");
  await switchPortal("hospital-auto-confirmed");
  await page.getByRole("button", { name: "Start treatment", exact: true }).click();
  await expect(page.locator(".portal-status")).toHaveText("Treatment Started");
  await expect(page.getByRole("button", { name: "Mark ongoing", exact: true })).toHaveCount(0);
  await switchPortal("consumer-auto-confirmed");
  await checkStage(1, "Ongoing");
  await switchPortal("hospital-auto-confirmed");
  await page.getByRole("button", { name: "Complete treatment", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Complete treatment", exact: true }).click();
  await expect(page.locator(".portal-status")).toHaveText("Treatment completed");
  await switchPortal("consumer-auto-confirmed");
  await checkStage(2, "Completed");
  await expect(timeline.locator('.portal-treatment-dot[data-done="true"]')).toHaveCount(2);
});

test("one canonical reference identifies the selected booking in every portal", async ({ page }) => {
  for (const role of ["consumer", "hospital", "admin"]) {
    await mount(page, `${role}-booking-detail`);
    const reference = page.locator(".consumer-booking-reference");
    await expect(reference).toHaveCount(1);
    await expect(reference).toContainText("AYUR000001");
    await expect(page.getByRole("link", { name: "View all bookings", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("admin and hospital bookings have clear labeled summaries and role-specific amounts", async ({ page }) => {
  for (const role of ["admin", "hospital"]) {
    await mount(page, `${role}-bookings`);
    const cards = page.locator(".operational-booking-card");
    await expect(cards).toHaveCount(3);
    const card = cards.first();
    await expect(card.locator("h3")).toContainText("Ayursarga Mother and Baby");
    await expect(card.locator(".consumer-booking-package")).toHaveText("14-day package");
    await expect(card.locator("dt")).toContainText(["Customer", "Phone", "Email", "Requested care dates", "Accompanying", "Customer address"]);
    await expect(card.locator(".consumer-booking-cost").first()).toContainText("Package amount");
    await expect(card).not.toContainText("Hospital centre");
    await expect(card.getByText("Estimated commission", { exact: true })).toHaveCount(role === "admin" ? 1 : 0);
    if (role === "hospital") {
      await card.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("admin and hospital bell panels confirm clearing, lock scrolling and keep bookings", async ({ page }) => {
  for (const role of ["admin", "hospital"]) {
    await mount(page, `${role}-bookings`);
    await page.getByRole("button", { name: /Notifications/ }).click();
    const panel = page.getByRole("region", { name: "Recent notifications" });
    await expect(panel).toContainText("AYUR000000");
    await expect(panel.getByRole("link")).toHaveAttribute("href", `/${role}/bookings?booking=booking-0`);
    await panel.getByRole("button", { name: "Clear", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(panel).toContainText("AYUR000000");
    await panel.getByRole("button", { name: "Clear", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Clear notifications", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await expect(panel).toContainText("No notifications yet.");
    await expect(page.locator(".portal-list")).toContainText("AYUR000000");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("consumer workspace has role-specific navigation, account menu and compact footer", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const screen of ["consumer-bookings", "consumer-profile", "consumer-support"]) {
    await mount(page, screen);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const isCompact = await page.evaluate(() => matchMedia("(max-width:1023px), (max-height:500px) and (pointer:coarse)").matches);
    const navigation = page.getByRole("navigation", { name: isCompact ? "Consumer mobile navigation" : "consumer navigation", exact: true });
    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole("link")).toHaveCount(4);
    await expect(navigation.getByRole("link", { name: "Search hospitals", exact: true })).toHaveAttribute("href", "/centers");
    const activeLabel = screen === "consumer-bookings" ? "My bookings" : screen === "consumer-profile" ? "My profile" : "Help & support";
    await expect(navigation.getByRole("link", { name: activeLabel, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".portal-notification-trigger")).toHaveCount(0);
    const footer = page.locator(".consumer-portal-footer");
    await expect(footer).toHaveCount(1);
    await expect(footer).toContainText("Privacy policy");
    await expect(footer).toContainText("Terms & conditions");
    await expect(footer).not.toContainText("For hospitals");
    await page.getByRole("button", { name: "Open account menu", exact: true }).click();
    const accountMenu = page.locator(".portal-header-account-menu");
    await expect(accountMenu).toBeVisible();
    await expect(accountMenu).toContainText("hospital.contact.with.long.address@example.com");
    await expect(accountMenu.getByRole("button", { name: "Logout", exact: true })).toBeVisible();
    const bounds = await accountMenu.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    await page.keyboard.press("Escape");
    await expect(accountMenu).toHaveCount(0);
    await checkLayout(page);
    if (screen === "consumer-profile") {
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await expect(page.locator(".portal-toast")).toContainText("Your profile has been saved.");
    }
    if (screen === "consumer-bookings") await page.screenshot({ path: testInfo.outputPath("consumer-workspace.png"), fullPage: true });
  }
  expect(errors).toEqual([]);
});
