import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
import { bookingFlowFixture, bookingTestRequest } from "../helpers/bookingFlowFixture.mjs";
import { consultationPaymentFixture, prepare, verify } from "../helpers/consultationPaymentFixture.mjs";

test("all API methods share timing and the single deployment region stays next to Firestore", () => {
  assert.deepEqual(JSON.parse(readFileSync("vercel.json", "utf8")).regions, ["bom1"]);
  const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(`${path}/${entry.name}`) : entry.name === "route.ts" ? [`${path}/${entry.name}`] : []);
  for (const path of walk("app/api")) {
    const source = readFileSync(path, "utf8");
    const handlers = [...source.matchAll(/(?:async )?function handle(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS)\(/g)];
    assert.ok(handlers.length, path);
    for (const [,method] of handlers) assert.match(source, new RegExp(`export const ${method} = withApiTiming\\("${method} /api/`), path);
    assert.doesNotMatch(source, /export (?:async )?function (GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS)\(/, path);
  }
});

test("timing retains status/body and isolates stages for simultaneous requests including rejected checks", async () => {
  const { withApiTiming, timeApiStep } = loadTypeScript("services/api/timing.ts");
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const authRoute = withApiTiming("GET /api/test/[id]", async () => {
    await timeApiStep("auth", () => gate);
    return Response.json({ error: "Denied" }, { status: 403, headers: { "cache-control": "no-store" } });
  });
  const other = withApiTiming("GET /api/other", async () => {
    await timeApiStep("database", async () => {});
    return Response.json({ ok: true });
  });
  const pending = authRoute();
  const second = await other();
  assert.match(second.headers.get("server-timing"), /total;dur=\d+\.\d/);
  assert.match(second.headers.get("server-timing"), /database;dur=/);
  assert.doesNotMatch(second.headers.get("server-timing"), /auth|token|email/);
  release();
  const first = await pending;
  assert.equal(first.status, 403); assert.deepEqual(await first.json(), { error: "Denied" });
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.match(first.headers.get("server-timing"), /auth;dur=/);
  const throwing = withApiTiming("GET /api/throw", () => timeApiStep("auth", async () => { throw new Error("Denied"); }));
  await assert.rejects(throwing, /Denied/);
});

test("batched availability retains legacy overlaps and holds, uses one day read batch and excludes contacts from legacy reads", async () => {
  const f = bookingFlowFixture({ records: {
    "consultationSlotDays/AS001_2099-10-25": { entries: { "10:00": { ownerId: "held", startTime: "10:00", endTime: "10:30", state: "held", expiresAt: Date.now() + 60000 } } },
    "consultationBookings/legacy": { consultantId: "AS002", status: "confirmed", preferredDate: "2099-10-25", slotStartTime: "09:00", slotEndTime: "10:00", consumerEmail: "private@example.test" },
  } });
  const { readScheduleDays, readScheduleDay } = f.load("services/consultations/slotReservationsAdmin.ts");
  let batches = 0;
  const days = await f.firestore.runTransaction(transaction => readScheduleDays({ ...transaction, getAll: async (...refs) => { batches++; assert.equal(refs.length, 3); return transaction.getAll(...refs); } }, f.firestore, ["AS001", "AS002", "AS003"], "2099-10-25"));
  assert.equal(batches, 1);
  for (const id of ["AS001", "AS002", "AS003"]) {
    const single = await f.firestore.runTransaction(transaction => readScheduleDay(transaction, f.firestore, id, "2099-10-25"));
    assert.deepEqual(days.get(id).entries, single.entries);
    assert.deepEqual(days.get(id).bookings, single.bookings);
  }
  assert.equal(days.get("AS002").bookings.length, 1);
  assert.ok(f.calls.fields.length > 0);
  assert.ok(f.calls.fields.every(fields => !fields.includes("consumerEmail") && fields.includes("slotEndTime")));
});

test("Finance starts all seven independent queries before waiting for a result", async () => {
  const f = bookingFlowFixture({ actor: { role: "admin" } });
  let release, started = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const read = async () => { started++; await gate; return { data: () => ({ count: 0, payable: 0 }) }; };
  const query = { where: () => query, orderBy: () => query, limit: () => query,
    get: async () => { started++; await gate; return { docs: [], size: 0 }; }, aggregate: () => ({ get: read }), count: () => ({ get: read }) };
  f.firestore.collection = () => query;
  const result = f.load("app/api/admin/consultant-finance/route.ts").GET(new Request("https://test.local/api/admin/consultant-finance?mode=test"));
  try { await new Promise(resolve => setImmediate(resolve)); assert.equal(started, 7); }
  finally { release(); }
  assert.equal((await result).status, 200);
});

test("consultation change responds before SMTP while retaining atomic queues and honest pending status", async () => {
  let release, sends = 0;
  const smtp = new Promise(resolve => { release = resolve; });
  const f = consultationPaymentFixture({ overrides: { "@/services/email/emailService": { sendEmail: async () => { sends++; await smtp; } } } });
  const checkout = (await (await prepare(f)).json()).checkout;
  f.capture(checkout); assert.equal((await verify(f, checkout.intentId)).status, 200);
  f.calls.after.length = 0;
  f.actor.role = "admin"; f.actor.uid = "admin";
  const response = await f.load("app/api/consultations/[bookingId]/route.ts").PATCH(bookingTestRequest("/api/consultations", { action: "cancelled", requestId: "performance-cancellation-0001" }), { params: Promise.resolve({ bookingId: checkout.intentId }) });
  assert.equal(response.status, 200); assert.equal(sends, 0);
  const result = await response.json();
  assert.equal(result.email.status, "pending"); assert.equal(result.consultantEmail.status, "pending"); assert.equal(result.supportEmail.status, "pending");
  assert.equal(f.records.get(`consultationBookings/${checkout.intentId}`).status, "cancelled");
  assert.equal(f.calls.after.length, 1);
  const background = f.flushAfter();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sends, 3);
  release(); await background;
  assert.ok(f.values("consultationEmailEvents").filter(event => event.event === "cancelled").every(event => event.status === "accepted"));
});
