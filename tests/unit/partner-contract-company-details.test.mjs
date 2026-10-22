import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

test("partner contract renders Ayursarga's confirmed GSTIN", () => {
  const { AYURSARGA_GSTIN } = loadTypeScript("features/hospitals/ayursargaCompanyDetails.ts");
  const { buildHospitalContractHtml } = loadTypeScript("features/hospitals/partnerContractTemplate.ts");
  const html = buildHospitalContractHtml({
    id: "hospital-test",
    name: "Test Centre",
    legalName: "Test Centre Private Limited",
    email: "centre@example.com",
    phone: "9999999999",
    hospitalPhone1: "8888888888",
    address: "Service address",
    registeredAddress: "Registered address",
    registrationNumber: "REG001",
    cinNumber: "U12345KL2026PTC000001",
    panNumber: "ABCDE1234F",
    gstin: "32ABCDE1234F1Z5",
    commissionPercentage: 10,
    contractEffectiveDate: "2026-10-22",
    contractExpiryDate: "2029-10-22",
    emergencyContact: "7777777777",
    emergencyReferralHospital: "Nearby hospital",
  });

  assert.equal(AYURSARGA_GSTIN, "32ABGCA7749G1ZL");
  assert.match(html, /GSTIN: 32ABGCA7749G1ZL/);
  assert.doesNotMatch(html, /GSTIN TO BE UPDATED/);
});
