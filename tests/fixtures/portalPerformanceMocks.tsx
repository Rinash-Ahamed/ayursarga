export const counters = { reads: 0, writes: 0, fail: false };
let record = { id: "test-hospital", hospitalId: "test-hospital", totalRooms: 10, occupiedRooms: 2, status: "active" };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export async function getHospitalCapacity() {
  counters.reads++;
  await wait(200);
  return { ...record };
}
export async function saveHospitalCapacity(_id: string, input: { totalRooms: number; occupiedRooms: number }) {
  counters.writes++;
  await wait(150);
  if (counters.fail) throw new Error("Test save failed");
  record = { ...record, ...input };
  return { ok: true, changes: { ...record } };
}
