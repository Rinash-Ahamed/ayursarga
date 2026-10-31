import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
import { bookingFlowFixture, bookingTestRequest, BookingTestAuthorizationError } from "../helpers/bookingFlowFixture.mjs";

const images = Array.from({ length: 6 }, (_, index) => `https://images.test/centre-${index}.webp`);
const hospital = { status: "pending", isPublic: false, name: "Centre", email: "partner@example.com", phone: "9876543210", hospitalPhone1: "9876543210", address: "A complete centre address", city: "Palakkad", district: "Palakkad", state: "Kerala", commissionPercentage: 10, contractStatus: "signed", contractSignedAt: {}, contractUrl: "https://example.com/signed.pdf", imageUrls: images.slice(0, 4) };
const context = { params: Promise.resolve({ hospitalId: "centre" }) };
const imagePath = "app/api/hospitals/[hospitalId]/images/route.ts";
const activatePath = "app/api/admin/hospitals/[hospitalId]/activate/route.ts";
function fixture(data = {}, role = "admin", denied = false) {
  const calls = { uploads: [], auth: 0 };
  const f = bookingFlowFixture({ actor: { uid: "admin", role }, records: { "hospitals/centre": { ...hospital, ...data } } });
  f.firestore.batch = () => {
    const pending = [];
    const batch = Object.fromEntries(["set", "update"].map((method) => [method, (...args) => { pending.push([method, args]); return batch; }]));
    batch.commit = () => f.firestore.runTransaction(async (tx) => pending.forEach(([method, args]) => tx[method](...args)));
    return batch;
  };
  const authorize = async (_request, allowed = ["admin"]) => {
    if (denied || !allowed.includes(role)) throw new BookingTestAuthorizationError("Denied", 403);
    return { uid: "admin", role, profile: { hospitalId: "centre" }, firestore: f.firestore, auth: { updateUser: async () => { calls.auth++; }, revokeRefreshTokens: async () => { calls.auth++; } } };
  };
  const load = (file) => loadTypeScript(file, {
    "@/services/firebase/adminAuthorization": { requireActiveAdmin: authorize, requireActiveUser: authorize, AdminAuthorizationError: BookingTestAuthorizationError },
    "@/services/firebase/admin": { isFirebaseAdminReady: () => true, isFirebaseAdminStorageReady: () => true, getFirebaseAdminStorageBucket: () => ({ name: "synthetic.test", file: (path) => ({ save: async () => { calls.uploads.push(path); } }) }) },
    "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status }), apiHealth: () => Response.json({}), logApiError: () => {} },
    "@/services/api/rateLimit": { allowRequest: () => true },
  });
  return { ...f, calls, load };
}

test("publication minimum counts five unique valid photos, not duplicates or insecure URLs", () => {
  const { hasMinimumHospitalImages, getHospitalImageUrls, MIN_PUBLIC_HOSPITAL_IMAGES } = loadTypeScript("features/hospitals/images.ts");
  assert.equal(MIN_PUBLIC_HOSPITAL_IMAGES, 5);
  assert.equal(hasMinimumHospitalImages({ imageUrls: images.slice(0, 5) }), true);
  assert.equal(hasMinimumHospitalImages({ imageUrls: images.slice(0, 4) }), false);
  assert.equal(hasMinimumHospitalImages({ imageUrls: Array(5).fill(images[0]) }), false);
  assert.equal(hasMinimumHospitalImages({ imageUrls: [...images.slice(0, 4), "http://images.test/insecure.jpg"] }), false);
  assert.equal(getHospitalImageUrls({ imageUrls: images })[0], images[0]);
});

test("activation refuses fewer than five photos before audit/auth side effects; five allows publication", async () => {
  for (const imageUrls of [[], images.slice(0, 4), Array(5).fill(images[0]), images.slice(0, 5)]) {
    const f = fixture({ imageUrls });
    const response = await f.load(activatePath).POST(bookingTestRequest("/api/admin/hospitals/centre/activate", {}), context);
    const eligible = new Set(imageUrls).size >= 5;
    assert.equal(response.status, eligible ? 200 : 409);
    assert.equal(f.values("auditLogs").filter((item) => item.module === "hospitals").length, eligible ? 1 : 0);
    assert.equal(f.records.get("hospitals/centre").isPublic, eligible);
    if (!eligible) assert.match((await response.json()).error, /at least 5/);
  }
});

test("public gallery removal is transactionally limited to five for both roles, preserving stored files", async () => {
  for (const role of ["admin", "hospital"]) {
    const f = fixture({ status: "active", isPublic: true, imageUrls: images }, role);
    const { PATCH } = f.load(imagePath);
    assert.equal((await PATCH(bookingTestRequest("/api/hospitals/centre/images", { imageUrl: images[0] }), context)).status, 200);
    assert.equal(f.records.get("hospitals/centre").imageUrls[0], images[1]);
    assert.equal((await PATCH(bookingTestRequest("/api/hospitals/centre/images", { imageUrl: images[1] }), context)).status, 409);
    assert.equal(f.records.get("hospitals/centre").imageUrls.length, 5);
    assert.equal(f.values("auditLogs").length, 1);
    assert.equal(f.calls.uploads.length, 0);
  }
});

test("private galleries allow gradual uploads/removal, and old public galleries are not silently hidden", async () => {
  const f = fixture({ imageUrls: [] });
  const image = await sharp({ create: { width: 24, height: 18, channels: 3, background: "#eeeeee" } }).webp().toBuffer();
  const response = await f.load(imagePath).POST(new Request("https://test.local/api/hospitals/centre/images", { method: "POST", headers: { "content-type": "image/webp" }, body: image }), context);
  assert.equal(response.status, 201);
  assert.equal(f.records.get("hospitals/centre").imageUrls.length, 1);
  assert.equal(f.records.get("hospitals/centre").isPublic, false);
  assert.equal(f.calls.uploads.length, 3);
  const url = (await response.json()).imageUrls[0];
  assert.equal((await f.load(imagePath).PATCH(bookingTestRequest("/api/hospitals/centre/images", { imageUrl: url }), context)).status, 200);
  assert.equal(f.records.get("hospitals/centre").imageUrls.length, 0);
  assert.equal(f.calls.uploads.length, 3);
  const legacy = fixture({ status: "active", isPublic: true, imageUrls: images.slice(0, 3) });
  assert.equal((await legacy.load(imagePath).PATCH(bookingTestRequest("/api/hospitals/centre/images", { imageUrl: images[0] }), context)).status, 409);
  assert.equal(legacy.records.get("hospitals/centre").isPublic, true);
});

test("Admin general image updates cannot bypass the minimum; unauthorized activation/upload stays denied", async () => {
  const f = fixture({ status: "active", isPublic: true });
  const response = await f.load("app/api/admin/hospitals/[hospitalId]/route.ts").PATCH(bookingTestRequest("/api/admin/hospitals/centre", { action: "update", data: { imageUrls: images.slice(0, 4) } }), context);
  assert.equal(response.status, 409);
  assert.equal(f.values("auditLogs").length, 0);
  for (const path of [activatePath, imagePath]) {
    const denied = fixture({}, "consumer");
    assert.equal((await denied.load(path).POST(bookingTestRequest("/api/test", {}), context)).status, 403);
    assert.equal(denied.values("auditLogs").length, 0);
  }
});

test("rules cover publication and image changed-field bypasses without hiding existing live records", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const hospitalBlock = rules.slice(rules.indexOf("match /hospitals/{hospitalId}"), rules.indexOf("match /consultants/{consultantId}"));
  assert.match(hospitalBlock, /hasAny\(\['imageUrls', 'imageUrl'\]\)/);
  assert.match(hospitalBlock, /toSet\(\)\.size\(\) >= 5/);
  assert.match(hospitalBlock, /resource\.data\.get\('isPublic', false\) == true/);
});
