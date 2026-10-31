import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
import { bookingFlowFixture, BookingTestAuthorizationError } from "../helpers/bookingFlowFixture.mjs";

const endpoint = "/api/admin/consultants/AS001/image";
const context = { params: Promise.resolve({ consultantId: "AS001" }) };
const portrait = "https://firebasestorage.googleapis.com/v0/b/test/o/consultants%2FAS001%2Fimages%2F00000000-0000-4000-8000-000000000001.webp?alt=media&token=token";
function fixture(role = "admin", data = {}, options = {}) {
  const f = bookingFlowFixture({ records: { "consultants/AS001": { name: "Doctor", status: "active", ...data } } });
  const uploads = [];
  const route = loadTypeScript("app/api/admin/consultants/[consultantId]/image/route.ts", {
    "@/services/firebase/adminAuthorization": { AdminAuthorizationError: BookingTestAuthorizationError, requireActiveAdmin: async () => {
      if (role !== "admin") throw new BookingTestAuthorizationError("Denied", 403);
      return { uid: "admin", firestore: f.firestore };
    } },
    "@/services/firebase/admin": { getFirebaseAdminStorageBucket: () => ({ name: "test", file: path => ({ save: async (bytes, metadata) => {
      if (options.failUpload) throw new Error("Storage failure");
      uploads.push({ path, bytes, metadata });
      if (options.conflict) f.records.set("consultants/AS001", { name: "Doctor", imageUrl: portrait });
    } }) }) },
    "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status }), logApiError: () => {} },
    "@/services/api/rateLimit": { allowRequest: () => true },
  });
  return { ...f, uploads, route };
}
async function request(expected = "", type = "image/png", bytes) {
  bytes ??= await sharp({ create: { width: 40, height: 60, channels: 3, background: "#f0ead9" } }).png().toBuffer();
  return new Request(`https://test.local${endpoint}`, { method: "POST", headers: { "content-type": type, "x-expected-image-url": expected }, body: bytes });
}
test("Admin portrait upload re-encodes and atomically audits the consultant without financial or booking changes", async () => {
  const f = fixture();
  const response = await f.route.POST(await request(), context);
  assert.equal(response.status, 201);
  const { imageUrl } = await response.json();
  assert.equal(f.records.get("consultants/AS001").imageUrl, imageUrl);
  assert.equal(f.values("auditLogs").length, 1);
  assert.equal(f.values("auditLogs")[0].recordId, "AS001");
  assert.equal(f.uploads.length, 1);
  const metadata = await sharp(f.uploads[0].bytes).metadata();
  assert.equal(metadata.width, 384); assert.equal(metadata.height, 384); assert.equal(metadata.format, "webp");
  assert.equal(metadata.exif, undefined);
  assert.equal(f.uploads[0].metadata.preconditionOpts.ifGenerationMatch, 0);
  assert.equal(f.values("consultationBookings").length, 0);
});
test("Hospital and Consumer cannot upload; invalid files and archived consultants cannot mutate records", async () => {
  for (const role of ["hospital", "consumer"]) {
    const f = fixture(role); assert.equal((await f.route.POST(await request(), context)).status, 403);
    assert.equal(f.uploads.length, 0); assert.equal(f.values("auditLogs").length, 0);
  }
  for (const [type, bytes, status] of [["image/svg+xml", Buffer.from("svg"), 415], ["image/png", Buffer.from("invalid"), 400]]) {
    const f = fixture(); assert.equal((await f.route.POST(await request("", type, bytes), context)).status, status);
    assert.equal(f.uploads.length, 0); assert.equal(f.values("auditLogs").length, 0);
  }
  const f = fixture("admin", { archivedAt: {} }); assert.equal((await f.route.POST(await request(), context)).status, 404);
  const oversized = fixture();
  const body = await request();
  body.headers.set("content-length", String(9 * 1024 * 1024));
  assert.equal((await oversized.route.POST(body, context)).status, 413);
  assert.equal(oversized.uploads.length, 0);
});
test("replacements are revision checked before and after Storage, and failures do not change the portrait", async () => {
  const existing = fixture("admin", { imageUrl: portrait });
  assert.equal((await existing.route.POST(await request(), context)).status, 409);
  assert.equal(existing.uploads.length, 0);
  const replaced = await existing.route.POST(await request(portrait), context);
  assert.equal(replaced.status, 201);
  assert.notEqual((await replaced.json()).imageUrl, portrait);
  for (const options of [{ conflict: true }, { failUpload: true }]) {
    const f = fixture("admin", {}, options);
    assert.equal((await f.route.POST(await request(), context)).status, options.conflict ? 409 : 503);
    assert.equal(f.values("auditLogs").length, 0);
    assert.equal(f.records.get("consultants/AS001").imageUrl, options.conflict ? portrait : undefined);
  }
});
test("public portraits accept only tokenized consultant images; direct client photo changes remain excluded", () => {
  const { consultantPhotoUrl } = loadTypeScript("features/consultants/photo.ts");
  assert.equal(consultantPhotoUrl(portrait, "AS001"), portrait);
  for (const value of ["javascript:alert(1)", "https://example.com/photo.png", portrait.replace("AS001", "AS002"), portrait.replace("&token=token", "")]) assert.equal(consultantPhotoUrl(value, "AS001"), null);
  const rules = readFileSync("firestore.rules", "utf8");
  assert.match(rules.slice(rules.indexOf("function hasValidConsultantFields")), /'imageUrl'/);
  const changedFields = rules.slice(rules.indexOf("match /consultants/{consultantId}"), rules.indexOf("match /consultationBookings/{bookingId}"));
  assert.doesNotMatch(changedFields, /'imageUrl'/);
});
