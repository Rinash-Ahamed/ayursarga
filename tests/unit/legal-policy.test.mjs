import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
import { consultationPaymentFixture, prepare, verify } from "../helpers/consultationPaymentFixture.mjs";

test("online consultation cancellation policy contains the approved replacement, not the old wording", () => {
  const raw = readFileSync("content/legal-documents.json", "utf8");
  assert.notEqual(raw.charCodeAt(0), 0xfeff, "JSON must remain BOM-free");
  const blocks = JSON.parse(raw)["cancellation-refund-policy"].blocks;
  const index = blocks.findIndex((block) => block.text === "Online Consultation Cancellation & Refund Policy");
  assert.ok(index >= 0);
  assert.equal(blocks[index].style, "Heading2");
  assert.deepEqual(blocks.slice(index + 1, index + 4).map((block) => block.text), [
    "Customers may cancel a confirmed online consultation at least 24 hours prior to the scheduled consultation time and shall be entitled to a 100% refund of the amount paid.",
    "Cancellations received less than 24 hours before the scheduled consultation time shall not be eligible for a refund, except in exceptional circumstances approved by Ayursarga or as required under applicable law.",
    "All eligible refunds shall be processed through the original payment method in accordance with Ayursarga's applicable refund procedures.",
  ]);
  assert.equal(blocks[index + 4].text, "Rescheduling");
  assert.ok(!blocks.some((block) => block.text.startsWith("Customers may cancel a scheduled online consultation subject to")));
});

test("updated booking consent is versioned without changing profile-completion consent", () => {
  const consent = loadTypeScript("features/consumers/privacyConsent.ts");
  assert.equal(consent.BOOKING_TERMS_VERSION, "2026-11-02-r2");
  assert.equal(consent.CUSTOMER_TERMS_VERSION, "2026-09-23");
  assert.equal(consent.CONSUMER_PRIVACY_NOTICE_VERSION, "2026-09-23");
});

test("published consultation rescheduling matches the one-time 24-hour workflow without changing cancellation refunds", () => {
  const blocks = JSON.parse(readFileSync("content/legal-documents.json", "utf8"))["cancellation-refund-policy"].blocks;
  const index = blocks.findIndex(block => block.text === "Rescheduling");
  assert.ok(index >= 0);
  assert.equal(blocks[index].style, "Heading2");
  const text = blocks.slice(index + 1, index + 4).map(block => block.text).join(" ");
  assert.match(text, /confirmed online consultation once/);
  assert.match(text, /at least 24 hours before the scheduled appointment start time \(Indian Standard Time\)/);
  assert.match(text, /same consultant and service and is subject to availability/);
  assert.match(text, /existing payment remains applied/);
  assert.match(text, /no additional payment required/);
  assert.match(text, /agreed cancellation policy remains unchanged/);
  assert.match(text, /deadlines recalculated from the updated appointment time/);
  assert.match(text, /original appointment remains reserved until the change is confirmed/);
  assert.match(text, /contact Ayursarga for assistance/);
  assert.equal(blocks[index + 4].text, "No-Show");
  assert.ok(!blocks.some(block => block.text.includes("Repeated or last-minute rescheduling may be treated as a cancellation")));
  assert.ok(blocks.some(block => block.text === "LAST UPDATED\n02/11/2026"));
});

test("new checkout records the revised terms while capture preserves an already quoted terms version", async () => {
  const f = consultationPaymentFixture();
  const response = await prepare(f);
  assert.equal(response.status, 200);
  const checkout = (await response.json()).checkout;
  const intent = f.records.get(`consultationPaymentIntents/${checkout.intentId}`);
  assert.equal(intent.draft.bookingTermsVersion, "2026-11-02-r2");
  intent.draft.bookingTermsVersion = "2026-11-02";
  f.capture(checkout);
  assert.equal((await verify(f, checkout.intentId)).status, 200);
  assert.equal(f.records.get(`consultationBookings/${checkout.intentId}`).bookingTermsVersion, "2026-11-02");
});
