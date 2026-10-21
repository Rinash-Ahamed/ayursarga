import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { portalUiBundle } from "../helpers/portalUiBundle";
const styles = ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css", "app/portal.css"].map((file) => readFileSync(file, "utf8")).join("\n");
const screens = ["admin-dashboard", "admin-hospitals", "admin-details", "admin-consultants", "admin-users", "admin-bookings", "admin-availability", "admin-audits", "hospital-dashboard", "hospital-profile", "hospital-services", "hospital-bookings", "hospital-availability", "hospital-password", "admin-login", "hospital-login", "admin-forgot", "hospital-forgot"];
async function mount(page: Page, screen: string) {
  await page.evaluate(() => window.unmountPortalUi?.());
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  await page.addStyleTag({ content: styles });
  await page.addScriptTag({ content: portalUiBundle });
  await page.evaluate((name) => window.mountPortalUi(name), screen);
  await expect(page.locator("h1")).toBeVisible();
  await page.waitForTimeout(120);
}
test("availability review requires confirmation and prevents duplicate submissions", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-availability");
  const state = () => page.evaluate(() => (window as unknown as { consumerBookingFixture: { availabilityReviews: string[] } }).consumerBookingFixture.availabilityReviews);
  for (const action of ["approve", "reject"] as const) {
    const trigger = page.getByRole("button", { name: action === "approve" ? "Approve and block" : "Reject", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`Are you sure you want to ${action} this availability request?`);
    await expect(dialog.getByRole("button", { name: "Confirm", exact: true })).toHaveClass(action === "reject" ? /danger/ : /^portal-button$/);
    expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
    const bounds = await dialog.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(await state()).toEqual(action === "approve" ? [] : ["approve"]);
    expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
    await page.evaluate(() => { (window as unknown as { consumerBookingFixture: { holdAvailability: boolean } }).consumerBookingFixture.holdAvailability = true; });
    await trigger.click();
    await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Working...", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
    await page.keyboard.press("Enter");
    expect(await state()).toEqual(action === "approve" ? ["approve"] : ["approve", "reject"]);
    await page.evaluate(() => (window as unknown as { finishAvailabilityReview: () => void }).finishAvailabilityReview());
    await expect(dialog).toBeHidden();
  }
  await page.evaluate(() => { Object.assign((window as unknown as { consumerBookingFixture: object }).consumerBookingFixture, { holdAvailability: false, failAvailability: true }); });
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Availability review failed. Try again.");
  await expect(dialog.getByRole("button", { name: "Confirm", exact: true })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("hospital user cards show account details without raw hospital IDs", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-users");
  await page.getByRole("button", { name: "Hospitals", exact: true }).click();
  const card = page.locator(".portal-list .portal-row").first();
  await expect(card.locator("h3")).toContainText("Ayursarga");
  await expect(card).toContainText("hospital.contact.with.long.address@example.com");
  await expect(card).not.toContainText("Hospital centre");
  await expect(card.locator(".portal-status")).toHaveText("active");
  await expect(card.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
});

test("consultant designation and preferred availability edit legacy records safely", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-consultants");
  await expect(page.locator(".consultant-details").getByText("Not specified", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Designation" })).toHaveValue("");
  await page.getByRole("textbox", { name: "Designation" }).fill("Ayurvedic Doctor");
  const charge = page.getByRole("spinbutton", { name: /Consultant Charge/ });
  await expect(charge).toHaveValue("");
  await charge.fill("-1");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(charge).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Enter a valid non-negative charge with up to 2 decimal places.", { exact: true })).toBeVisible();
  await charge.fill("900.50");
  await page.getByRole("checkbox", { name: "Morning", exact: true }).check();
  await page.getByRole("checkbox", { name: "Evening", exact: true }).check();
  await page.locator('input[name="morningStartTime"]').fill("09:30");
  await page.locator('input[name="morningEndTime"]').fill("11:45");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Ayurvedic Doctor", { exact: true })).toBeVisible();
  await expect(page.locator(".consultant-details")).toContainText("₹900.50");
  await expect(page.getByText("Morning: 9:30 AM – 11:45 AM", { exact: true })).toBeVisible();
  await expect(page.getByText("Evening: 3:00 PM – 6:00 PM", { exact: true })).toBeVisible();
  const writes = await page.evaluate(() => (window as unknown as { consumerBookingFixture: { consultantWrites: { designation: string; preferredTimeSlots: string[] }[] } }).consumerBookingFixture.consultantWrites);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ designation: "Ayurvedic Doctor", consultantCharge: 900.5, preferredTimeSlots: ["morning", "evening"], preferredSlotTimings: { morning: { startTime: "09:30", endTime: "11:45" }, evening: { startTime: "15:00", endTime: "18:00" } } });
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: /Consultant Charge/ })).toHaveValue("900.5");
  await expect(page.getByRole("checkbox", { name: "Morning", exact: true })).toBeChecked();
  await expect(page.locator('input[name="morningStartTime"]')).toHaveValue("09:30");
  await expect(page.getByRole("checkbox", { name: "Noon", exact: true })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "Noon", exact: true }).check();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("Morning: 9:30 AM – 11:45 AM", { exact: true })).toBeVisible();
  await expect(page.getByText("Noon: 12:00 PM – 3:00 PM", { exact: true })).toHaveCount(0);
});

test("portal screens fit the viewport with representative long data", async ({ page }, testInfo) => {
  const findings: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  for (const screen of screens) {
    await mount(page, screen);
    const result = await page.evaluate(() => {
      const overflow = Array.from(document.querySelectorAll<HTMLElement>('.portal-content *, .portal-auth-shell *')).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > innerWidth + 1 && !el.closest('.portal-table-wrap, .portal-sidebar, .portal-contract-preview') && getComputedStyle(el).position !== 'absolute';
      }).slice(0, 5).map((el) => el.className || el.tagName);
      return { overflow, width: document.documentElement.scrollWidth, viewport: innerWidth };
    });
    if (result.width > result.viewport + 1 || result.overflow.length) findings.push(`${screen}: ${JSON.stringify(result)}`);
    const badActions = await page.locator(".portal-button").evaluateAll((buttons) => buttons.filter((button) => /^(delete|remove|deactivate|reject|make inactive|clear all audits)\b/i.test(button.textContent?.trim() ?? "") && !button.classList.contains("danger")).map((button) => button.textContent));
    expect(badActions, screen).toEqual([]);
    if (testInfo.project.use.hasTouch) {
      const smallInputs = await page.locator('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]),select,textarea').evaluateAll((elements) => elements.filter((element) => element.getClientRects().length && parseFloat(getComputedStyle(element).fontSize) < 16).map((element) => element.getAttribute("name")));
      expect(smallInputs, `${screen}: mobile input font`).toEqual([]);
    }
    if (["admin-details", "hospital-services", "admin-dashboard"].includes(screen)) await page.screenshot({ path: testInfo.outputPath(`${screen}.png`) });
  }
  console.log(`${testInfo.project.name}: ${findings.length} overflow findings`, findings);
  expect(errors).toEqual([]);
  expect(findings).toEqual([]);
});

test("destructive dialogs stay red, cancel stays neutral, and scroll is restored", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  for (const [screen, trigger] of [["admin-details", "Delete hospital"], ["hospital-services", "Delete"], ["hospital-profile", "Remove centre image 1"], ["admin-audits", "Clear all audits"]]) {
    await mount(page, screen);
    await page.getByRole("button", { name: trigger, exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
    const danger = dialog.locator(".portal-button.danger");
    await expect(danger).toHaveCSS("background-color", /rgb\((194, 65, 59|178, 59, 50)\)/);
    await expect(danger).toHaveCSS("color", "rgb(255, 255, 255)");
    const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
    await expect(cancel).toHaveCSS("background-color", /rgb\((255, 255, 255|237, 244, 239)\)/);
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    await cancel.click();
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  }
});

test("create and edit forms, validation feedback, and package actions keep their layout", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-hospitals");
  await page.getByRole("button", { name: "Add Hospital", exact: true }).click();
  await expect(page.locator("#add-hospital-form")).toBeVisible();
  await page.getByRole("button", { name: "Create hospital", exact: true }).click();
  await expect(page.locator(".portal-toast")).toBeVisible();
  const toast = await page.locator(".portal-toast").boundingBox();
  expect(toast!.y).toBeGreaterThanOrEqual(0);
  expect(toast!.y + toast!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#add-hospital-form")).toHaveCount(0);
  await mount(page, "hospital-services");
  await page.getByRole("button", { name: "Edit package", exact: true }).first().click();
  await expect(page.locator(".portal-service-edit")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCSS("background-color", "rgb(31, 61, 43)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".portal-service-edit")).toHaveCount(0);
});

test("mobile drawer locks scrolling, contains focus, and closes when rotating to desktop", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await page.setViewportSize({ width: 390, height: 844 });
  await mount(page, "hospital-services");
  await page.getByRole("button", { name: "Open portal menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Portal menu" });
  await expect(drawer).toBeVisible();
  expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
  await drawer.getByRole("button", { name: "Sign out" }).focus();
  await page.keyboard.press("Tab");
  expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await page.getByRole("button", { name: "Open portal menu" }).click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(drawer).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
});
