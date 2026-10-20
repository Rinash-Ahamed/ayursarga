import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

function fixture(services = [{ id: "package", hospitalId: "hospital", packageDurationDays: 14 }]) {
  const reads = [];
  const { withPortalBookingDetails } = loadTypeScript("services/bookings/portalBookingDetails.ts", {
    "@/services/firestore/firestoreService": { readDocumentsByIds: async (collection, ids, filters = []) => {
      reads.push({ collection, ids, filters });
      return collection === "hospitals" ? [{ id: "hospital", name: "Centre name", city: "Palakkad", district: "Palakkad", state: "Kerala" }] : services;
    } },
  });
  return { reads, resolve: withPortalBookingDetails };
}
const booking = { id: "booking", hospitalId: "hospital", serviceId: "package", servicePrice: 28000, estimatedCommission: 5600 };
test("legacy operational bookings resolve centre/package labels without modifying financial snapshots", async () => {
  const f = fixture();
  const result = await f.resolve({ documents: [booking], cursor: "cursor", hasMore: true }, "hospital");
  assert.equal(result.documents[0].hospitalName, "Centre name");
  assert.equal(result.documents[0].serviceName, "14-day package");
  assert.equal(result.documents[0].hospitalLocation, "Palakkad, Kerala");
  assert.equal(result.documents[0].servicePrice, 28000);
  assert.equal(result.documents[0].estimatedCommission, 5600);
  assert.equal(result.cursor, "cursor");
  assert.equal(result.hasMore, true);
  assert.deepEqual(f.reads[1].filters, [{ field: "hospitalId", operator: "==", value: "hospital" }]);
  assert.equal(booking.hospitalName, undefined);
});
test("snapshotted labels require no extra requests and are never replaced", async () => {
  const f = fixture();
  const page = { documents: [{ ...booking, hospitalName: "Original centre", serviceName: "Original package" }] };
  assert.equal(await f.resolve(page), page);
  assert.equal(f.reads.length, 0);
});
test("a package belonging to another hospital is not used as a fallback", async () => {
  const f = fixture([{ id: "package", hospitalId: "other-hospital", packageDurationDays: 7 }]);
  const result = await f.resolve({ documents: [booking] });
  assert.equal(result.documents[0].serviceName, undefined);
});
