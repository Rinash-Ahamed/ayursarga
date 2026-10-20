import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
const { formatDisplayDate, formatDisplayDateTime, parseDisplayDate, toDateInputValue, isIsoDate, parseDateInputValue, getCalendarMonthRange, formatDateMentions } = loadTypeScript("utils/date.ts");
test("strict DD/MM/YYYY parsing never reverses month and day", () => {
  assert.equal(parseDisplayDate("05/11/2026"), "2026-11-05");
  assert.equal(parseDisplayDate("11/05/2026"), "2026-05-11");
  assert.equal(parseDisplayDate("29/02/2028"), "2028-02-29");
  for (const value of ["29/02/2026", "31/04/2026", "00/11/2026", "05/13/2026", "5/11/2026", "2026-11-05", "garbage"]) assert.equal(parseDisplayDate(value), null);
  assert.equal(isIsoDate("2026-02-30"), false);
});
test("calendar month filtering and date serialization use India boundaries", () => {
  const date = parseDateInputValue("2026-11-05");
  assert.equal(date.toISOString(), "2026-11-04T18:30:00.000Z");
  assert.equal(toDateInputValue(date), "2026-11-05");
  const range = getCalendarMonthRange(date);
  assert.equal(range.start.toISOString(), "2026-10-31T18:30:00.000Z");
  assert.equal(range.end.toISOString(), "2026-11-30T18:30:00.000Z");
  assert.equal(parseDateInputValue("2026-02-30"), null);
});
test("existing notification labels format dates without data migration", () => {
  assert.equal(formatDateMentions("Dates: 5 Nov 2026 to 2026-11-12"), "Dates: 05/11/2026 to 12/11/2026");
  assert.equal(formatDateMentions("1/2/2026"), "01/02/2026");
  assert.equal(formatDateMentions("No date provided"), "No date provided");
});
test("display uses zero-padding, preserves date-only values and supports timestamps", () => {
  assert.equal(formatDisplayDate("2026-11-05"), "05/11/2026");
  assert.equal(formatDisplayDate("2026-01-02"), "02/01/2026");
  assert.equal(formatDisplayDate({ toDate: () => new Date("2026-11-04T18:30:00Z") }), "05/11/2026");
  assert.equal(formatDisplayDate("2026-02-30", "Invalid"), "Invalid");
  assert.equal(formatDisplayDate(undefined), "");
  assert.equal(formatDisplayDate(""), "");
});
test("India care dates do not shift around UTC midnight or browser timezones", () => {
  assert.equal(toDateInputValue(new Date("2026-11-04T20:00:00Z")), "2026-11-05");
  assert.equal(formatDisplayDateTime(new Date("2026-11-04T20:00:00Z")).slice(0, 10), "05/11/2026");
  for (const zone of ["UTC", "Asia/Kolkata", "America/Los_Angeles", "Pacific/Auckland"]) {
    const previous = process.env.TZ;
    process.env.TZ = zone;
    try { assert.equal(formatDisplayDate("2026-11-05"), "05/11/2026"); } finally { if (previous) process.env.TZ = previous; else delete process.env.TZ; }
  }
});

test("booking clients keep ISO API dates despite DD/MM/YYYY display and overseas browser timezone", async () => {
  const requests = [];
  const service = loadTypeScript("services/bookings/bookingService.ts", {
    "firebase/firestore": {},
    "@/services/firestore/firestoreService": {},
    "@/services/firestore/auditService": {},
    "@/services/api/client": {
      authorizedApiRequest: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return {}; },
      authorizedMutationRequest: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return {}; },
    },
  });
  const previous = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    await service.createBookingRequest({ hospitalId: "hospital", serviceId: "service", preferredDate: parseDateInputValue("2099-11-05"), preferredEndDate: parseDateInputValue("2099-11-12"), bystanderCount: 1, bookingTermsAccepted: true, requestId: "test-request" });
    service.updateHospitalBooking("booking", { status: "confirmed", confirmedDate: parseDateInputValue("2099-11-05"), confirmedTime: "10:00" });
    assert.equal(requests[0].body.preferredDate, "2099-11-05");
    assert.equal(requests[0].body.preferredEndDate, "2099-11-12");
    assert.equal(requests[1].body.confirmedDate, "2099-11-05");
  } finally { if (previous) process.env.TZ = previous; else delete process.env.TZ; }
});
