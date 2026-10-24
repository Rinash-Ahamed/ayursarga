import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { portalUiBundle } from "../helpers/portalUiBundle";
import { authEmail } from "../../lib/authEmail";
const styles = ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css", "app/portal.css"].map((file) => readFileSync(file, "utf8")).join("\n");
const screens = ["admin-dashboard", "admin-hospitals", "admin-details", "admin-consultants", "admin-users", "admin-bookings", "admin-availability", "admin-audits", "hospital-dashboard", "hospital-profile", "hospital-services", "hospital-bookings", "hospital-availability", "hospital-password", "admin-login", "hospital-login", "admin-forgot", "hospital-forgot"];
async function mount(page: Page, screen: string) {
  const pageErrors: string[] = [];
  const recordPageError = (error: Error) => pageErrors.push(error.message);
  page.on("pageerror", recordPageError);
  await page.evaluate(() => window.unmountPortalUi?.());
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture-root"></div></body></html>');
  await page.addStyleTag({ content: styles });
  await page.addScriptTag({ content: portalUiBundle });
  // about:blank lacks the secure-context UUID API provided by production HTTPS.
  await page.evaluate(() => { if (!crypto.randomUUID) Object.defineProperty(crypto, "randomUUID", { value: () => "00000000-0000-4000-8000-000000000001" }); });
  await page.evaluate((name) => window.mountPortalUi(name), screen);
  try {
    await expect(page.locator("h1")).toBeVisible();
  } catch (error) {
    if (pageErrors.length > 0) throw new Error(`Portal fixture ${screen} failed: ${pageErrors.join(" | ")}`, { cause: error });
    throw error;
  } finally {
    page.off("pageerror", recordPageError);
  }
  await page.waitForTimeout(120);
}
test("online consultation form uses assigned charges and custom windows, requires consent and submits once", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "consumer-consultation-new");
  const submit = page.getByRole("button", { name: "Request appointment", exact: true });
  await expect(submit).toBeDisabled();
  await page.getByRole("radio", { name: /Assigned Consultation Professional/ }).check();
  const providerCard = await page.locator(".consultation-professional").boundingBox();
  expect(providerCard!.height).toBeLessThan(350);
  expect((await page.locator(".consultation-professional>span").boundingBox())!.width).toBeGreaterThan(90);
  expect((await page.getByRole("radio", { name: /Assigned Consultation Professional/ }).boundingBox())!.width).toBeLessThan(25);
  await page.getByRole("textbox", { name: "Preferred appointment date *", exact: true }).fill("25/10/2099");
  await expect(page.getByRole("option", { name: /Morning: 9:30 AM/ })).toContainText("11:45 AM");
  await page.getByRole("combobox", { name: "Preferred time window *", exact: true }).selectOption("morning");
  await expect(submit).toBeDisabled();
  await page.getByRole("checkbox", { name: "I have read and agree to the applicable terms and policies.", exact: true }).check();
  await expect(submit).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("online-consultation-form.png"), fullPage: true });
  await page.locator("form").evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit(); });
  const writes = await page.evaluate(() => (window as unknown as { consumerBookingFixture: { consultantWrites: object[]; navigatedTo: string } }).consumerBookingFixture);
  expect(writes.consultantWrites).toHaveLength(1);
  expect(writes.consultantWrites[0]).toMatchObject({ consultantId: "AS001", serviceId: "prenatal-doctor", preferredDate: "2099-10-25", preferredTimeSlot: "morning", bookingTermsAccepted: true });
  expect(writes.navigatedTo).toBe("/app/bookings/consultations?booking=consultation-fixture");
  expect(errors).toEqual([]);
});

test("online consultation empty state is clear and does not show an unusable form", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "consumer-consultation-empty");
  await expect(page.getByRole("heading", { name: "Consultants are not available yet" })).toBeVisible();
  await expect(page.getByText("No professionals are currently assigned to prenatal doctor consultation.", { exact: false })).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Preferred appointment date *", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check availability again" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("online consultant availability refreshes when the Consumer returns to the page", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "consumer-consultation-refresh");
  await expect(page.getByRole("heading", { name: "Consultants are not available yet" })).toBeVisible();
  await page.waitForTimeout(1_550);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("Assigned Consultation Professional", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Consultants are not available yet" })).toHaveCount(0);
});

test("consumer online consultation history uses the aligned empty-state pattern", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "consumer-consultations-empty");
  await expect(page.getByText("Preferred time windows are requests.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No online consultations yet" })).toBeVisible();
  await expect(page.getByText("Appointments requested through Wellness Path", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "My hospital bookings" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("consumer hospital bookings use a meaningful empty-state heading", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "consumer-bookings-empty");
  await expect(page.getByRole("heading", { name: "No hospital bookings yet" })).toBeVisible();
  await expect(page.getByText("Bookings placed through Search hospitals", { exact: false })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Consumer booking navigation" })
      .getByRole("link", { name: "Search hospitals" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("Admin operational lists use clear, aligned empty states", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  const cases = [
    ["admin-hospitals-empty", "No hospitals yet"],
    ["admin-consultants-empty", "No consultants yet"],
    ["admin-users-empty", "No consumer users yet"],
    ["admin-bookings-empty", "No hospital bookings yet"],
    ["admin-availability-empty", "No availability activity yet"],
    ["admin-audits-empty", "No audit activity yet"],
  ] as const;
  for (const [screen, heading] of cases) {
    await mount(page, screen);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test("Hospital operational lists use clear, aligned empty states", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  const cases = [
    ["hospital-services-empty", "No packages yet"],
    ["hospital-bookings-empty", "No patient bookings yet"],
    ["hospital-availability-empty", "No availability requests yet"],
  ] as const;
  for (const [screen, heading] of cases) {
    await mount(page, screen);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test("booking detail navigation stays separate from booking content", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  for (const screen of ["admin-booking-detail", "hospital-booking-detail"] as const) {
    await mount(page, screen);
    const navigation = page.getByRole("navigation", { name: screen.startsWith("admin") ? "Booking categories" : "Booking navigation" });
    await expect(navigation.getByRole("link", { name: "View all bookings" })).toBeVisible();
    await expect(page.getByText(/^Showing\s+\d+\s+booking/)).toHaveCount(0);
    const navigationBox = await navigation.boundingBox();
    const bookingBox = await page.locator(".consumer-booking-row").first().boundingBox();
    expect(navigationBox!.y + navigationBox!.height).toBeLessThanOrEqual(bookingBox!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test("online consultation history confirms with a locked shared dialog and Consumer sees no Admin controls", async ({ page }, testInfo) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-consultations");
  await expect(page.getByText("Assigned Consultation Professional", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Confirm appointment", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { consumerBookingFixture: { consultantWrites: object[] } }).consumerBookingFixture.consultantWrites.length)).toBe(0);
  await page.getByRole("button", { name: "Confirm appointment", exact: true }).click();
  await dialog.locator('input[type="time"]').fill("10:15");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("25/10/2099 · 10:15", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("online-consultation-history.png"), fullPage: true });
  await mount(page, "consumer-consultations");
  await expect(page.getByRole("button", { name: "Confirm appointment", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel appointment", exact: true })).toBeVisible();
});

test("Admin online consultations match booking cards and provide responsive filters", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-consultations");
  await expect(page.getByRole("region", { name: "Online consultation filters" })).toBeVisible();
  await expect(page.locator(".operational-booking-card")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Online consultation filters" }).getByRole("status", { name: "Showing 1 online consultation" })).toBeVisible();
  await expect(page.getByText("Booking ID: AYURCONS01", { exact: true })).toBeVisible();
  await expect(page.getByText("Consultation charge", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search consultations" }).fill("no matching person");
  await expect(page.getByRole("heading", { name: "No matching online consultations" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText("Booking ID: AYURCONS01", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Status" }).selectOption("completed");
  await expect(page.getByRole("heading", { name: "No matching online consultations" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("authentication emails share a responsive Ayursarga theme with readable reset and invitation links", async ({ page }, testInfo) => {
  for (const kind of ["hospital-invitation", "password-reset"] as const) {
    const message = authEmail({ kind, name: "Ayursarga Hospital Partner with a Longer Centre Name", actionUrl: "https://test-project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=local-test-placeholder-not-a-real-token" });
    await page.setContent(message.html);
    const button = page.getByRole("link", { name: kind === "hospital-invitation" ? "Set your password" : "Reset your password", exact: true });
    await expect(button).toBeVisible();
    await expect(button).toHaveCSS("background-color", "rgb(31, 61, 43)");
    await expect(button).toHaveAttribute("href", /firebaseapp\.com\/__\/auth\/action/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${kind}.png`), fullPage: true });
  }
});

test("portal password reset submits once and shows a generic acknowledgement for both roles", async ({ page }) => {
  for (const role of ["admin", "hospital"]) {
    await mount(page, `${role}-forgot`);
    const emailInput = page.getByRole("textbox", { name: "Email address" });
    if (role === "admin") {
      await expect(emailInput).toHaveCount(0);
      await expect(page.getByText("info@ayursarga.com", { exact: true })).toBeVisible();
    } else {
      await emailInput.fill("partner@example.com");
    }
    await page.locator("form").evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit(); });
    await expect(page.getByRole("status")).toContainText("Reset request accepted");
    await expect(page.getByText("If an eligible account exists, you will receive a password reset email. Check your inbox and spam folder.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { consumerBookingFixture: { calls: number } }).consumerBookingFixture.calls)).toBe(1);
    await expect(page.getByRole("link", { name: "Return to login" })).toHaveAttribute("href", `/${role}/login`);
    await expect(page.locator("form")).toHaveCount(0);
    await page.waitForTimeout(200);
    await expect(page.locator(".portal-auth-confirmation")).toBeVisible();
  }
});

test("branded reset and invitation links validate passwords and return to the correct login", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html><body></body></html>" }));
  for (const [role, kind] of [["admin", "reset"], ["hospital", "reset"], ["hospital", "invite"]]) {
    await page.goto(`https://ayursarga.test/auth/reset-password#oobCode=valid-test-code&role=${role}&kind=${kind}`);
    await mount(page, "password-action");
    await expect(page.getByRole("heading", { name: kind === "invite" ? "Set your password" : "Reset your password" })).toBeVisible();
    await page.getByLabel("New password", { exact: true }).fill("Test-password1");
    await page.getByLabel("Confirm password", { exact: true }).fill("Mismatch-password1");
    await page.locator("form").evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.getByRole("alert")).toContainText("passwords do not match");
    await page.getByLabel("Confirm password", { exact: true }).fill("Test-password1");
    await page.locator("form").evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit(); });
    await expect(page.getByRole("status")).toContainText("Password saved successfully");
    await expect(page.locator("form")).toHaveCount(0);
    expect(await page.evaluate(() => location.hash)).toBe("");
    expect(await page.evaluate(() => (window as unknown as { consumerBookingFixture: { calls: number } }).consumerBookingFixture.calls)).toBe(1);
    await expect(page.getByRole("link", { name: /Return to .* login/ })).toHaveAttribute("href", `/${role}/login`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.goto("https://ayursarga.test/auth/reset-password#oobCode=expired&role=hospital");
  await mount(page, "password-action");
  await expect(page.getByRole("alert")).toContainText("invalid, expired or already used");
  await expect(page.locator("form")).toHaveCount(0);
});

test("portal login prevents duplicate submission and keeps credential errors inline", async ({ page }) => {
  for (const role of ["hospital", "admin"]) {
    await mount(page, `${role}-login`);
    await page.getByRole("textbox", { name: "Email address" }).fill("partner@example.com");
    await page.getByLabel("Password", { exact: true }).fill("invalid-test-password1");
    await page.locator("form").evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit(); });
    await expect(page.locator("form [role='alert']")).toHaveText("The email address or password is incorrect.");
    expect(await page.evaluate(() => (window as unknown as { consumerBookingFixture: { calls: number } }).consumerBookingFixture.calls)).toBe(1);
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test("Admin billing previews and issues a branded commission invoice with a working PDF download", async ({ page }, testInfo) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-billing");
  await page.getByRole("button", { name: "New commission invoice", exact: true }).click();
  await page.getByRole("searchbox", { name: "Hospital *", exact: true }).fill("Ayursarga");
  await page.locator(".billing-hospital-results button").first().click();
  await page.getByRole("spinbutton", { name: "Commission amount (₹) *", exact: true }).fill("1000");
  await page.getByRole("spinbutton", { name: "GST rate (%) *", exact: true }).fill("18");
  await page.getByRole("button", { name: "Preview invoice", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
  const invoice = page.frameLocator('iframe[title="Ayursarga commission invoice preview"]');
  await expect(invoice.getByRole("heading", { name: "Commission Invoice", exact: true })).toBeVisible();
  await expect(invoice.locator(".invoice-total")).toContainText("1,180.00");
  expect(await page.evaluate(() => (window as unknown as { consumerBookingFixture: { calls: number } }).consumerBookingFixture.calls)).toBe(0);
  await dialog.getByRole("button", { name: "Generate invoice", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Download PDF", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { consumerBookingFixture: { calls: number } }).consumerBookingFixture.calls)).toBe(1);
  await page.screenshot({ path: testInfo.outputPath("commission-invoice.png") });
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download PDF", exact: true }).click();
  const pdf = await download;
  expect(pdf.suggestedFilename()).toMatch(/^AS-2026-00001-\d{4}-\d{2}-\d{2}\.pdf$/);
  const pdfPath = await pdf.path();
  const contents = readFileSync(pdfPath!, "utf8");
  expect(contents.startsWith("%PDF-1.4")).toBe(true);
  expect(contents).toContain("COMMISSION INVOICE");
  expect(contents).toContain("32ABGCA7749G1ZL");
  expect(contents).toContain("1,180.00");
  await dialog.getByRole("button", { name: "Close invoice preview", exact: true }).click();
  expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(page.locator(".billing-invoice-card")).toContainText("AS/2026/00001");
});

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
  await page.getByRole("checkbox", { name: "Prenatal doctor consultation", exact: true }).check();
  await expect(page.getByRole("group", { name: "Preferred days", exact: true }).getByRole("checkbox")).toHaveCount(7);
  await page.getByRole("checkbox", { name: "Mon", exact: true }).check();
  await page.getByRole("checkbox", { name: "Wed", exact: true }).check();
  await page.getByRole("checkbox", { name: "Sun", exact: true }).check();
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
  expect(writes[0]).toMatchObject({ designation: "Ayurvedic Doctor", consultantCharge: 900.5, consultationServices: ["prenatal-doctor"], preferredTimeSlots: ["morning", "evening"], preferredSlotTimings: { morning: { startTime: "09:30", endTime: "11:45" }, evening: { startTime: "15:00", endTime: "18:00" } } });
  expect(writes[0]).toMatchObject({ preferredDays: ["mon", "wed", "sun"] });
  await expect(page.locator(".consultant-details")).toContainText("Mon · Wed · Sun");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: /Consultant Charge/ })).toHaveValue("900.5");
  await expect(page.getByRole("checkbox", { name: "Prenatal doctor consultation", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Morning", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Mon", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Sun", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Tue", exact: true })).not.toBeChecked();
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
    if (screen === "admin-audits") {
      const password = dialog.getByLabel("Admin password", { exact: true });
      await expect(password).toHaveAttribute("type", "password");
      const passwordBounds = await password.boundingBox();
      expect(passwordBounds!.width).toBeGreaterThan(bounds!.width * 0.75);
      await password.fill("temporary-test-value");
      await dialog.getByRole("button", { name: "Show admin password", exact: true }).click();
      await expect(password).toHaveAttribute("type", "text");
      await dialog.getByRole("button", { name: "Hide admin password", exact: true }).click();
      await expect(password).toHaveAttribute("type", "password");
    }
    await cancel.click();
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
    if (screen === "admin-audits") {
      await page.getByRole("button", { name: trigger, exact: true }).first().click();
      const reopenedPassword = page.getByRole("dialog").getByLabel("Admin password", { exact: true });
      await expect(reopenedPassword).toHaveAttribute("type", "password");
      await expect(reopenedPassword).toHaveValue("");
      await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    }
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
