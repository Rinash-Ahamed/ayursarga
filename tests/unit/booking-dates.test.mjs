import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const { bookingDateFacts } = loadTypeScript("features/bookings/display.ts");
const booking = {
  createdAt: new Date("2026-10-27T20:30:00Z"), // Already 28 October in India.
  preferredDate: "2027-01-07", confirmedDate: "2027-01-07",
  confirmedTime: null, status: "confirmed",
};

test("Booked on uses creation in India time, not the future care or confirmation date", () => {
  assert.deepEqual(bookingDateFacts({ ...booking, confirmedAt: new Date("2026-10-30") }), [
    { label: "Booked on", value: "28/10/2026" },
  ]);
  assert.deepEqual(bookingDateFacts({ ...booking, createdAt: { toDate: () => booking.createdAt } }), [
    { label: "Booked on", value: "28/10/2026" },
  ]);
});

test("legacy missing creation dates are not fabricated from confirmed or preferred dates", () => {
  for (const createdAt of [null, undefined, "", "invalid"]) {
    assert.equal(bookingDateFacts({ ...booking, createdAt })[0].value, "Not recorded");
  }
});

test("different schedules, exact times and historical proposals remain visible", () => {
  assert.deepEqual(bookingDateFacts({ ...booking, confirmedDate: "2027-01-09", confirmedTime: "10:30" })[1], {
    label: "Scheduled care date", value: "09/01/2027 · 10:30",
  });
  assert.deepEqual(bookingDateFacts({ ...booking, confirmedTime: "11:00" })[1], {
    label: "Scheduled care date", value: "07/01/2027 · 11:00",
  });
  assert.deepEqual(bookingDateFacts({ ...booking, status: "reschedule_requested" })[1], {
    label: "Proposed care date", value: "07/01/2027",
  });
});

test("cancelled/completed/requested history retains placement date without mislabelling it confirmed", () => {
  for (const status of ["cancelled", "completed", "requested"]) {
    const record = { ...booking, status };
    const before = { ...record };
    assert.deepEqual(bookingDateFacts(record), [{ label: "Booked on", value: "28/10/2026" }]);
    assert.deepEqual(record, before);
  }
});
