import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Hard safety boundary: this suite cannot target a real Firebase project/server.
const project = "demo-ayursarga";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (host !== "127.0.0.1:8080") throw new Error("Run only against the local demo-ayursarga Firestore emulator on 127.0.0.1:8080.");
const base = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
const suffix = randomUUID().slice(0, 8);
const ids = Object.fromEntries(["admin", "consumer", "other", "hospital", "otherHospital", "inactive"].map((role) => [role, `${role}-${suffix}`]));
const centre = `centre-${suffix}`;
const timestamp = { timestampValue: "2026-10-01T00:00:00Z" };
const encode = (value) => value === null ? { nullValue: null } : typeof value === "string" ? { stringValue: value }
  : typeof value === "number" ? Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  : typeof value === "boolean" ? { booleanValue: value } : Array.isArray(value) ? { arrayValue: { values: value.map(encode) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } };
const fields = (data) => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)]));
function token(role, claims = {}) {
  const uid = ids[role];
  const now = Math.floor(Date.now() / 1000);
  return [Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({
    sub: uid, user_id: uid, aud: project, iss: `https://securetoken.google.com/${project}`, iat: now, exp: now + 3600,
    email_verified: role === "admin", auth_time: now, ...claims,
    firebase: { sign_in_provider: role === "consumer" || role === "other" ? "google.com" : "password", ...(role === "admin" ? { sign_in_second_factor: "totp" } : {}), ...claims.firebase },
  })).toString("base64url"), ""].join(".");
}
async function call(path, { role, owner = false, method = "GET", body, claims } = {}) {
  return fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(owner || role ? { Authorization: `Bearer ${owner ? "owner" : token(role, claims)}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function seed(path, data) {
  const response = await call(`/${path}`, { owner: true, method: "PATCH", body: { fields: data } });
  assert.equal(response.status, 200, `Could not seed local fixture ${path}`);
}
const metadata = { ...fields({ createdBy: ids.admin, updatedBy: ids.admin, archivedAt: null, archivedBy: null, lastAuditId: "seed" }), createdAt: timestamp, updatedAt: timestamp };
async function booking(name, overrides = {}) {
  const path = `bookings/${name}-${suffix}`;
  const data = { ...metadata, ...fields({ consumerId: ids.consumer, hospitalId: centre, status: "confirmed", treatmentStatus: "not_started", servicePrice: 12000,
    bookingReference: "AYURLOCAL1", bookingTermsVersion: "2026-09-23", ...overrides }), bookingTermsAcceptedAt: timestamp };
  await seed(path, data); return { path, data };
}
async function auditedUpdate(path, previous, changes, role, module = "bookings", action = "status_change", transforms = [], claims) {
  const auditId = `audit-${randomUUID()}`;
  const updated = { ...previous, ...fields(changes), ...fields({ updatedBy: ids[role], lastAuditId: auditId }) };
  const name = (record) => `projects/${project}/databases/(default)/documents/${record}`;
  const stamp = (fieldPath) => ({ fieldPath, setToServerValue: "REQUEST_TIME" });
  return call(":commit", { role, claims, method: "POST", body: { writes: [
    { update: { name: name(path), fields: updated }, updateTransforms: [stamp("updatedAt"), ...transforms.map(stamp)] },
    { update: { name: name(`auditLogs/${auditId}`), fields: {
      ...fields({ action, module, recordId: path.split("/")[1], actorId: ids[role], actorRole: role === "other" ? "consumer" : role,
        source: "web", device: { ipAddress: null } }), previousValues: { mapValue: { fields: previous } }, updatedValues: { mapValue: { fields: updated } },
    } }, updateTransforms: [stamp("timestamp"), stamp("updatedValues.updatedAt"), ...transforms.map((key) => stamp(`updatedValues.${key}`))] },
  ] } });
}

before(async () => {
  for (const [name, uid] of Object.entries(ids)) await seed(`users/${uid}`, fields({ uid, role: name === "other" ? "consumer" : name === "otherHospital" ? "hospital" : name === "inactive" ? "consumer" : name,
    status: name === "inactive" ? "inactive" : "active", hospitalId: name === "hospital" ? centre : name === "otherHospital" ? `other-${centre}` : null }));
  await seed(`hospitals/${centre}`, fields({ status: "active" }));
  await seed(`hospitals/other-${centre}`, fields({ status: "active" }));
});

test("private payment intents, receipts, financials and webhook journals deny every client role", async () => {
  for (const collection of ["consultationPaymentIntents", "consultationPaymentReceipts", "consultationFinancials", "consultationRefunds", "razorpayWebhookEvents", "cancellationPolicies", "invoiceReceipts", "invoicePaymentAttempts", "portalAccountClaims"]) {
    const path = `${collection}/private-${suffix}`;
    await seed(path, fields({ consumerId: ids.consumer, commissionPaise: 1000 }));
    for (const role of [undefined, "consumer", "hospital", "admin"]) {
      assert.equal((await call(`/${path}`, { role })).status, 403);
      assert.equal((await call(`/${path}`, { role, method: "PATCH", body: { fields: fields({ commissionPaise: 0 }) } })).status, 403);
    }
  }
});

test("Admin revocation cutoff blocks old native-MFA reads/writes and cannot be cleared by client roles", async () => {
  const cutoff = Math.floor(Date.now() / 1000);
  const profile = fields({ uid: ids.admin, name: "Admin", phone: null, address: null, role: "admin", status: "active", hospitalId: null, adminSessionRevokedBefore: cutoff });
  await seed(`users/${ids.admin}`, profile);
  try {
    for (const auth_time of [cutoff - 1, cutoff]) assert.equal((await call(`/hospitals/${centre}`, { role: "admin", claims: { auth_time } })).status, 403);
    assert.equal((await call(`/hospitals/${centre}`, { role: "admin", claims: { auth_time: cutoff + 1 } })).status, 200);
    assert.equal((await auditedUpdate(`users/${ids.admin}`, profile, { name: "Updated Admin" }, "admin", "users", "update", [], { auth_time: cutoff + 1 })).status, 200);
    for (const role of ["admin", "hospital", "consumer"]) {
      assert.equal((await auditedUpdate(`users/${ids.admin}`, profile, { adminSessionRevokedBefore: 0 }, role, "users", "update", [], { auth_time: cutoff + 1 })).status, 403);
    }
    const { path, data } = await booking("cutoff");
    assert.equal((await auditedUpdate(path, data, { status: "completed" }, "admin", "bookings", "status_change", [], { auth_time: cutoff })).status, 403);
    assert.equal((await call(`/hospitals/${centre}`, { role: "hospital" })).status, 200);
  } finally {
    await seed(`users/${ids.admin}`, fields({ uid: ids.admin, role: "admin", status: "active", hospitalId: null }));
  }
});

test("hospital and consultant creation cannot bypass the server duplicate-email checks", async () => {
  for (const collectionName of ["hospitals", "consultants"]) {
    for (const role of ["admin", "hospital", "consumer"]) {
      const response = await call(`/${collectionName}/create-${role}-${suffix}`, { role, method: "PATCH", body: { fields: fields({ name: "Duplicate", email: "existing@example.test" }) } });
      assert.equal(response.status, 403);
    }
  }
});

test("hospital official emails and their approval requests cannot be changed through direct client writes", async () => {
  const path=`hospitals/email-${suffix}`;
  const data={...metadata,...fields({name:"Centre",description:"Existing",email:"old@example.test",phone:"9876543210",hospitalPhone1:"9876543210",hospitalPhone2:null,
    address:"A complete centre address",registeredAddress:"A complete registered address",city:"Palakkad",district:"Palakkad",state:"Kerala",status:"active",isPublic:false,commissionPercentage:10})};
  await seed(path,data);
  const hospitalProfile=fields({uid:ids.hospital,role:"hospital",status:"active",hospitalId:path.split('/')[1]});
  await seed(`users/${ids.hospital}`,hospitalProfile);
  try {
    for(const role of ["admin","hospital"]) for(const changes of [{email:"new@example.test"},{pendingOfficialEmail:"new@example.test"}]) {
      assert.equal((await auditedUpdate(path,data,changes,role,"hospitals","update")).status,403);
    }
  } finally { await seed(`users/${ids.hospital}`,fields({uid:ids.hospital,role:"hospital",status:"active",hospitalId:centre})); }
});

test("hospital publication requires five images; live gallery changes cannot drop below five", async () => {
  const images = Array.from({ length: 5 }, (_, index) => `https://images.test/centre-${index}.webp`);
  const data = { ...metadata, ...fields({ name: "Centre", description: "Care", email: "partner@example.com", phone: "9876543210", hospitalPhone1: "9876543210", address: "A complete centre address", city: "Palakkad", district: "Palakkad", state: "Kerala", commissionPercentage: 10, status: "active", isPublic: true, contractStatus: "signed", contractUrl: "https://example.com/signed.pdf", imageUrls: images }), contractSignedAt: timestamp };
  const path = `hospitals/gallery-${suffix}`;
  await seed(path, data);
  assert.equal((await auditedUpdate(path, data, { imageUrls: images.slice(0, 3) }, "admin", "hospitals", "update")).status, 403);
  const legacyPath = `hospitals/gallery-legacy-${suffix}`;
  const legacy = { ...data, ...fields({ imageUrls: images.slice(0, 3) }) };
  await seed(legacyPath, legacy);
  assert.equal((await auditedUpdate(legacyPath, legacy, { description: "Updated care description" }, "admin", "hospitals", "update")).status, 200);
  for (const count of [4, 5]) {
    const pendingPath = `hospitals/gallery-pending-${count}-${suffix}`;
    const pending = { ...data, ...fields({ status: "pending", isPublic: false, imageUrls: images.slice(0, count), activatedAt: null, activatedBy: null }) };
    await seed(pendingPath, pending);
    const result = await auditedUpdate(pendingPath, pending, { status: "active", isPublic: true, activatedBy: ids.admin }, "admin", "hospitals", "hospital_activated", ["activatedAt"]);
    assert.equal(result.status, 403); // Publication now requires the verified content-bound server endpoint.
  }
});

test("pending contract changes and approval cannot bypass the server; agreement history is Admin-readable and immutable", async () => {
  const path = `hospitals/contract-binding-${suffix}`;
  const data = { ...metadata, ...fields({ status: "pending", isPublic: false, name: "Centre", legalName: "Original Entity",
    description: "", email: "centre@example.test", phone: "9876543210", hospitalPhone1: "9876543210",
    registeredAddress: "Registered address, Kerala", address: "Service address, Kerala", city: "Palakkad", district: "Palakkad", state: "Kerala",
    commissionPercentage: 10, imageUrl: null, contractStatus: "generated", contractUrl: null, contractSignedAt: null, contractSignedBy: null }) };
  await seed(path, data);
  assert.equal((await auditedUpdate(path, data, { name: "Different Centre" }, "admin", "hospitals", "update")).status, 403);
  assert.equal((await auditedUpdate(path, data, { contractStatus: "generated", contractGeneratedBy: ids.admin }, "admin", "hospitals", "contract_generated", ["contractGeneratedAt"])).status, 403);
  assert.equal((await auditedUpdate(path, data, { contractStatus: "signed", contractUrl: "https://example.test/signed.pdf", contractSignedBy: ids.admin }, "admin", "hospitals", "contract_signed", ["contractSignedAt"])).status, 403);
  const revision = `hospitalContractRevisions/revision-${suffix}`;
  const record = fields({ hospitalId: centre, previousValues: { contractUrl: "https://example.test/old-signed.pdf" } });
  await seed(revision, record);
  assert.equal((await call(`/${revision}`, { role: "admin" })).status, 200);
  for (const role of [undefined, "admin", "hospital", "consumer"]) {
    if (role !== "admin") assert.equal((await call(`/${revision}`, { role })).status, 403);
    assert.equal((await call(`/${revision}`, { role, method: "PATCH", body: { fields: record } })).status, 403);
    assert.equal((await call(`/${revision}`, { role, method: "DELETE" })).status, 403);
  }
});

test("package reviews: scoped reads remain allowed but direct publication, draft writes and deletion are denied", async () => {
  const path = `services/package-review-${suffix}`;
  const data = { ...metadata, ...fields({ hospitalId: centre, name: "7-day package", description: "Approved version", price: 12000, status: "active", reviewStatus: "approved" }), publishedAt: timestamp };
  await seed(path, data);
  for (const role of ["admin", "hospital"]) assert.equal((await call(`/${path}`, { role })).status, 200);
  for (const role of [undefined, "consumer", "otherHospital", "inactive"]) assert.equal((await call(`/${path}`, { role })).status, 403);
  for (const role of ["admin", "hospital", "consumer"]) {
    assert.equal((await call(`/services/new-${role}-${suffix}`, { role, method: "PATCH", body: { fields: data } })).status, 403);
    assert.equal((await auditedUpdate(path, data, { price: 1 }, role, "services", "update")).status, 403);
    assert.equal((await auditedUpdate(path, data, { reviewStatus: "approved" }, role, "services", "update")).status, 403);
    assert.equal((await call(`/${path}`, { role, method: "DELETE" })).status, 403);
  }
});

test("hospital bookings: only operational roles can read full documents; Consumers use the safe API", async () => {
  const { path } = await booking("reads");
  for (const role of ["admin", "hospital"]) assert.equal((await call(`/${path}`, { role })).status, 200, role);
  for (const role of [undefined, "consumer", "other", "otherHospital", "inactive"]) assert.equal((await call(`/${path}`, { role })).status, 403, String(role));
  assert.equal((await call(":runQuery", { role: "consumer", method: "POST", body: { structuredQuery: {
    from: [{ collectionId: "bookings" }], where: { fieldFilter: { field: { fieldPath: "consumerId" }, op: "EQUAL", value: { stringValue: ids.consumer } } }, limit: 20,
  } } })).status, 403);
});

test("Admin operational reads/writes require native verified TOTP; own-profile setup and Hospital/Consumer scopes remain intact", async () => {
  const { path } = await booking("mfa");
  for (const claims of [
    { firebase: { sign_in_second_factor: "" } },
    { firebase: { sign_in_second_factor: "phone" } },
    { firebase: { sign_in_provider: "google.com" } },
    { email_verified: false },
    { email_verified: "true" },
    { firebase: { sign_in_second_factor: "" }, adminMfaVerified: true },
  ]) {
    assert.equal((await call(`/${path}`, { role: "admin", claims })).status, 403);
    assert.equal((await call(`/users/${ids.consumer}`, { role: "admin", claims })).status, 403);
    assert.equal((await call(`/users/${ids.admin}`, { role: "admin", claims })).status, 200);
  }
  for (const role of ["admin", "hospital"]) assert.equal((await call(`/${path}`, { role })).status, 200);
  assert.equal((await call(`/${path}`, { role: "consumer" })).status, 403);
  const hospitalPath = `hospitals/admin-mfa-${suffix}`;
  const hospital = { ...metadata, ...fields({ name: "Centre", description: "Existing description", email: "partner@example.test", phone: "9876543210", hospitalPhone1: "9876543210", address: "A complete centre address", city: "Palakkad", district: "Palakkad", state: "Kerala", commissionPercentage: 10, status: "pending", isPublic: false, imageUrls: [] }) };
  await seed(hospitalPath, hospital);
  assert.equal((await auditedUpdate(hospitalPath, hospital, { description: "Allowed update" }, "admin", "hospitals", "update")).status, 200);
  const saved = (await (await call(`/${hospitalPath}`, { role: "admin" })).json()).fields;
  assert.equal((await auditedUpdate(hospitalPath, saved, { description: "Denied update" }, "admin", "hospitals", "update", [], { firebase: { sign_in_second_factor: "" } })).status, 403);
});

test("existing hospital bookings: direct creation and permanent deletion stay denied for all roles", async () => {
  const { path } = await booking("immutable");
  for (const role of ["admin", "consumer", "hospital"]) {
    assert.equal((await call(`/bookings/new-${role}-${suffix}`, { role, method: "PATCH", body: { fields: fields({ consumerId: ids.consumer, hospitalId: centre }) } })).status, 403);
    assert.equal((await call(`/${path}`, { role, method: "DELETE" })).status, 403);
  }
});

test("cancellation is server-only and cannot bypass its reason/email transaction", async () => {
  const own = await booking("cancel");
  assert.equal((await auditedUpdate(own.path, own.data, { status: "cancelled" }, "consumer")).status, 403);
  assert.equal((await auditedUpdate(own.path, own.data, { status: "cancelled", cancellationReason: "Changed plans" }, "admin")).status, 403);
  const other = await booking("other-cancel");
  assert.equal((await auditedUpdate(other.path, other.data, { status: "cancelled" }, "other")).status, 403);
  assert.equal((await auditedUpdate(other.path, other.data, { status: "cancelled", servicePrice: 1 }, "consumer")).status, 403);
  assert.equal((await call(`/${other.path}`, { role: "consumer", method: "PATCH", body: { fields: { ...other.data, ...fields({ status: "cancelled" }) } } })).status, 403);
});

test("started care cannot be cancelled by Consumer; Hospital treatment changes keep audited transitions", async () => {
  const started = await booking("started", { treatmentStatus: "started" });
  assert.equal((await auditedUpdate(started.path, started.data, { status: "cancelled" }, "consumer")).status, 403);
  const fresh = await booking("treatment");
  assert.equal((await auditedUpdate(fresh.path, fresh.data, { treatmentStatus: "started" }, "hospital", "bookings", "status_change", ["treatmentStartedAt"])).status, 200);
  const invalid = await booking("skipped");
  assert.equal((await auditedUpdate(invalid.path, invalid.data, { status: "completed", treatmentStatus: "completed" }, "hospital", "bookings", "status_change", ["completedAt", "treatmentCompletedAt"])).status, 403);
});

test("legacy requested booking can still be confirmed by its Hospital with an atomic audit", async () => {
  const legacy = await booking("legacy", { status: "requested" });
  assert.equal((await auditedUpdate(legacy.path, legacy.data, { status: "confirmed", confirmedDate: "2099-10-25", confirmedTime: "10:15" }, "hospital", "bookings", "status_change", ["confirmedAt"])).status, 200);
});

test("consultations remain separate: Admin/own Consumer reads only and no client writes", async () => {
  const path = `consultationBookings/online-${suffix}`;
  await seed(path, { ...metadata, ...fields({ consumerId: ids.consumer, status: "requested", consultantCharge: 900 }) });
  for (const role of ["admin", "consumer"]) assert.equal((await call(`/${path}`, { role })).status, 200);
  for (const role of [undefined, "hospital", "other", "inactive"]) assert.equal((await call(`/${path}`, { role })).status, 403);
  for (const role of ["admin", "consumer", "hospital"]) {
    assert.equal((await call(`/${path}`, { role, method: "PATCH", body: { fields: fields({ consumerId: ids.consumer, status: "confirmed" }) } })).status, 403);
    assert.equal((await call(`/${path}`, { role, method: "DELETE" })).status, 403);
  }
});

test("consultation and hospital cancellation delivery records deny every client role", async () => {
  for (const collection of ["consultationEmailEvents", "hospitalBookingEmailEvents"]) {
    const path = `${collection}/local-email-${suffix}`;
    await seed(path, { ...metadata, ...fields({ status: "accepted", recipient: "private@example.com" }) });
    for (const role of [undefined, "admin", "consumer", "hospital", "other", "inactive"]) {
      assert.equal((await call(`/${path}`, { role })).status, 403);
      assert.equal((await call(`/${path}`, { role, method: "PATCH", body: { fields: fields({ status: "pending" }) } })).status, 403);
      assert.equal((await call(`/${path}`, { role, method: "DELETE" })).status, 403);
    }
  }
});

test("invoice records are Admin-readable and deny all direct client writes", async () => {
  const path = `invoices/local-invoice-${suffix}`;
  await seed(path, { ...metadata, ...fields({ invoiceNumber: "AS/2026/00001", hospitalId: centre, totalPaise: 118000, status: "issued" }) });
  assert.equal((await call(`/${path}`, { role: "admin" })).status, 200);
  for (const role of [undefined, "consumer", "hospital", "otherHospital", "inactive"]) {
    assert.equal((await call(`/${path}`, { role })).status, 403);
  }
  for (const role of ["admin", "consumer", "hospital"]) {
    assert.equal((await call(`/${path}`, { role, method: "PATCH", body: { fields: fields({ status: "paid" }) } })).status, 403);
    assert.equal((await call(`/invoices/new-${role}-${suffix}`, { role, method: "PATCH", body: { fields: fields({ status: "issued" }) } })).status, 403);
    assert.equal((await call(`/${path}`, { role, method: "DELETE" })).status, 403);
  }
});

test("consultant records remain Admin-readable but every direct client mutation is denied", async () => {
  const path = `consultants/AS${Date.now()}`;
  const data = { ...metadata, ...fields({ employeeId: path.split("/")[1], employeeSequence: 1, name: "Local consultant",
    status: "active", consultantCharge: 900, ayursargaCommissionPercentage: 0, preferredDays: ["mon"],
    availableDates: ["2099-10-25"], imageUrl: "https://images.test/portrait.webp" }) };
  await seed(path, data);
  assert.equal((await call(`/${path}`, { role: "admin" })).status, 200);
  for (const role of ["admin", "hospital", "consumer", "inactive"]) {
    for (const changes of [{ name: "Changed" }, { status: "inactive" }, { imageUrl: "https://images.test/new.webp" }, { availableDates: [] }]) {
      assert.equal((await auditedUpdate(path, data, changes, role, "consultants", "update")).status, 403);
    }
    assert.equal((await call(`/${path}`, { role, method: "DELETE" })).status, 403);
    if (role !== "admin") assert.equal((await call(`/${path}`, { role })).status, 403);
  }
  assert.equal((await call(`/${path}`, { role: "admin", claims: { firebase: { sign_in_second_factor: "" } } })).status, 403);
});

test("consultant API commits full edits and audits together in the local database", async () => {
  const { initializeApp, deleteApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { loadTypeScript } = await import("../helpers/loadTypeScript.mjs");
  const app = initializeApp({ projectId: project }, `consultant-route-${suffix}`);
  try {
    const firestore = getFirestore(app);
    const consultantId = `AS${Date.now()}`;
    const ref = firestore.collection("consultants").doc(consultantId);
    await ref.set({ employeeId: consultantId, employeeSequence: 1, name: "Original Doctor", status: "active", imageUrl: "https://images.test/portrait.webp", archivedAt: null });
    const { PATCH } = loadTypeScript("app/api/admin/consultants/[consultantId]/route.ts", {
      // Authorization is tested separately; verify actual local persistence here.
      "@/services/firebase/adminAuthorization": { requireActiveAdmin: async () => ({ uid: ids.admin, firestore }), AdminAuthorizationError: class extends Error {} },
      "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status }) },
    });
    const input = { name: "Edited Doctor", designation: "Doctor", email: "local@example.test", contactNo: "9876543210", whatsappNo: "9876543210", qualification: "BAMS", yearsExperience: 3.5, consultantCharge: 900.5, ayursargaCommissionPercentage: 12.5,
      preferredDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], availableDates: Array.from({length:31}, (_, index) => `2099-10-${String(index+1).padStart(2,"0")}`), preferredTimeSlots: ["morning", "noon", "evening"], consultationServices: ["prenatal-doctor", "lactation"] };
    for (const body of [{ action: "update", fields: input }, { action: "update", fields: { ...input, name: "Edited Again" } }, { action: "status_change", status: "inactive" }]) {
      const before = (await ref.get()).data();
      const response = await PATCH(new Request("https://local.test/api/admin/consultants", { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify(body) }), {params:Promise.resolve({consultantId})});
      assert.equal(response.status, 200, await response.text());
      const after = (await ref.get()).data();
      const audit = (await firestore.collection("auditLogs").doc(after.lastAuditId).get()).data();
      assert.deepEqual(audit.previousValues, before);
      assert.deepEqual(audit.updatedValues, after);
      assert.equal(audit.actorId, ids.admin);
      assert.equal(after.imageUrl, "https://images.test/portrait.webp");
      assert.equal(after.availableDates.length, 31);
      assert.equal(audit.timestamp.isEqual(after.updatedAt), true);
    }
  } finally { await deleteApp(app); }
});
