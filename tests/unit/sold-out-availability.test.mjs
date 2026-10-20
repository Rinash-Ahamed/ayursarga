import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
const { isHospitalSoldOut, isHospitalUnavailable } = loadTypeScript("features/hospitals/availability.ts", { "firebase/firestore": {} });
const timestamp = (value) => ({ toDate: () => new Date(`${value}T00:00:00+05:30`) });
const hospital = { blockedDateRanges: [{ startDate: timestamp("2099-10-25"), endDate: timestamp("2099-10-27") }] };
test("approved blocks mark all inclusive selected care dates sold out", () => {
  assert.equal(isHospitalSoldOut(hospital, "2099-10-25"), true);
  assert.equal(isHospitalSoldOut(hospital, "2099-10-27"), true);
  assert.equal(isHospitalUnavailable(hospital, "2099-10-24", "2099-10-28"), true);
  assert.equal(isHospitalSoldOut(hospital, "2099-10-28"), false);
  assert.equal(isHospitalSoldOut(hospital, "2099-10-24"), false);
});
test("without selected dates, sold out is based on today's date in India", () => {
  assert.equal(isHospitalSoldOut(hospital, "", "", new Date("2099-10-24T20:00:00Z")), true);
  assert.equal(isHospitalSoldOut(hospital, "", "", new Date("2099-10-27T20:00:00Z")), false);
});
test("pending/rejected requests have no active range and revoking clears sold out", () => {
  assert.equal(isHospitalSoldOut({}, "2099-10-25"), false);
  assert.equal(isHospitalSoldOut({ blockedDateRanges: [] }, "2099-10-25"), false);
  assert.equal(isHospitalSoldOut(hospital, "2099-10-25"), true);
  assert.equal(isHospitalSoldOut({ ...hospital, blockedDateRanges: [] }, "2099-10-25"), false);
});
