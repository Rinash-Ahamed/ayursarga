import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

test("Ayursarga phone display, dial link and WhatsApp destination use the same new number", () => {
  const { AYURSARGA_PHONE } = loadTypeScript("config/contact.ts");
  assert.equal(AYURSARGA_PHONE.display, "+91 97 455 666 97");
  assert.equal(AYURSARGA_PHONE.href, "tel:+919745566697");
  assert.equal(AYURSARGA_PHONE.whatsappUrl, "https://wa.me/919745566697");
  assert.equal(AYURSARGA_PHONE.display.replace(/\s/g, ""), AYURSARGA_PHONE.href.slice(4));
});

test("public and Consumer contact surfaces and the contract reuse the shared number", () => {
  for (const file of ["components/Footer.tsx", "components/Contact.tsx", "components/consumer/ConsumerSupport.tsx", "components/WhatsAppBubble.tsx", "features/hospitals/partnerContractTemplate.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /import \{ AYURSARGA_PHONE \} from "@\/config\/contact"/);
    assert.match(source, /AYURSARGA_PHONE\.display/);
    assert.doesNotMatch(source, /8086070680|80860 70680|97455 66687/);
  }
});

test("all four legal pages use the corrected contact and remain valid BOM-free JSON", () => {
  const raw = readFileSync("content/legal-documents.json", "utf8");
  assert.notEqual(raw.charCodeAt(0), 0xfeff);
  const documents = JSON.parse(raw);
  assert.equal(Object.keys(documents).length, 4);
  for (const document of Object.values(documents)) {
    assert.equal(document.blocks.filter((block) => block.text.includes("+91 97 455 666 97")).length, 1);
  }
  assert.doesNotMatch(raw, /8086070680|97455 66687/);
});
