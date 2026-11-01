import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { portalUiBundle } from "../helpers/portalUiBundle";
import { authEmail } from "../../lib/authEmail";
import { getCalendarMonthRange } from "../../utils/date";
const styles = ["node_modules/tailwindcss/lib/css/preflight.css", "app/globals.css", "app/portal.css"].map((file) => readFileSync(file, "utf8")).join("\n");
const screens = ["admin-dashboard", "admin-hospitals", "admin-details", "admin-consultants", "admin-users", "admin-bookings", "admin-availability", "admin-audits", "hospital-dashboard", "hospital-profile", "hospital-services", "hospital-bookings", "hospital-availability", "hospital-password", "admin-login", "hospital-login", "admin-forgot", "hospital-forgot"];

test("Admin consultant and both booking lists use aligned responsive card grids", async ({ page }) => {
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  for (const screen of ["admin-consultants-duplicates", "admin-bookings", "admin-consultations-grid"]) {
    await mount(page, screen);
    const grid = page.locator(".admin-record-grid");
    const cards = grid.locator(":scope>article");
    await expect(cards.nth(1)).toBeVisible();
    const bounds = (await grid.boundingBox())!;
    const first = (await cards.nth(0).boundingBox())!;
    const second = (await cards.nth(1).boundingBox())!;
    if (bounds.width >= 734) {
      expect(Math.abs(first.y - second.y)).toBeLessThan(1);
      expect(Math.abs(first.height - second.height)).toBeLessThan(1);
      expect(second.x).toBeGreaterThanOrEqual(first.x + first.width + 13);
    } else {
      expect(Math.abs(first.x - second.x)).toBeLessThan(1);
      expect(second.y).toBeGreaterThanOrEqual(first.y + first.height + 13);
    }
    for (const card of await cards.all()) {
      expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      if (screen !== "admin-consultants-duplicates") {
        const cardBounds = (await card.boundingBox())!;
        const badgeBounds = (await card.locator(".portal-status").boundingBox())!;
        expect(badgeBounds.y - cardBounds.y).toBeLessThan(21);
        expect(cardBounds.x + cardBounds.width - badgeBounds.x - badgeBounds.width).toBeLessThan(21);
        const headingBounds = (await card.locator("h3").boundingBox())!;
        expect(badgeBounds.y + badgeBounds.height).toBeLessThanOrEqual(headingBounds.y);
      }
      if (screen === "admin-bookings") {
        const costs = card.locator(".consumer-booking-cost");
        expect(Math.abs((await costs.nth(0).boundingBox())!.y - (await costs.nth(1).boundingBox())!.y)).toBeLessThan(1);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await grid.screenshot({ path: test.info().outputPath(`${screen}-grid.png`) });
    if (screen === "admin-consultants-duplicates") {
      await cards.first().getByRole("button", { name: "Edit", exact: true }).click();
      const editing = grid.locator('[data-editing="true"]');
      expect((await editing.boundingBox())!.width).toBeCloseTo(bounds.width, 0);
      await expect(editing.locator('input[name="name"]')).toBeVisible();
      await editing.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(grid.locator('[data-editing="true"]')).toHaveCount(0);
    }
  }
});

test("Hospital booking and package grids reflow without overflow and retain full-width editing", async ({ page }) => {
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  for (const screen of ["hospital-bookings", "hospital-services"]) {
    await mount(page, screen);
    const grid = page.locator(".portal-record-grid");
    const cards = grid.locator(":scope>article");
    await expect(cards).toHaveCount(3);
    const bounds = (await grid.boundingBox())!;
    const first = (await cards.nth(0).boundingBox())!;
    const second = (await cards.nth(1).boundingBox())!;
    if (bounds.width >= 734) {
      expect(Math.abs(first.y - second.y)).toBeLessThan(1);
      expect(Math.abs(first.height - second.height)).toBeLessThan(1);
      expect(second.x).toBeGreaterThanOrEqual(first.x + first.width + 13);
    } else {
      expect(second.y).toBeGreaterThanOrEqual(first.y + first.height + 13);
    }
    for (const card of await cards.all()) {
      expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      const cardBounds = (await card.boundingBox())!;
      for (const button of await card.getByRole("button").all()) {
        const buttonBounds = (await button.boundingBox())!;
        expect(buttonBounds.x).toBeGreaterThanOrEqual(cardBounds.x);
        expect(buttonBounds.x + buttonBounds.width).toBeLessThanOrEqual(cardBounds.x + cardBounds.width);
        expect(buttonBounds.height).toBeGreaterThanOrEqual(44);
      }
      if (screen === "hospital-bookings") {
        const badge = (await card.locator(".portal-status").boundingBox())!;
        expect(badge.y + badge.height).toBeLessThanOrEqual((await card.locator("h3").boundingBox())!.y);
        await expect(card).not.toContainText("Estimated commission");
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await grid.screenshot({path:test.info().outputPath(`${screen}-grid.png`)});
    if (screen === "hospital-services") {
      expect(await cards.locator("h3").allTextContents()).toEqual(["7-day package", "14-day package", "21-day package"]);
      await cards.first().getByRole("button", {name:"Edit package",exact:true}).click();
      const editor = grid.locator(".portal-service-edit");
      expect((await editor.boundingBox())!.width).toBeCloseTo(bounds.width,0);
      expect(await editor.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await editor.getByRole("button", {name:"Cancel",exact:true}).click();
      await expect(grid.locator(".portal-service-edit")).toHaveCount(0);
    }
  }
});

test("duplicate consultant responses stay unique through editing and loading another page", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", message => { if (/same key|unique.*key/i.test(message.text())) warnings.push(message.text()); });
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-consultants-duplicates");
  const cards = page.locator(".consultant-list>article");
  await expect(cards).toHaveCount(2);
  const edited = cards.filter({ has: page.locator(".consultant-employee-id", { hasText: /^AS002$/ }) });
  await expect(edited).toHaveCount(1);
  await edited.getByRole("button", { name: "Edit", exact: true }).click();
  await edited.locator('input[name="name"]').fill("Edited Consultant");
  await edited.locator('input[name="consultantCharge"]').fill("300");
  await edited.locator('input[name="ayursargaCommissionPercentage"]').fill("10");
  await edited.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(edited.locator("h3")).toHaveText("Edited Consultant");
  await page.getByRole("button", { name: /Load more/i }).click();
  await expect(cards).toHaveCount(3);
  await expect(edited.locator("h3")).toHaveText("Edited Consultant");
  expect(await cards.locator(".consultant-employee-id").allTextContents()).toEqual(["AS002", "AS001", "AS003"]);
  expect(warnings).toEqual([]);
});

test("consultant Add/Edit stages optional photos and saves the chosen title without exposing idle uploads", async ({ page }) => {
  const keyWarnings: string[] = [];
  page.on("console", message => { if (/same key|unique.*key/i.test(message.text())) keyWarnings.push(message.text()); });
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-consultants");
  const photo = { name: "portrait.png", mimeType: "image/png", buffer: Buffer.from("photo-fixture") };
  const uploads = () => page.evaluate(() => (window as unknown as { consultantPhotoUploads: { id: string; name: string }[] }).consultantPhotoUploads);
  await expect(page.getByLabel("Consultant photo", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Consultant photo", { exact: true }).setInputFiles(photo);
  expect(keyWarnings).toEqual([]);
  expect(await uploads()).toHaveLength(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Consultant photo", { exact: true })).toHaveCount(0);
  expect(await uploads()).toHaveLength(0);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editForm = page.locator(".portal-edit-form");
  await editForm.locator('select[name="title"]').selectOption("Dr.");
  await editForm.locator('input[name="consultantCharge"]').fill("300");
  await editForm.locator('input[name="ayursargaCommissionPercentage"]').fill("10");
  await editForm.getByLabel("Consultant photo", { exact: true }).setInputFiles(photo);
  await editForm.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(editForm).toHaveCount(0);
  await expect(page.locator(".consultant-profile-heading h3")).toHaveText(/^Dr\. /);
  expect(await uploads()).toHaveLength(1);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator('select[name="title"]')).toHaveValue("Dr.");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Add New", exact: true }).click();
  const createForm = page.locator("form").first();
  await createForm.locator('select[name="title"]').selectOption("Ms.");
  for (const [name, value] of Object.entries({ name: "New Consultant", email: "new@example.test", contactNo: "9876543210", whatsappNo: "9876543210", qualification: "BAMS", yearsExperience: "3", consultantCharge: "300", ayursargaCommissionPercentage: "10" })) await createForm.locator(`input[name="${name}"]`).fill(value);
  await createForm.getByLabel("Consultant photo", { exact: true }).setInputFiles({ name: "bad.svg", mimeType: "image/svg+xml", buffer: Buffer.from("svg") });
  await expect(createForm.getByRole("alert")).toContainText("JPG, PNG or WebP");
  await createForm.getByLabel("Consultant photo", { exact: true }).setInputFiles(photo);
  await page.evaluate(() => Object.assign(window, { failConsultantPhoto: true }));
  await createForm.getByRole("button", { name: "Add consultant", exact: true }).click();
  await expect(createForm).toHaveCount(0);
  await expect(page.getByText(/AS002 was added, but the photo could not be saved/).first()).toBeVisible();
  const calls = await uploads();
  expect(calls).toHaveLength(2);
  expect(calls[1].id).toBe("AS002");
  const writes = await page.evaluate(() => (window as unknown as { consumerBookingFixture: { consultantWrites: Record<string, unknown>[] } }).consumerBookingFixture.consultantWrites);
  expect(writes).toHaveLength(2);
  expect(writes[1]).toMatchObject({ title: "Ms.", name: "New Consultant" });
  expect(writes.every(write => !("imageUrl" in write))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("shared booking cards stay compact and readable across portals and consultation flows", async ({ page }, testInfo) => {
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  for (const screen of ["admin-bookings", "hospital-bookings", "consumer-bookings", "admin-consultations", "consumer-consultations-policy"]) {
    await mount(page, screen);
    const cards = page.locator(".consumer-booking-row");
    await expect(cards.first()).toBeVisible();
    const compact = await cards.first().evaluate(element => {
      const style = getComputedStyle(element);
      const facts = element.querySelector(".consumer-booking-facts")!;
      return { padding: parseFloat(style.paddingTop), gap: parseFloat(style.gap), factsGap: parseFloat(getComputedStyle(facts).rowGap),
        overflow: element.scrollWidth > element.clientWidth + 1,
        badControls: Array.from(element.querySelectorAll("button")).filter(button => button.getClientRects().length && button.getBoundingClientRect().height < 43).length };
    });
    expect(compact.padding).toBeLessThanOrEqual(18);
    expect(compact.gap).toBeLessThanOrEqual(14);
    expect(compact.factsGap).toBe(10);
    expect(compact.overflow).toBe(false);
    expect(compact.badControls).toBe(0);
    await expect(cards.first().locator(".consumer-booking-reference")).toContainText("Booking ID:");
    await expect(cards.first().locator(".consumer-booking-cost").first()).toBeVisible();
    const moneyLayout = await cards.first().evaluate(element => {
      const meta = element.querySelector(".consumer-booking-meta")!;
      const price = meta.querySelector(".consumer-booking-cost:not(.operational-booking-commission)")!.getBoundingClientRect();
      const badge = meta.querySelector(".portal-status")!.getBoundingClientRect();
      const commission = meta.querySelector(".operational-booking-commission")?.getBoundingClientRect();
      return { overlap: Math.min(price.right, badge.right) - Math.max(price.left, badge.left) > 1 && Math.min(price.bottom, badge.bottom) - Math.max(price.top, badge.top) > 1,
        commissionOverlap: !!commission && Math.min(price.bottom, commission.bottom) - Math.max(price.top, commission.top) > 1,
        overflow: meta.scrollWidth > meta.clientWidth + 1 };
    });
    expect(moneyLayout).toEqual({ overlap: false, commissionOverlap: false, overflow: false });
    if (screen === "consumer-consultations-policy") await expect(cards.first().locator(".consultation-cancellation")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${screen}-compact.png`), fullPage: true });
  }
});

test("inactive records follow current records across portal lists and after a local status change", async ({ page }) => {
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  for (const [screen, selector] of [
    ["admin-hospitals-status-order", ".admin-hospital-card .admin-package-status>.portal-status:first-child"],
    ["admin-consultants-status-order", ".consultant-list>article>.portal-row-heading>.portal-status"],
    ["admin-users-status-order", ".admin-user-grid .admin-user-heading>.portal-status"],
    ["hospital-services-status-order", ".portal-service-status"],
    ["admin-packages-status-order", ".portal-package-review-row>.portal-status"],
  ]) {
    await mount(page, screen);
    const badges = page.locator(selector);
    await expect(badges).toHaveCount(4);
    expect(await badges.evaluateAll(elements => elements.map(element => element.getAttribute("data-status")))).toEqual(["active", "active", "inactive", "inactive"]);
    if (screen === "admin-users-status-order") {
      await page.getByRole("button", { name: "Hospitals", exact: true }).click();
      await expect(badges).toHaveCount(4);
      expect(await badges.evaluateAll(elements => elements.map(element => element.getAttribute("data-status")))).toEqual(["active", "active", "inactive", "inactive"]);
      await page.getByRole("button", { name: "Make inactive", exact: true }).first().click();
      await page.getByRole("dialog").getByRole("button", { name: "Make inactive", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeHidden();
      expect(await badges.evaluateAll(elements => elements.map(element => element.getAttribute("data-status")))).toEqual(["active", "inactive", "inactive", "inactive"]);
    }
    if (screen.includes("services") || screen.includes("packages")) {
      const headings = screen.includes("services") ? page.locator(".portal-service-heading>h3") : page.locator(".portal-package-review-row h3");
      await expect(headings).toHaveText(["7-day package", "14-day package", "7-day package", "21-day package"]);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});
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

test("Admin Availability and complete Settings keep separate cards spaced without overlap", async ({ page }, testInfo) => {
  await page.route("**/*", route=>route.fulfill({status:204,body:""}));
  for (const screen of ["admin-availability","admin-settings","admin-settings-disabled"]) {
    await mount(page,screen);
    const first=page.locator(".portal-page-enter .portal-card").first();
    const next=screen==="admin-availability"?page.locator(".portal-availability-list"):page.locator(".portal-page-enter .portal-card").nth(1);
    await expect(first).toBeVisible();
    await expect(next).toBeVisible();
    const assertSpacing=async()=>{
      const a=await first.boundingBox(); const b=await next.boundingBox();
      expect(b!.y-(a!.y+a!.height),screen).toBeGreaterThanOrEqual(16);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),screen).toBe(true);
    };
    await assertSpacing();
    if (screen==="admin-availability") {
      const cards=page.locator(".portal-availability-record");
      for (let index=1;index<await cards.count();index++) {
        const a=await cards.nth(index-1).boundingBox(); const b=await cards.nth(index).boundingBox();
        expect(b!.y-(a!.y+a!.height)).toBeGreaterThanOrEqual(16);
      }
    }
    for (const position of [0.5,1,0]) {
      await page.evaluate(fraction=>window.scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*fraction,behavior:"instant"}),position);
      await assertSpacing();
    }
    if (screen.startsWith("admin-settings")) {
      await page.getByRole("button",{name:"Edit consultation policy",exact:true}).click();
      await assertSpacing();
      await page.getByRole("button",{name:"Cancel",exact:true}).click();
      await assertSpacing();
    }
    await page.screenshot({path:testInfo.outputPath(`${screen}-spacing.png`),fullPage:true});
  }
});

test("Admin hospital cards show contacts created time and package approvals in a responsive three-column maximum", async ({ page }, testInfo) => {
  await page.route("**/*", route => route.fulfill({status:204,body:""}));
  await mount(page,"admin-hospital-cards");
  const cards=page.locator(".admin-hospital-card");
  await expect(cards).toHaveCount(6);
  const first=cards.first();
  await expect(first).toContainText("hospital.contact.with.long.address@example.com");
  await expect(first).toContainText("9876543210");
  await expect(first).toContainText("Package Approval Pending · 1");
  await expect(first).toContainText("Packages Approved · 1");
  await expect(cards.nth(1)).toContainText("No packages added");
  await expect(first.locator("dt").filter({hasText:/^Created$/})).toHaveCount(1);
  await expect(first.locator(".admin-card-facts")).toContainText(/\d{2}\/\d{2}\/\d{4},.*IST/);
  await expect(first).toHaveAttribute("href","/admin/hospitals/centre-0");
  await expect(first.locator(".admin-package-status>.portal-status").first()).toHaveText("active");
  const compact = await first.evaluate(element => {
    const style = getComputedStyle(element);
    const badges = element.querySelector(".admin-package-status")!.getBoundingClientRect();
    const facts = element.querySelector(".admin-card-facts")!.getBoundingClientRect();
    return { padding: style.paddingTop, gap: style.gap, badgesBeforeFacts: badges.bottom <= facts.top,
      factColumns: getComputedStyle(element.querySelector(".admin-card-facts")!).gridTemplateColumns.split(" ").length };
  });
  expect(compact).toEqual({ padding: "18px", gap: "12px", badgesBeforeFacts: true, factColumns: 2 });
  const statusPosition = await first.evaluate(element => {
    const card = element.getBoundingClientRect();
    const badges = element.querySelector(".admin-package-status")!;
    const bounds = badges.getBoundingClientRect();
    const title = element.querySelector("h3")!.getBoundingClientRect();
    const last = badges.lastElementChild!.getBoundingClientRect();
    return { besideName: bounds.left >= title.right, sameTop: Math.abs(bounds.top - title.top) < 1, top: Math.round(bounds.top - card.top),
      right: Math.round(card.right - last.right), alignment: getComputedStyle(badges).justifyContent };
  });
  expect(statusPosition).toEqual({ besideName: true, sameTop: true, top: 19, right: 19, alignment: "flex-end" });
  for (const [left, right] of [["Email", "Owner WhatsApp"], ["Hospital phone", "Created"]]) {
    const leftBounds = await first.locator(".admin-card-facts>div").filter({ has: page.locator("dt", { hasText: new RegExp(`^${left}$`) }) }).boundingBox();
    const rightBounds = await first.locator(".admin-card-facts>div").filter({ has: page.locator("dt", { hasText: new RegExp(`^${right}$`) }) }).boundingBox();
    expect(Math.abs(leftBounds!.y - rightBounds!.y)).toBeLessThan(1);
    expect(rightBounds!.x).toBeGreaterThan(leftBounds!.x);
  }
  const grid=page.locator(".admin-hospital-grid");
  const width=await page.locator(".admin-card-layout").evaluate(element=>element.clientWidth);
  const columns=await grid.evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(width>=1000?3:width>=650?2:1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const overflow=await cards.locator("dd,.portal-status").evaluateAll(elements=>elements.filter(element=>element.scrollWidth>element.clientWidth+1).map(element=>element.textContent));
  expect(overflow).toEqual([]);
  await page.screenshot({path:testInfo.outputPath("hospital-cards.png"),fullPage:true});
  await page.evaluate(()=>{(window as unknown as {packageSummaryFailure:boolean}).packageSummaryFailure=true;});
  await page.getByRole("button",{name:"Refresh package status",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("Package status could not be loaded");
  await expect(first).toContainText("Package status unavailable");
  await expect(first).not.toContainText("Packages Approved");
  await page.evaluate(()=>{(window as unknown as {packageSummaryFailure:boolean}).packageSummaryFailure=false;});
  await page.getByRole("button",{name:"Refresh package status",exact:true}).click();
  await expect(first).toContainText("Package Approval Pending");
});

test("portal guidance stays readable and aligned across Admin Hospital and Consumer workflows", async ({ page }, testInfo) => {
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  for (const screen of ["admin-consultants", "hospital-profile", "admin-cancellation-settings", "admin-consultant-finance", "consumer-consultation-new", "consumer-consultation-empty"]) {
    await mount(page, screen);
    if (screen === "admin-consultants") await page.getByRole("button", { name: "Add New", exact: true }).click();
    if (screen === "hospital-profile") {
      await expect(page.locator(".portal-help-list")).toContainText("Your first photo is the cover customers see");
      await expect(page.locator(".portal-image-manager")).not.toContainText("publication minimum");
      const fields = page.locator(".portal-guidelines-fields").first();
      if (await fields.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length === 2)) {
        const first = await fields.locator("textarea").nth(0).boundingBox();
        const second = await fields.locator("textarea").nth(1).boundingBox();
        expect(Math.abs(first!.y - second!.y)).toBeLessThanOrEqual(1);
      }
    }
    if (screen === "consumer-consultation-new") {
      await page.getByRole("radio", { name: /Assigned Consultation Professional/ }).check();
      await expect(page.getByText("Choose an available date from the calendar.", { exact: false })).toBeVisible();
    }
    const overflow = await page.locator(".portal-form-note,.portal-help-list,.portal-field-error,.portal-form-error").evaluateAll(elements => elements.filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1);
    }).map(element => element.textContent));
    expect(overflow, screen).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), screen).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${screen}-guidance.png`), fullPage: true });
  }
});

test("district fields offer only Kerala and Tamil Nadu and derive the selected state", async ({ page }) => {
  for (const screen of ["admin-hospitals", "hospital-profile"]) {
    await mount(page, screen);
    if (screen === "admin-hospitals") await page.getByRole("button", { name: "Add Hospital", exact: true }).click();
    const district = page.getByPlaceholder("Search district or state");
    const listId = await district.getAttribute("list");
    const options = await page.locator(`datalist[id="${listId}"] option`).evaluateAll(elements => elements.map(element => (element as HTMLOptionElement).value));
    expect(options).toHaveLength(52);
    expect(options.every(option => option.endsWith(", Kerala") || option.endsWith(", Tamil Nadu"))).toBe(true);
    await district.fill("Coimbatore, Tamil Nadu");
    await expect(page.locator('input[name="district"]')).toHaveValue("Coimbatore");
    await expect(page.locator('input[name="state"]')).toHaveValue("Tamil Nadu");
    await district.fill("Palakkad");
    await expect(page.locator('input[name="state"]')).toHaveValue("Kerala");
    await district.fill("Mumbai");
    await expect(page.locator('input[name="district"]')).toHaveValue("");
    await expect(page.locator('input[name="state"]')).toHaveValue("");
  }
});

test("Consultant Finance presents private breakdown and confirms an external settlement responsively", async ({ page }) => {
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-consultant-finance");
  await expect(page.getByRole("heading", { name: "Consultant Finance", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Consultant Finance", exact: true })).toHaveCSS("font-size", "28px");
  await expect(page.getByRole("link", { name: "Invoices & Billing", exact: true })).toBeVisible();
  const filters = page.getByRole("region", { name: "Consultant finance filters", exact: true });
  const searchField = filters.getByRole("searchbox");
  const statusField = filters.getByRole("combobox");
  const paymentMode = page.getByRole("combobox", { name: "Payment mode", exact: true });
  for (const field of [searchField, statusField, paymentMode]) {
    await expect(field).toHaveCSS("border-radius", "10px");
    expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(searchField).toHaveCSS("background-color", "rgb(255, 255, 255)");
  for (const select of [statusField, paymentMode]) {
    await expect(select).toHaveCSS("appearance", "none");
    await expect(select).toHaveCSS("background-color", /rgba\(31, 61, 43, 0\.0\d+\)/);
  }
  const columns = await filters.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(columns).toBe((page.viewportSize()?.width ?? 1440) > 600 ? 2 : 1);
  if (columns === 2) expect(Math.abs((await searchField.boundingBox())!.y - (await statusField.boundingBox())!.y)).toBeLessThan(2);
  await filters.screenshot({ path: test.info().outputPath("finance-styled-filters.png") });
  await page.getByText("View financial breakdown", { exact: true }).click();
  await expect(page.getByText("Consultant payable", { exact: true })).toBeVisible();
  await page.getByLabel("Transfer reference *", { exact: true }).fill("UTR-EXTERNAL-123");
  await page.getByRole("button", { name: "Record settlement", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { consumerBookingFixture: { calls: number } }).consumerBookingFixture.calls)).toBe(0);
  await page.getByRole("button", { name: "Record settlement", exact: true }).click();
  await dialog.getByRole("button", { name: "Record settlement", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".portal-finance-row .portal-status")).toHaveText("paid");
  expect(await page.evaluate(() => (window as unknown as { consumerBookingFixture: { calls: number } }).consumerBookingFixture.calls)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("Finance invoice section uses the shared portal heading style", async ({ page }) => {
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-billing");
  await expect(page.getByRole("heading", { name: "Invoices & Billing", exact: true })).toHaveCSS("font-size", "28px");
  await expect(page.getByRole("button", { name: "New commission invoice", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("Consultation cancellation details show agreed deadlines and hide expired actions on consumer cards", async ({ page }) => {
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  await mount(page, "consumer-consultations-policy");
  const policy = page.getByRole("region", { name: "Cancellation policy", exact: true });
  await expect(policy).toContainText("Cancellation available");
  await expect(policy).toContainText("25/10/2099");
  await expect(policy).toContainText("₹990.55");
  await policy.getByText("Policy terms and refund deadlines", { exact: true }).click();
  await expect(policy).toContainText("23/10/2099");
  await expect(policy).toContainText("100% of the amount paid");
  const terms = policy.getByRole("table");
  await expect(terms.getByRole("columnheader")).toHaveCount(3);
  await expect(terms.getByRole("columnheader", { name: "Cancellation period", exact: true })).toBeVisible();
  await expect(terms).toContainText("48 hours before the appointment reference time");
  await expect(terms).toContainText("0% of the amount paid");
  await expect(terms).toContainText("Cancellation does not issue a refund automatically");
  await expect(page.getByRole("button", { name: "Cancel appointment", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await mount(page, "consumer-consultations-expired");
  await expect(page.getByText("Cancellation window expired", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel appointment", exact: true })).toHaveCount(0);
  await mount(page, "consumer-consultations");
  await expect(page.getByText("Your original booking terms still apply. Contact Ayursarga with your booking ID to check your cancellation deadline and any refund.", { exact: true })).toBeVisible();
});

test("Admin edits consultation cancellation policy with confirmation and inline aligned fields", async ({ page }) => {
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-cancellation-settings");
  const windowField = page.getByRole("spinbutton", { name: "Refund window *", exact: true });
  await expect(windowField).toBeDisabled();
  await page.getByRole("button", { name: "Edit consultation policy", exact: true }).click();
  await windowField.fill("3");
  await page.getByRole("combobox", { name: "Refund window unit", exact: true }).selectOption("days");
  await page.getByRole("button", { name: "Save consultation policy", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { consumerBookingFixture: { calls: number } }).consumerBookingFixture.calls)).toBe(0);
  await page.getByRole("button", { name: "Save consultation policy", exact: true }).click();
  await dialog.getByRole("button", { name: "Save policy", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(windowField).toBeDisabled();
  await expect(windowField).toHaveValue("72");
  expect(await page.evaluate(() => (window as unknown as { consumerBookingFixture: { calls: number } }).consumerBookingFixture.calls)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
test("Admin dashboard separates online consultations and links to existing booking details", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-dashboard");
  const card = page.getByRole("article", { name: "Online consultation bookings", exact: true });
  await expect(card.locator("strong")).toHaveText("5");
  await expect(card).toContainText("Online consultations");
  await expect(card.locator("a")).toHaveCount(0);
  await expect(page.getByText("View bookings and details", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Online consultation bookings/ })).toHaveAttribute("href", "/admin/bookings/consultations");
  await expect(page.getByRole("link", { name: /^Manage hospital bookings/ })).toHaveAttribute("href", "/admin/bookings");
  await expect(page.locator(".portal-stat").filter({ hasText: "Hospital bookings" }).locator("strong")).toHaveText("12");
  const queries = await page.evaluate(() => (window as unknown as { dashboardCountCalls: { path: string; filters: { field: string; operator: string; value: { toDate: () => Date } }[] }[] }).dashboardCountCalls
    .filter((call) => call.path === "consultationBookings").map((call) => call.filters.map((filter) => ({ field: filter.field, operator: filter.operator, value: filter.value.toDate().toISOString() }))));
  const range = getCalendarMonthRange();
  expect(queries).toEqual([[{ field: "createdAt", operator: ">=", value: range.start.toISOString() }, { field: "createdAt", operator: "<", value: range.end.toISOString() }]]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const bounds = await card.boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  await card.screenshot({ path: test.info().outputPath("dashboard-online-consultations.png") });
  await mount(page, "admin-consultations");
  await expect(page.getByRole("heading", { name: "Online consultations", exact: true })).toBeVisible();
  await expect(page.getByText("Assigned Consultation Professional", { exact: false })).toBeVisible();
  await expect(page.getByText("Booked on", { exact: true })).toBeVisible();
  await expect(page.getByText("Scheduled appointment", { exact: true })).toBeVisible();
});

test("Admin dashboard online consultation zero is distinct from an unavailable total", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-dashboard-consultations-zero");
  const card = page.getByRole("article", { name: "Online consultation bookings", exact: true });
  await expect(card.locator("strong")).toHaveText("0");
  await mount(page, "admin-dashboard-consultations-unavailable");
  await expect(card.locator("strong")).toHaveText("…");
  await expect(page.getByText("Some dashboard totals are temporarily unavailable. The available figures are shown below.", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".portal-stat").filter({ hasText: "Hospital bookings" }).locator("strong")).toHaveText("12");
  await expect(page.getByRole("link", { name: /^Online consultation bookings/ })).toHaveAttribute("href", "/admin/bookings/consultations");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("hospital cover badge follows the first photo and public galleries keep their five-photo minimum", async ({ page }) => {
  await page.route("https://images.test/**", (route) => route.fulfill({ status: 404 }));
  for (const screen of ["admin-details", "hospital-profile"]) {
    await mount(page, screen);
    const gallery = page.locator(".portal-hospital-gallery");
    const badge = gallery.getByText("Cover image", { exact: true });
    await expect(badge).toHaveCount(1);
    await expect(badge).toBeVisible();
    await expect(gallery.locator("a").first()).toContainText("Cover image");
    await expect(badge).toHaveCSS("color", "rgb(255, 255, 255)");
    await page.getByRole("button", { name: "Remove centre image 1", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Remove image", exact: true }).click();
    await expect(gallery.locator("a")).toHaveCount(5);
    await expect(gallery.locator("a").first()).toHaveAttribute("href", "https://images.test/centre-1.webp");
    await expect(gallery.getByText("Cover image", { exact: true })).toHaveCount(1);
    for (const button of await gallery.getByRole("button", { name: /Remove centre image/ }).all()) await expect(button).toBeDisabled();
    await expect(page.getByRole("button", { name: "Upload images", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await gallery.screenshot({ path: test.info().outputPath(`${screen}-cover-gallery.png`) });
  }
  await mount(page, "admin-gallery-incomplete");
  await expect(page.getByRole("button", { name: "Activate hospital", exact: true })).toBeDisabled();
  const warning = page.locator("#hospital-activation-images-error");
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("Activation requires 5 hospital images.");
  await expect(warning).toContainText("3 of 5 required photos added. Add 2 more photos");
  await expect(page.getByRole("button", { name: "Activate hospital", exact: true })).toHaveAttribute("aria-describedby", "hospital-activation-images-error");
  await expect(warning.getByRole("link", { name: "Go to hospital images" })).toHaveAttribute("href", "#hospital-images");
  await expect(page.getByRole("button", { name: "Upload images", exact: true })).toBeEnabled();
});

test("package review supports private Hospital drafts and confirmed individual or bulk Admin approval", async ({ page }) => {
  await mount(page, "hospital-package-review");
  const hospitalCard = page.locator(".portal-service-row").first();
  await expect(hospitalCard.getByText("Draft", { exact: true })).toBeVisible();
  await expect(hospitalCard.getByRole("button", { name: "Activate", exact: true })).toHaveCount(0);
  await hospitalCard.getByRole("button", { name: "Submit for approval", exact: true }).click();
  await expect(hospitalCard.getByText("Pending review", { exact: true })).toBeVisible();
  await expect(hospitalCard.getByRole("button", { name: "Submit for approval", exact: true })).toHaveCount(0);
  await hospitalCard.screenshot({ path: test.info().outputPath("hospital-package-review.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await mount(page, "admin-package-review");
  const packages = page.getByRole("region", { name: "Packages and services" });
  await expect(packages.getByText("3 pending review", { exact: true })).toBeVisible();
  await packages.screenshot({ path: test.info().outputPath("admin-package-review.png") });
  await packages.getByRole("button", { name: "Approve package", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
  const calls = await page.evaluate(() => (window as unknown as { consumerBookingFixture: { calls: number } }).consumerBookingFixture.calls);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { consumerBookingFixture: { calls: number } }).consumerBookingFixture.calls)).toBe(calls);
  await packages.getByRole("button", { name: "Approve package", exact: true }).first().click();
  await dialog.getByRole("button", { name: "Approve and publish", exact: true }).click();
  await expect(packages.getByText("2 pending review", { exact: true })).toBeVisible();
  await packages.getByRole("button", { name: "Request changes", exact: true }).first().click();
  await dialog.getByRole("button", { name: "Send feedback", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Enter a reason");
  await dialog.getByRole("textbox", { name: "Reason for changes" }).fill("Please correct the procedure details.");
  await dialog.getByRole("button", { name: "Send feedback", exact: true }).click();
  await expect(packages.getByText("1 pending review", { exact: true })).toBeVisible();
  await packages.getByRole("checkbox", { name: "Select up to 20 pending packages", exact: true }).check();
  await packages.getByRole("button", { name: "Approve selected (1)", exact: true }).click();
  await dialog.getByRole("button", { name: "Approve and publish", exact: true }).click();
  await expect(packages.getByRole("button", { name: "Approve package", exact: true })).toHaveCount(0);
  await expect(packages.getByText("Approved", { exact: true })).toHaveCount(2);
  await expect(packages.getByText("Changes requested", { exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  await page.screenshot({ path: test.info().outputPath("package-review.png"), fullPage: true });
});

test("Hospital bookings go directly from start to complete with treatment badges and no reschedule or ongoing actions", async ({ page }) => {
  await mount(page, "hospital-bookings");
  await expect(page.getByRole("button", { name: "Reschedule", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark ongoing", exact: true })).toHaveCount(0);
  await mount(page, "hospital-auto-confirmed");
  await page.getByRole("button", { name: "Start treatment", exact: true }).click();
  await expect(page.locator(".portal-status")).toHaveText("Treatment Started");
  await expect(page.getByRole("button", { name: "Start treatment", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Complete treatment", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".portal-status")).toHaveText("Treatment Started");
  await page.getByRole("button", { name: "Complete treatment", exact: true }).click();
  await dialog.getByRole("button", { name: "Complete treatment", exact: true }).click();
  await expect(page.locator(".portal-status")).toHaveText("Treatment completed");
  await expect(page.getByRole("button", { name: "Complete treatment", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await mount(page, "admin-booking-detail");
  await expect(page.locator(".portal-status")).toHaveText("confirmed");
});

test("Admin creation duplicate emails remain inline and focus the email field without closing either form", async ({ page }) => {
  for (const module of ["hospitals", "consultants"]) {
    await mount(page, `admin-${module}`);
    await page.evaluate(() => Object.assign(window, { duplicateCreation: true }));
    await page.getByRole("button", { name: module === "hospitals" ? "Add Hospital" : "Add New", exact: true }).click();
    const form = page.locator("form").first();
    const values = module === "hospitals"
      ? { legalName: "Example hospital", name: "Example hospital", email: "existing@example.test", phone: "9876543210", hospitalPhone1: "9876543210", city: "Palakkad", commission: "10", registeredAddress: "A complete registered address", address: "A complete service address" }
      : { name: "Example consultant", email: "existing@example.test", contactNo: "9876543210", whatsappNo: "9876543210", qualification: "BAMS", yearsExperience: "3", consultantCharge: "300", ayursargaCommissionPercentage: "10" };
    for (const [name, value] of Object.entries(values)) await form.locator(`input[name="${name}"]`).fill(value);
    if (module === "hospitals") await form.getByPlaceholder("Search district or state").fill("Palakkad, Kerala");
    await form.getByRole("button", { name: module === "hospitals" ? "Create hospital" : "Add consultant", exact: true }).click();
    const email = form.locator('input[name="email"]');
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(form.locator(".portal-field-error")).toContainText("This email is already used");
    await expect(email).toBeFocused();
    await expect(form).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test("existing Admin and Hospital edit forms no longer display hospital descriptions", async ({ page }) => {
  await page.route("https://images.test/**", route => route.fulfill({ status: 404 }));
  await mount(page, "admin-details");
  await expect(page.getByText("Care centre description", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit hospital", exact: true }).click();
  await expect(page.locator('textarea[name="description"]')).toHaveCount(0);
  await expect(page.locator('input[name="name"]')).toBeVisible();
  await mount(page, "hospital-profile");
  await expect(page.locator('textarea[name="description"]')).toHaveCount(0);
  await expect(page.locator('input[name="name"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Save profile", exact: true })).toBeEnabled();
});

test("consultant photos and labeled professional details stay readable without duplicate qualifications", async ({ page }) => {
  await page.route("https://images.test/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" fill="#dce9df"/></svg>' }));
  await mount(page, "consumer-consultation-photo");
  const card = page.locator(".consultation-professional");
  await expect(card.locator(".consultation-professional-name")).toHaveText("Shafna");
  expect((await card.textContent())?.match(/BAMS/g)).toHaveLength(1);
  await expect(card.locator(".consultation-professional-role")).toHaveText("DesignationBAMS");
  await expect(card.locator(".consultation-professional-role>small")).toBeVisible();
  await expect(card.locator(".consultation-professional-name")).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(card.locator(".consultation-professional-detail").filter({ hasText: "Experience" })).toContainText("3 years");
  await expect(card.locator(".consultation-professional-fee")).toContainText("₹300.00");
  await expect(card.locator(".consultant-photo img")).toBeVisible();
  await expect(card.locator(".consultant-photo img")).toHaveCSS("object-fit", "cover");
  const portraitBounds = await card.locator(".consultant-photo").boundingBox();
  const nameBounds = await card.locator(".consultation-professional-name").boundingBox();
  expect(nameBounds!.x - (portraitBounds!.x + portraitBounds!.width)).toBeGreaterThanOrEqual(10);
  expect(nameBounds!.x - (portraitBounds!.x + portraitBounds!.width)).toBeLessThanOrEqual(20);
  expect(portraitBounds!.width).toBe(page.viewportSize()!.width <= 480 ? 112 : 136);
  expect(portraitBounds!.height).toBe(page.viewportSize()!.width <= 480 ? 132 : 152);
  await expect(card.locator(".consultant-photo img")).toHaveAttribute("loading", "lazy");
  const compactBounds = await card.boundingBox();
  expect(compactBounds!.height).toBeLessThan(300);
  const gridBounds = await page.locator(".consultation-professional-grid").boundingBox();
  if (gridBounds!.width >= 772) expect(compactBounds!.width).toBeLessThanOrEqual(gridBounds!.width / 2);
  expect(portraitBounds!.x + portraitBounds!.width).toBeLessThanOrEqual(compactBounds!.x + compactBounds!.width);
  await card.getByRole("radio").check();
  await expect(card.getByRole("radio")).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await card.screenshot({ path: test.info().outputPath("consultant-details.png") });
  await card.locator("img").dispatchEvent("error");
  await expect(card.locator(".consultant-photo")).toHaveText("S");
  expect((await card.locator(".consultant-photo").boundingBox())!.height).toBe(portraitBounds!.height);
  await mount(page, "admin-consultants");
  expect((await page.locator(".consultant-photo").boundingBox())!.width).toBe(72);
  await expect(page.getByLabel("Consultant photo", { exact: true })).toHaveCount(0);
});

test("online consultation form uses assigned charges and custom windows, requires consent and submits once", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "consumer-consultation-new");
  const submit = page.getByRole("button", { name: /Pay.*book appointment/i });
  await expect(submit).toBeDisabled();
  await page.getByRole("radio", { name: /Assigned Consultation Professional/ }).check();
  await expect(page.locator(".consultation-professional")).toContainText("₹990.55");
  await expect(page.locator(".consultation-professional")).not.toContainText("Commission");
  const providerCard = await page.locator(".consultation-professional").boundingBox();
  expect(providerCard!.height).toBeLessThan(350);
  expect((await page.locator(".consultation-professional>span").boundingBox())!.width).toBeGreaterThan(90);
  expect((await page.getByRole("radio", { name: /Assigned Consultation Professional/ }).boundingBox())!.width).toBeLessThan(25);
  await page.getByRole("textbox", { name: "Preferred appointment date *", exact: true }).fill("25/10/2099");
  await expect(page.getByRole("option", { name: /Morning: 9:30 AM/ })).toContainText("11:45 AM");
  await page.getByRole("combobox", { name: "Preferred time *", exact: true }).selectOption("morning");
  await expect(submit).toBeDisabled();
  await page.getByRole("checkbox", { name: "I have read and agree to the applicable terms and policies.", exact: true }).check();
  await expect(submit).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("online-consultation-form.png"), fullPage: true });
  await page.locator("form").evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit(); });
  const writes = await page.evaluate(() => (window as unknown as { consumerBookingFixture: { consultantWrites: object[]; navigatedTo: string } }).consumerBookingFixture);
  expect(writes.consultantWrites).toHaveLength(1);
  expect(writes.consultantWrites[0]).toMatchObject({ consultantId: "AS001", serviceId: "prenatal-doctor", preferredDate: "2099-10-25", preferredTimeSlot: "morning", bookingTermsAccepted: true, expectedCharge: 990.55 });
  expect(writes.navigatedTo).toBe("/app/bookings/consultations?booking=consultation-fixture");
  expect(errors).toEqual([]);
});

test("online consultation empty state is clear and does not show an unusable form", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "consumer-consultation-empty");
  await expect(page.getByRole("heading", { name: "Consultants are not available yet" })).toBeVisible();
  await expect(page.getByText("No appointments are available for prenatal doctor consultation right now.", { exact: false })).toBeVisible();
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
  await expect(page.getByText("Appointments are confirmed when booked", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No online consultations yet" })).toBeVisible();
  await expect(page.getByText("Appointments booked through Wellness Path", { exact: false })).toBeVisible();
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

test("Admin booking categories use the Users-style segmented switch without changing Consumer navigation", async ({ page }) => {
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  for (const [screen, current] of [["admin-bookings", "Hospital bookings"], ["admin-consultations", "Online consultations"]]) {
    await mount(page, screen);
    const nav = page.getByRole("navigation", { name: "Booking categories", exact: true });
    const control = nav.locator(".portal-segmented");
    await expect(control.getByRole("link", { name: "Hospital bookings", exact: true })).toHaveAttribute("href", "/admin/bookings");
    await expect(control.getByRole("link", { name: "Online consultations", exact: true })).toHaveAttribute("href", "/admin/bookings/consultations");
    await expect(control.locator('[aria-current="page"]')).toHaveText(current);
    const box = await control.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    for (const link of await control.getByRole("link").all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await mount(page, "consumer-consultations");
  await expect(page.locator(".portal-booking-switch")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "My hospital bookings", exact: true })).toBeVisible();
});

test("booking detail navigation stays separate from booking content", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  for (const screen of ["admin-booking-detail", "hospital-booking-detail"] as const) {
    await mount(page, screen);
    await expect(page.getByRole("button", { name: "Ask Ayu, your Ayursarga guide" })).toHaveCount(0);
    const navigation = page.getByRole("navigation", { name: screen.startsWith("admin") ? "Booking categories" : "Booking navigation" });
    await expect(navigation.getByRole("link", { name: "View all bookings" })).toBeVisible();
    await expect(page.locator(".consumer-booking-row").first().getByText("Booked on", { exact: true })).toBeVisible();
    await expect(page.getByText("Confirmed appointment", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/^Showing\s+\d+\s+booking/)).toHaveCount(0);
    const navigationBox = await navigation.boundingBox();
    const bookingBox = await page.locator(".consumer-booking-row").first().boundingBox();
    expect(navigationBox!.y + navigationBox!.height).toBeLessThanOrEqual(bookingBox!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test("online consultation history reschedules with a locked shared dialog and Consumer sees no Admin controls", async ({ page }, testInfo) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-consultations");
  await expect(page.getByText("Assigned Consultation Professional", { exact: false })).toBeVisible();
  await expect(page.locator(".portal-status")).toHaveText("confirmed");
  await expect(page.getByText("Booked on", { exact: true })).toBeVisible();
  await expect(page.locator("dt").filter({ hasText: /^Booked on$/ }).locator("..").locator("dd")).toHaveText("21/09/2026, 07:43 pm IST");
  await expect(page.getByText("Scheduled appointment", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm appointment", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { consumerBookingFixture: { consultantWrites: object[] } }).consumerBookingFixture.consultantWrites.length)).toBe(0);
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  await dialog.locator('input[type="time"]').fill("10:15");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("25/10/2099 · 10:15 IST", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("online-consultation-history.png"), fullPage: true });
  await mount(page, "consumer-consultations");
  await expect(page.locator(".portal-status")).toHaveText("confirmed");
  await expect(page.getByText("Booked on", { exact: true })).toBeVisible();
  await expect(page.locator("dt").filter({ hasText: /^Booked on$/ }).locator("..").locator("dd")).toHaveText("21/09/2026, 07:43 pm IST");
  await expect(page.getByText("Scheduled appointment", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm appointment", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reschedule", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel appointment", exact: true })).toBeVisible();
});

test("consultation rescheduling validates before saving, submits once and reports email failure honestly", async ({ page }) => {
  await mount(page, "admin-consultations-email-failure");
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="time"]').fill("12:00");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("within the appointment window");
  expect(await page.evaluate(() => (window as unknown as { consumerBookingFixture: { consultantWrites: unknown[] } }).consumerBookingFixture.consultantWrites.length)).toBe(0);
  await dialog.locator('input[type="time"]').fill("10:15");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { consumerBookingFixture: { consultantWrites: unknown[] } }).consumerBookingFixture.consultantWrites.length)).toBe(1);
  await expect(page.getByText("25/10/2099 · 10:15 IST", { exact: true })).toBeVisible();
  await expect(page.locator(".portal-form-error")).toContainText("mail service did not confirm");
  await expect(page.locator('.portal-toast[data-tone="error"]')).toContainText("mail service did not confirm");
  expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("Admin sees consultant email failure independently of successful consumer delivery", async ({ page }) => {
  await mount(page, "admin-consultations-consultant-email-failure");
  await page.getByRole("button", { name: "Cancel appointment", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".portal-status")).toHaveText("cancelled");
  await expect(page.locator(".portal-form-error")).toContainText("did not confirm the consultant email");
  await expect(page.locator('.portal-toast[data-tone="error"]')).toContainText("consultant email");
  await expect(page.locator('.portal-toast:not([data-tone="error"])')).toContainText("consumer email was accepted");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
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

test("Admin user cards show created date and time for both groups with a safe legacy fallback", async ({ page }) => {
  await page.route("**/*", route => route.fulfill({status:204,body:""}));
  for (const screen of ["admin-users", "admin-users-no-date"]) {
    await mount(page, screen);
    for (const group of ["Consumers", "Hospitals"]) {
      await page.getByRole("button", {name:group, exact:true}).click();
      const facts=page.locator(".admin-user-grid .admin-card-facts").first();
      await expect(facts.locator("dt")).toHaveText("Created");
      if (screen.endsWith("no-date")) await expect(facts.locator("dd")).toHaveText("Not recorded");
      else await expect(facts.locator("dd")).toHaveText(/\d{2}\/\d{2}\/\d{4},.*\d{2}:\d{2}.*IST/);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await expect(page.locator(".admin-user-grid").getByRole("button",{name:"Remove",exact:true})).toHaveCount(0);
      await expect(page.locator(".admin-user-grid").getByRole("button",{name:"Make inactive",exact:true})).toHaveCount(1);
    }
  }
});

test("Admin Consumer and Hospital accounts become inactive and active without removal", async ({ page }) => {
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-users");
  for (const group of ["Consumers", "Hospitals"]) {
    await page.getByRole("button", { name: group, exact: true }).click();
    const card = page.locator(".admin-user-grid .portal-row").first();
    const before = await page.evaluate(() => (globalThis as unknown as { userStatusCalls: string[] }).userStatusCalls.length);
    await card.getByRole("button", { name: "Make inactive", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await expect(page.locator("body")).toHaveCSS("position", "fixed");
    if (group === "Hospitals") await expect(dialog).toContainText("login access only");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => (globalThis as unknown as { userStatusCalls: string[] }).userStatusCalls.length)).toBe(before);
    await card.getByRole("button", { name: "Make inactive", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Make inactive", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(card.locator(".portal-status")).toHaveText("inactive");
    await card.getByRole("button", { name: "Make active", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Make active", exact: true }).click();
    await expect(card.locator(".portal-status")).toHaveText("active");
    await expect(card.getByRole("button", { name: /Remove|Delete/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
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

test("both user grids fit up to five compact cards without hiding account details", async ({ page }) => {
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-user-cards");
  for (const group of ["Consumers", "Hospitals"]) {
    await page.getByRole("button", { name: group, exact: true }).click();
    const cards = page.locator(".admin-user-grid>.portal-row");
    await expect(cards).toHaveCount(10);
    const layout = await cards.evaluateAll(elements => {
      const bounds = elements.map(element => element.getBoundingClientRect());
      return { columns: bounds.filter(box => Math.abs(box.y - bounds[0].y) < 2).length,
        width: elements[0].parentElement!.getBoundingClientRect().width,
        overflow: elements.some(element => element.scrollWidth > element.clientWidth + 1),
        heights: bounds.filter(box => Math.abs(box.y - bounds[0].y) < 2).map(box => box.height) };
    });
    const expected = layout.width >= 1150 ? 5 : layout.width >= 920 ? 4 : layout.width >= 690 ? 3 : layout.width >= 460 ? 2 : 1;
    expect(layout.columns).toBe(expected);
    if (page.viewportSize()!.width >= 1800) expect(layout.columns).toBe(5);
    expect(layout.overflow).toBe(false);
    expect(Math.max(...layout.heights) - Math.min(...layout.heights)).toBeLessThan(2);
    await expect(cards.first().getByRole("button", { name: "Make inactive", exact: true })).toBeVisible();
    await expect(cards.first()).toContainText("Created");
    const heading = await cards.first().locator(".admin-user-heading").boundingBox();
    const badge = await cards.first().locator(".portal-status").boundingBox();
    expect(Math.abs(badge!.y - heading!.y)).toBeLessThan(2);
    expect(Math.abs(badge!.x + badge!.width - heading!.x - heading!.width)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.screenshot({ path: test.info().outputPath("user-grid.png"), fullPage: true });
});

test("user contact details expand independently and collapse without hiding essential information", async ({ page }) => {
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-user-cards");
  for (const group of ["Consumers", "Hospitals"]) {
    await page.getByRole("button", { name: group, exact: true }).click();
    const cards = page.locator(".admin-user-grid>.portal-row");
    const details = cards.first().locator("details");
    const summary = details.locator("summary");
    await expect(details).not.toHaveAttribute("open");
    await expect(details.getByText("Phone number", { exact: true })).toBeHidden();
    await expect(cards.first().locator("h3")).toBeVisible();
    await expect(cards.first().locator(".portal-status")).toBeVisible();
    await summary.click();
    await expect(details).toHaveAttribute("open", "");
    await expect(details.getByText("Phone number", { exact: true })).toBeVisible();
    await expect(details.getByText("Address", { exact: true })).toBeVisible();
    await expect(summary.locator(".admin-user-show-less")).toBeVisible();
    await expect(cards.nth(1).locator("details")).not.toHaveAttribute("open");
    expect(await details.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(details).not.toHaveAttribute("open");
    await expect(summary.locator(".admin-user-show-more")).toBeVisible();
    await expect(cards.first().getByRole("button", { name: "Make inactive", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test("consultant date restrictions disable unavailable dates and keep nested calendars viewport-safe", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "consumer-consultation-restricted");
  await page.getByRole("radio").first().check();
  const date = page.getByRole("textbox", { name: "Preferred appointment date *", exact: true });
  await date.fill("26/10/2099"); await date.blur();
  await expect(date).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: /Pay.*book appointment/i })).toBeDisabled();
  await expect(page.getByText("The consultant is not available on this date. Choose an available date.", { exact: true })).toBeVisible();
  await date.fill("25/10/2099");
  await page.getByRole("button", { name: "Open calendar", exact: true }).click();
  const calendar = page.getByRole("dialog", { name: "Choose appointment date" });
  await expect(calendar.getByRole("button", { name: "26/10/2099", exact: true })).toBeDisabled();
  await expect(calendar.getByRole("button", { name: "25/10/2099", exact: true })).toBeEnabled();
  const bounds = await calendar.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await expect(page.locator("body")).toHaveCSS("position", "fixed");
  await calendar.getByRole("button", { name: "25/10/2099", exact: true }).click();
  await expect(calendar).toHaveCount(0);
  await expect(date).toHaveValue("25/10/2099");
  expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  await mount(page, "admin-consultations-restricted");
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Reschedule appointment?" });
  const revised = dialog.getByRole("textbox", { name: "New appointment date *", exact: true });
  await expect(revised).toBeEnabled();
  await revised.fill("26/10/2099"); await revised.blur();
  await expect(dialog.getByRole("button", { name: "Confirm", exact: true })).toBeDisabled();
  await revised.fill("25/10/2099");
  await dialog.getByRole("button", { name: "Open calendar", exact: true }).click();
  await expect(calendar).toBeVisible();
  await calendar.getByRole("button", { name: "Close calendar", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("position", "fixed");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("consultant specific available dates save and reopen without losing legacy preferences", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-consultants");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("spinbutton", { name: /Consultant Charge/ }).fill("900.50");
  await page.getByRole("spinbutton", { name: /Ayursarga Commission/ }).fill("0");
  const editor = page.getByRole("textbox", { name: /Specific available dates/ });
  await editor.fill("25/10/2099");
  await page.getByRole("button", { name: "Add available date", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".consultant-details")).toContainText("25/10/2099");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator('input[name="availableDates"]')).toHaveValue("2099-10-25");
  await page.getByRole("button", { name: "Remove available date 25/10/2099", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".consultant-details")).not.toContainText("25/10/2099");
});

test("consultant designation and preferred availability edit legacy records safely", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-consultants");
  await expect(page.locator(".consultant-details").getByText("Not specified", { exact: true })).toHaveCount(4);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Designation" })).toHaveValue("");
  await page.getByRole("textbox", { name: "Designation" }).fill("Ayurvedic Doctor");
  const charge = page.getByRole("spinbutton", { name: /Consultant Charge/ });
  const commission = page.getByRole("spinbutton", { name: /Ayursarga Commission/ });
  await expect(charge).toHaveValue("");
  await expect(charge).toHaveAttribute("required", "");
  await expect(commission).toHaveAttribute("required", "");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Enter the consultant charge.", { exact: true })).toBeVisible();
  await expect(page.getByText("Enter Ayursarga commission percentage.", { exact: true })).toBeVisible();
  await charge.fill("-1");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(charge).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Enter a valid non-negative charge with up to 2 decimal places.", { exact: true })).toBeVisible();
  await charge.fill("900.50");
  await commission.fill("10");
  await expect(page.locator(".portal-edit-form .portal-form-note").filter({ hasText: "Consumer total:" })).toContainText("₹990.55");
  const inputs = await page.locator('input[name="consultantCharge"], input[name="ayursargaCommissionPercentage"]').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
  if (page.viewportSize()!.width > 700) expect(Math.abs(inputs[0] - inputs[1])).toBeLessThanOrEqual(1);
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
  await expect(page.locator(".consultant-details")).toContainText("₹990.55");
  await expect(page.locator(".consultant-details")).toContainText("10%");
  await expect(page.getByText("Morning: 9:30 AM – 11:45 AM", { exact: true })).toBeVisible();
  await expect(page.getByText("Evening: 3:00 PM – 6:00 PM", { exact: true })).toBeVisible();
  const writes = await page.evaluate(() => (window as unknown as { consumerBookingFixture: { consultantWrites: { designation: string; preferredTimeSlots: string[] }[] } }).consumerBookingFixture.consultantWrites);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ ayursargaCommissionPercentage: 10 });
  expect(writes[0]).toMatchObject({ designation: "Ayurvedic Doctor", consultantCharge: 900.5, consultationServices: ["prenatal-doctor"], preferredTimeSlots: ["morning", "evening"], preferredSlotTimings: { morning: { startTime: "09:30", endTime: "11:45" }, evening: { startTime: "15:00", endTime: "18:00" } } });
  expect(writes[0]).toMatchObject({ preferredDays: ["mon", "wed", "sun"] });
  await expect(page.locator(".consultant-details")).toContainText("Mon · Wed · Sun");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: /Consultant Charge/ })).toHaveValue("900.5");
  await expect(page.getByRole("spinbutton", { name: /Ayursarga Commission/ })).toHaveValue("10");
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

test("hospital deactivation replaces delete in the top card and preserves cancel and confirmation behavior", async ({ page }) => {
  await page.route("**/*", route => route.fulfill({status:204,body:""}));
  await mount(page,"admin-details");
  const overview=page.locator("article.portal-card").first();
  const deactivate=overview.getByRole("button",{name:"Deactivate hospital",exact:true});
  await expect(deactivate).toHaveCount(1);
  await expect(page.getByRole("button",{name:"Deactivate hospital",exact:true})).toHaveCount(1);
  await expect(page.getByRole("button",{name:/Delete hospital|Remove hospital/})).toHaveCount(0);
  await deactivate.click();
  await page.getByRole("dialog").getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(overview.locator(".portal-status")).toHaveText("active");
  await deactivate.click();
  await page.getByRole("dialog").getByRole("button",{name:"Deactivate hospital",exact:true}).click();
  await expect(overview.locator(".portal-status")).toHaveText("inactive");
  await expect(page.getByRole("button",{name:"Deactivate hospital",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Reactivate hospital",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test("destructive dialogs stay red, cancel stays neutral, and scroll is restored", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  for (const [screen, trigger] of [["admin-details", "Deactivate hospital"], ["hospital-services", "Delete"], ["hospital-profile", "Remove centre image 1"], ["admin-audits", "Clear all audits"]]) {
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

test("Account security audit outcomes are readable and filterable", async ({ page }) => {
  await page.route("**/*", route => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-security-audits");
  await expect(page.getByText("Authenticator replacement", { exact: true })).toHaveCount(3);
  await expect(page.getByText("Started: previous Admin sessions blocked; replacement in progress", { exact: true })).toBeVisible();
  await expect(page.getByText("Completed: sign in to set up the new authenticator", { exact: true })).toBeVisible();
  await expect(page.getByText("Outcome unknown: project owner review required before retrying", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Area", exact: true }).selectOption("adminSecurity");
  await expect(page.getByText("Authenticator replacement", { exact: true })).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Admin audit clearing requires both password and authenticator code before reauthentication or deletion", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await mount(page, "admin-audits");
  await page.getByRole("button", { name: "Clear all audits", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Admin password", { exact: true }).fill("synthetic-password1");
  await dialog.getByRole("button", { name: "Clear audit history", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("six-digit authenticator code");
  expect(await page.evaluate(() => (window as unknown as { auditMfaCalls: { clears: number } }).auditMfaCalls.clears)).toBe(0);
  await dialog.getByLabel("Authenticator code", { exact: true }).fill("123456");
  await dialog.getByRole("button", { name: "Clear audit history", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const calls = await page.evaluate(() => (window as unknown as { auditMfaCalls: { reauth: string[][]; clears: number } }).auditMfaCalls);
  expect(calls.reauth).toEqual([["synthetic-password1", "123456"]]); expect(calls.clears).toBe(1);
});

test("both portals pulse only for new notifications and stop when viewed without changing unread counts", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const screen of ["admin-dashboard", "hospital-dashboard"]) {
    await mount(page, screen);
    const bell = page.locator(".portal-notification-trigger");
    await expect(bell).not.toHaveAttribute("data-attention");
    const normalBackground = await bell.evaluate(element => getComputedStyle(element).backgroundColor);
    const deliver = (ids: string[]) => page.evaluate((ids) => {
      window.dispatchEvent(new CustomEvent("portal-test-notifications", { detail: ids.map((id) => ({
        id, readAt: null, title: "New notification", message: "Update", actionHref: "#", createdAt: { seconds: 100, nanoseconds: 0 },
      })) }));
    }, ids);
    await deliver(["notification", "fresh"]);
    await expect(bell).toHaveAttribute("data-attention", "true");
    await expect(bell).not.toHaveCSS("background-color", normalBackground);
    await expect(bell).toHaveCSS("color", "rgb(255, 255, 255)");
    const highlightedBackground = "rgb(31, 61, 43)";
    await expect(bell).toHaveCSS("background-color", highlightedBackground);
    await deliver(["notification", "fresh"]);
    await expect(bell).toHaveAttribute("data-attention", "true");
    await expect(bell).toHaveCSS("background-color", highlightedBackground);
    await expect(bell.locator("svg")).toHaveCSS("animation-name", "portal-notification-pulse");
    await expect(bell.locator("svg")).toHaveCSS("animation-duration", "2.4s");
    await expect.poll(() => bell.locator("svg").evaluate((element) => Number(getComputedStyle(element).opacity))).toBeLessThan(.95);
    await expect(bell.locator(".portal-notification-count")).toHaveText("2");
    await expect(bell.locator(".portal-notification-count")).toHaveCSS("animation-name", "portal-notification-pulse");
    await bell.click();
    await expect(bell).not.toHaveAttribute("data-attention");
    await expect(bell).not.toHaveCSS("background-color", highlightedBackground);
    await expect(bell.locator(".portal-notification-count")).toHaveText("2");
    await deliver(["notification", "fresh", "viewed-live"]);
    await expect(bell).not.toHaveAttribute("data-attention");
    await page.keyboard.press("Escape");
    await deliver(["notification", "fresh", "viewed-live"]);
    await expect(bell).not.toHaveAttribute("data-attention");
    await deliver(["notification", "fresh", "viewed-live", "latest"]);
    await expect(bell).toHaveAttribute("data-attention", "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(bell.locator("svg")).toHaveCSS("animation-name", "none");
    await expect(bell).toHaveCSS("background-color", highlightedBackground);
    await expect(bell).toHaveCSS("outline-style", "solid");
    // Keyboard focus may legitimately use the stronger shared 3px outline.
    expect(await bell.evaluate((element) => parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2);
    await deliver([]);
    await expect(bell).not.toHaveAttribute("data-attention");
    await expect(bell.locator(".portal-notification-count")).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
});

test("optional indicators stay inline with their field labels", async ({ page }) => {
  await page.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  for (const [screen, action] of [
    ["admin-hospitals", "Add Hospital"],
    ["admin-consultants", "Edit"],
    ["hospital-services", "Edit package"],
    ["admin-billing", "New commission invoice"],
  ]) {
    await mount(page, screen);
    if (action) await page.getByRole("button", { name: action, exact: true }).first().click();
    const labels = page.locator(".portal-field-label:visible");
    await expect(labels.first()).toBeVisible();
    for (const label of await labels.all()) {
      expect(await label.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element.firstChild!);
        const text = range.getBoundingClientRect();
        const marker = element.querySelector("small")!.getBoundingClientRect();
        return marker.top < text.bottom && marker.bottom > text.top;
      })).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
