import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const { getTreatmentProgress, getTreatmentStatus, treatmentStatusLabel, TREATMENT_PROGRESS_STEPS } = loadTypeScript("features/bookings/treatmentStatus.ts");

test("three visible treatment stages correctly map all existing stored states", () => {
  assert.deepEqual(TREATMENT_PROGRESS_STEPS, ["Yet to be started", "Ongoing", "Completed"]);
  for (const [status, index, label] of [["not_started", 0, "Yet to be started"], ["started", 1, "Ongoing"], ["ongoing", 1, "Ongoing"], ["completed", 2, "Completed"]]) {
    assert.deepEqual(getTreatmentProgress(status), { index, label });
  }
});

test("legacy completion and missing progress resolve correctly without modifying saved states", () => {
  for (const [booking, expected] of [
    [{ status: "completed", treatmentStatus: "started" }, "Completed"],
    [{ status: "confirmed" }, "Yet to be started"],
    [{ status: "confirmed", treatmentStatus: "unknown" }, "Yet to be started"],
    [{ status: "confirmed", treatmentStatus: "started" }, "Ongoing"],
    [{ status: "confirmed", treatmentStatus: "ongoing" }, "Ongoing"],
  ]) {
    const before = { ...booking };
    assert.equal(getTreatmentProgress(getTreatmentStatus(booking)).label, expected);
    assert.deepEqual(booking, before);
  }
});

test("Hospital action badges preserve their existing wording", () => {
  assert.equal(treatmentStatusLabel("started"), "Treatment Started");
  assert.equal(treatmentStatusLabel("completed"), "Treatment completed");
});
