import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
const { consultantDisplayName, CONSULTANT_TITLES } = loadTypeScript("features/consultants/name.ts");
const { validateConsultantFields, consultantFormValues } = loadTypeScript("features/consultants/validation.ts");
const fields = { name: "Shafna", email: "doctor@example.test", contactNo: "9876543210", whatsappNo: "9876543210", qualification: "BAMS", yearsExperience: 3, consultantCharge: 300, ayursargaCommissionPercentage: 10 };

test("optional titles validate, parse, format without duplicates and preserve untitled legacy names", () => {
  for (const title of CONSULTANT_TITLES) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ ...fields, title })) form.set(key, String(value));
    const result = validateConsultantFields(consultantFormValues(form));
    assert.equal(result.isValid, true);
    assert.equal(result.data.title, title);
    assert.equal(consultantDisplayName(result.data), `${title} Shafna`);
  }
  assert.equal(Object.hasOwn(validateConsultantFields(fields).data, "title"), false);
  assert.equal(validateConsultantFields({ ...fields, title: "" }).isValid, true);
  assert.equal(consultantDisplayName({ name: "Dr. Shafna", title: "Dr." }), "Dr. Shafna");
  assert.equal(consultantDisplayName({ name: "Shafna" }), "Shafna");
  for (const title of ["Professor", 1, {}, null, "Dr.<script>"]) assert.equal(validateConsultantFields({ ...fields, title }).isValid, false);
});

test("public discovery returns titled identity for booking snapshots without exposing private fields", () => {
  const { publicConsultantProjection } = loadTypeScript("features/consultations/publicProjection.ts");
  const result = publicConsultantProjection("AS001", { ...fields, title: "Dr.", status: "active", consultationServices: ["prenatal-doctor"], preferredTimeSlots: ["morning"] }, "prenatal-doctor");
  assert.equal(result.name, "Dr. Shafna");
  for (const key of ["email", "contactNo", "whatsappNo", "ayursargaCommissionPercentage"]) assert.equal(Object.hasOwn(result, key), false);
});

test("shared photo helper validates before sending and preserves the revision header", async () => {
  const calls = [];
  const service = loadTypeScript("services/consultants/consultantService.ts", {
    "@/services/api/client": { authorizedApiRequest: async (...args) => { calls.push(args); return { imageUrl: "https://test.local/photo.webp" }; } },
    "@/services/firestore/statusOrderedQuery": {},
  });
  const file = new File(["photo"], "photo.png", { type: "image/png" });
  assert.equal(await service.uploadConsultantPhoto("AS001", file, "old-photo"), "https://test.local/photo.webp");
  assert.equal(calls[0][0], "/api/admin/consultants/AS001/image");
  assert.equal(calls[0][1].headers["X-Expected-Image-Url"], "old-photo");
  assert.equal(calls[0][1].body, file);
  for (const invalid of [new File(["svg"], "x.svg", { type: "image/svg+xml" }), new File([], "empty.png", { type: "image/png" }), { type: "image/jpeg", size: 9 * 1024 * 1024 }]) await assert.rejects(service.uploadConsultantPhoto("AS001", invalid), /JPG, PNG or WebP/);
  assert.equal(calls.length, 1);
});
