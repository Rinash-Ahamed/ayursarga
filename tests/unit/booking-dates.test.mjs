import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const { bookingDateFacts, formatBookingPlacedAt } = loadTypeScript("features/bookings/display.ts");
const booking = {
  createdAt: new Date("2026-10-27T20:30:00Z"), // Already 28 October in India.
  preferredDate: "2027-01-07", confirmedDate: "2027-01-07",
  confirmedTime: null, status: "confirmed",
};

test("Booked on uses creation in India time, not the future care or confirmation date", () => {
  assert.deepEqual(bookingDateFacts({ ...booking, confirmedAt: new Date("2026-10-30") }), [
    { label: "Booked on", value: "28/10/2026, 02:00 am IST" },
  ]);
  assert.deepEqual(bookingDateFacts({ ...booking, createdAt: { toDate: () => booking.createdAt } }), [
    { label: "Booked on", value: "28/10/2026, 02:00 am IST" },
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
    assert.deepEqual(bookingDateFacts(record), [{ label: "Booked on", value: "28/10/2026, 02:00 am IST" }]);
    assert.deepEqual(record, before);
  }
});

test("both booking flows share an explicit India timestamp independent of device timezone", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ["UTC", "Asia/Kolkata", "America/Los_Angeles", "Pacific/Auckland"]) {
      process.env.TZ = zone;
      assert.equal(formatBookingPlacedAt("2026-10-27T20:30:00Z"), "28/10/2026, 02:00 am IST");
      assert.equal(formatBookingPlacedAt("2026-10-27T09:15:00Z"), "27/10/2026, 02:45 pm IST");
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("legacy date-only records never display an invented booking time", () => {
  assert.equal(formatBookingPlacedAt("2026-10-27"), "27/10/2026 (time not recorded)");
  assert.equal(formatBookingPlacedAt("05/11/2026"), "05/11/2026 (time not recorded)");
  assert.equal(formatBookingPlacedAt("2026-02-30"), "Not recorded");
  assert.equal(formatBookingPlacedAt("31/02/2026"), "Not recorded");
  assert.equal(formatBookingPlacedAt(new Date("invalid")), "Not recorded");
});
