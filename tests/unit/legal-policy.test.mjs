import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

test("online consultation cancellation policy contains the approved replacement, not the old wording", () => {
  const raw = readFileSync("content/legal-documents.json", "utf8");
  assert.notEqual(raw.charCodeAt(0), 0xfeff, "JSON must remain BOM-free");
  const blocks = JSON.parse(raw)["cancellation-refund-policy"].blocks;
  const index = blocks.findIndex((block) => block.text === "Online Consultation Cancellation & Refund Policy");
  assert.ok(index >= 0);
  assert.equal(blocks[index].style, "Heading2");
  assert.deepEqual(blocks.slice(index + 1, index + 4).map((block) => block.text), [
    "Customers may cancel a confirmed online consultation at least 48 hours prior to the scheduled consultation time and shall be entitled to a 100% refund of the amount paid.",
    "Cancellations received less than 48 hours before the scheduled consultation time shall not be eligible for a refund, except in exceptional circumstances approved by Ayursarga or as required under applicable law.",
    "All eligible refunds shall be processed through the original payment method in accordance with Ayursarga's applicable refund procedures.",
  ]);
  assert.equal(blocks[index + 4].text, "Rescheduling");
  assert.ok(!blocks.some((block) => block.text.startsWith("Customers may cancel a scheduled online consultation subject to")));
});

test("updated booking consent is versioned without changing profile-completion consent", () => {
  const consent = loadTypeScript("features/consumers/privacyConsent.ts");
  assert.equal(consent.BOOKING_TERMS_VERSION, "2026-10-27");
  assert.equal(consent.CUSTOMER_TERMS_VERSION, "2026-09-23");
  assert.equal(consent.CONSUMER_PRIVACY_NOTICE_VERSION, "2026-09-23");
});
