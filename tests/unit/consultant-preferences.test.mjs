import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
const { validateConsultantFields, consultantFormValues, formatConsultantTimeSlot } = loadTypeScript("features/consultants/validation.ts");
const legacy = { name: "Doctor Sample", email: "doctor@example.com", contactNo: "9876543210", whatsappNo: "9876543210", qualification: "BAMS", yearsExperience: 3.5 };
test("legacy consultants default to optional empty preferences", () => {
  const result = validateConsultantFields(legacy);
  assert.equal(result.isValid, true);
  assert.equal(result.data.designation, "");
  assert.deepEqual(result.data.preferredTimeSlots, []);
});
test("designation and multi-select preferences survive form parsing in canonical order", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries(legacy)) form.set(key, String(value));
  form.set("designation", "  Ayurvedic Doctor  ");
  form.append("preferredTimeSlots", "evening");
  form.append("preferredTimeSlots", "morning");
  const result = validateConsultantFields(consultantFormValues(form));
  assert.equal(result.isValid, true);
  assert.equal(result.data.designation, "Ayurvedic Doctor");
  assert.deepEqual(result.data.preferredTimeSlots, ["morning", "evening"]);
});
test("invalid, duplicate or non-array preferences and oversized designation are rejected", () => {
  for (const preferredTimeSlots of ["morning", ["night"], ["morning", "morning"], [null], {}]) {
    assert.equal(validateConsultantFields({ ...legacy, preferredTimeSlots }).isValid, false);
  }
  assert.equal(validateConsultantFields({ ...legacy, designation: "x".repeat(121) }).isValid, false);
  assert.equal(validateConsultantFields({ ...legacy, preferredTimeSlots: ["morning", "noon", "evening"] }).isValid, true);
});
test("custom consultant times persist and format without locale or timezone changes", () => {
  const preferredSlotTimings = { morning: { startTime: "09:30", endTime: "11:45" }, noon: { startTime: "12:15", endTime: "14:30" } };
  const result = validateConsultantFields({ ...legacy, preferredTimeSlots: ["morning", "noon"], preferredSlotTimings });
  assert.equal(result.isValid, true);
  assert.deepEqual(result.data.preferredSlotTimings, preferredSlotTimings);
  assert.equal(formatConsultantTimeSlot("morning", result.data.preferredSlotTimings), "Morning: 9:30 AM – 11:45 AM");
});
test("invalid, reversed and unselected timing entries are rejected", () => {
  for (const timing of [null, "09:30", {}, { startTime: "", endTime: "12:00" }, { startTime: "25:00", endTime: "12:00" }, { startTime: "12:00", endTime: "09:00" }, { startTime: "09:00", endTime: "09:00" }]) {
    assert.equal(validateConsultantFields({ ...legacy, preferredTimeSlots: ["morning"], preferredSlotTimings: { morning: timing } }).isValid, false);
  }
  assert.equal(validateConsultantFields({ ...legacy, preferredTimeSlots: [], preferredSlotTimings: { morning: { startTime: "09:00", endTime: "12:00" } } }).isValid, false);
});
