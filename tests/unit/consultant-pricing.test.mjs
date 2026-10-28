import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const { getConsultantPricing, parseConsultantCommission } = loadTypeScript("features/consultants/pricing.ts");
const { validateConsultantFields } = loadTypeScript("features/consultants/validation.ts");
const valid = { name: "Sample Doctor", email: "doctor@example.com", contactNo: "9876543210", whatsappNo: "9876543210", qualification: "BAMS", yearsExperience: 3, consultantCharge: 1000, ayursargaCommissionPercentage: 10 };

test("commission is added to the base charge with integer paise and half-up rounding", () => {
  assert.deepEqual(getConsultantPricing("1000.00", "10"), { baseCharge: 1000, commissionPercentage: 10, commissionAmount: 100, totalCharge: 1100 });
  assert.deepEqual(getConsultantPricing(900.5, 10), { baseCharge: 900.5, commissionPercentage: 10, commissionAmount: 90.05, totalCharge: 990.55 });
  assert.equal(getConsultantPricing(0.01, 50).totalCharge, 0.02);
  assert.equal(getConsultantPricing(0.29, 100).totalCharge, 0.58);
  assert.equal(getConsultantPricing(0, 0).totalCharge, 0);
  assert.equal(getConsultantPricing(999.99, 12.5).totalCharge, 1124.99);
});

test("missing/invalid commission is rejected while explicit zero is a valid required entry", () => {
  for (const value of [undefined, null, "", " ", -1, 100.01, NaN, Infinity, "10.001", "1e1", true, {}, []]) {
    assert.equal(parseConsultantCommission(value), null);
    const result = validateConsultantFields({ ...valid, ayursargaCommissionPercentage: value });
    assert.equal(result.isValid, false);
    assert.ok(result.errors.ayursargaCommissionPercentage);
  }
  for (const value of [0, "0", 10, 12.34, 100]) {
    assert.equal(validateConsultantFields({ ...valid, ayursargaCommissionPercentage: value }).isValid, true);
  }
});

test("unrepresentable totals and fractional paise are never silently rounded or saved", () => {
  assert.equal(getConsultantPricing("90071992547409.91", 100), null);
  assert.equal(getConsultantPricing("90071992547409.91", 0), null);
  assert.equal(validateConsultantFields({ ...valid, consultantCharge: "90071992547409.91", ayursargaCommissionPercentage: 0 }).isValid, false);
  assert.equal(getConsultantPricing("1.001", 10), null);
  assert.equal(validateConsultantFields({ ...valid, consultantCharge: "90071992547409.91", ayursargaCommissionPercentage: 100 }).isValid, false);
});
