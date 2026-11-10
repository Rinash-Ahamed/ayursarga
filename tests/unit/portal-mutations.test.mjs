import { test } from "node:test";
import assert from "node:assert/strict";
import { Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

class AuthorizationError extends Error { constructor(message, status) { super(message); this.status = status; } }
function fixture(records = {}, options = {}) {
  const calls = { singles: 0, batches: 0, writes: [], commits: 0, auth: 0, emails: [] };
  let auditId = 0;
  const snapshot = (reference) => ({
    ref: reference, exists: Object.hasOwn(records, reference.path),
    data: () => records[reference.path], updateTime: Timestamp.fromMillis(1000),
  });
  const db = {
    runTransaction: async callback => {
      const batch = db.batch();
      const result = await callback({ ...batch, get: async ref => { calls.singles++; return snapshot(ref); } });
      await batch.commit();
      return result;
    },
    collection: (collection) => ({ doc: (id = `audit-${++auditId}`) => {
      const ref = { id, path: `${collection}/${id}` };
      ref.get = async () => { calls.singles++; return snapshot(ref); };
      return ref;
    } }),
    getAll: async (...refs) => { calls.batches++; return refs.map(snapshot); },
    batch: () => {
      const writes = [];
      const batch = {
        update: (...args) => { writes.push(["update", ...args]); return batch; },
        set: (...args) => { writes.push(["set", ...args]); return batch; },
        create: (...args) => { writes.push(["create", ...args]); return batch; },
        commit: async () => {
          calls.commits++;
          if (options.failCommit) throw new Error("conflicting update");
          calls.writes.push(...writes);
        },
      };
      return batch;
    },
  };
  const authorize = async () => {
    calls.auth++;
    if (options.denied) throw new AuthorizationError("Denied", 403);
    return { uid: "actor", role: "hospital", profile: { hospitalId: "centre" }, firestore: db };
  };
  return {
    calls,
    load: (file) => loadTypeScript(file, {
      "@/services/email/bookingEmailService": { scheduleBookingConfirmation: (...args) => { assert.ok(calls.writes.length > 0); calls.emails.push(args); } },
      "@/services/firebase/adminAuthorization": { requireActiveUser: authorize, requireActiveAdmin: authorize, AdminAuthorizationError: AuthorizationError },
      "@/services/firebase/admin": { isFirebaseAdminReady: () => true },
      "@/services/api/server": { apiJson: (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } }), apiHealth: () => Response.json({}), logApiError: () => {} },
      "@/services/api/rateLimit": { allowRequest: () => true, requestFingerprint: () => "test" },
      "@/services/api/audit": { requestAuditDevice: () => ({ userAgent: "unit test" }) },
    }),
  };
}
const request = (body) => new Request("https://test.local/api/test", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const context = (key, value) => ({ params: Promise.resolve({ [key]: value }) });

const validHospitalProfile={name:"Centre",legalName:"Centre LLP",email:"hospital@example.test",phone:"9876543210",hospitalPhone1:"9876543210",hospitalPhone2:null,
  address:"A complete service address",registeredAddress:"A complete registered address",city:"Palakkad",district:"Palakkad",state:"Kerala",commissionPercentage:10,status:"active",description:"Legacy description retained",locationUrl:"https://www.google.com/maps?q=Palakkad"};

test("native rules wire changed-only hospital requirement guards without requiring missing legacy fields globally",()=>{
  const rules=readFileSync('firestore.rules','utf8');
  const guard=rules.split('function hasValidChangedHospitalRequirements()')[1].split('function validAdminHospitalUpdate()')[0];
  for(const field of ['locationUrl','hospitalPhone1','district'])assert.ok(guard.includes(`!changed.hasAny(['${field}'])`));
  const hospitalRules=rules.split('match /hospitals/{hospitalId}')[1].split('match /consultants/')[0];
  assert.ok(hospitalRules.includes('&& hasValidChangedHospitalRequirements()'));
});

test("hospital map saves reject blanks and incomplete embeds without changing records or audit history",async()=>{
  const {validateHospitalLocationUrl:validate}=loadTypeScript("features/hospitals/location.ts");
  for(const value of [""," \n\t ",null,undefined,"<iframe></iframe>",'<iframe src=""></iframe>']) {
    assert.ok(validate(value).error);
    const f=fixture({"hospitals/centre":validHospitalProfile});
    const response=await f.load("app/api/admin/hospitals/[hospitalId]/route.ts").PATCH(request({action:"update",data:{locationUrl:value}}),context("hospitalId","centre"));
    assert.equal(response.status,400);assert.equal(f.calls.commits,0);assert.equal(f.calls.writes.length,0);
  }
});

test("valid hospital map embeds save only their supported HTTPS src with an atomic audit and Admin authorization",async()=>{
  const f=fixture({"hospitals/centre":validHospitalProfile});
  const response=await f.load("app/api/admin/hospitals/[hospitalId]/route.ts").PATCH(request({action:"update",data:{locationUrl:'<iframe src="https://www.google.com/maps/embed?pb=synthetic&amp;lang=en" onload="untrusted()"></iframe>'}}),context("hospitalId","centre"));
  assert.equal(response.status,200);assert.equal(f.calls.writes.length,2);
  const changes=(await response.json()).changes;assert.equal(changes.locationUrl,'https://www.google.com/maps/embed?pb=synthetic&lang=en');
  assert.ok(f.calls.writes.some(([,ref])=>ref.path.startsWith('auditLogs/')));
  const denied=fixture({"hospitals/centre":validHospitalProfile},{denied:true});
  assert.equal((await denied.load("app/api/admin/hospitals/[hospitalId]/route.ts").PATCH(request({action:"update",data:{locationUrl:changes.locationUrl}}),context("hospitalId","centre"))).status,403);
  assert.equal(denied.calls.commits,0);
});

test("explicitly clearing required hospital fields is rejected, while optional phone and untouched legacy particulars remain compatible",async()=>{
  for(const key of ['name','legalName','email','phone','hospitalPhone1','registeredAddress','address','city','district','state','commissionPercentage'])for(const value of ['', '   ', null]){
    const f=fixture({"hospitals/centre":validHospitalProfile});
    const response=await f.load("app/api/admin/hospitals/[hospitalId]/route.ts").PATCH(request({action:'update',data:{[key]:value}}),context('hospitalId','centre'));
    assert.equal(response.status,400,`${key} cannot be ${JSON.stringify(value)}`);assert.equal(f.calls.commits,0);
  }
  for(const profile of [validHospitalProfile,{...validHospitalProfile,legalName:null,registeredAddress:null,locationUrl:null}]){
    const f=fixture({'hospitals/centre':profile});
    const response=await f.load('app/api/admin/hospitals/[hospitalId]/route.ts').PATCH(request({action:'update',data:{hospitalPhone2:null,city:'Kochi'}}),context('hospitalId','centre'));
    assert.equal(response.status,200);assert.equal(Object.hasOwn((await response.json()).changes,'locationUrl'),false);
  }
});

test("all required contract particulars reject blanks and null values at the Admin endpoint",async()=>{
  const particulars={registrationNumber:'REG123',cinNumber:'NOT APPLICABLE',panNumber:'ABCDE1234F',gstin:'NOT APPLICABLE',contractEffectiveDate:'2026-11-11',contractExpiryDate:'2029-11-11',emergencyContact:'9876543210',emergencyReferralHospital:'Nearby Hospital'};
  for(const key of Object.keys(particulars))for(const value of ['', '   ', null]){
    const f=fixture({'hospitals/centre':{...validHospitalProfile,...particulars}});
    const response=await f.load('app/api/admin/hospitals/[hospitalId]/route.ts').PATCH(request({action:'update',data:{[key]:value}}),context('hospitalId','centre'));
    assert.equal(response.status,400,key);assert.equal(f.calls.commits,0);
  }
});

test("USR-010: Hospital cannot submit Admin editorial fields and denied callers cannot write them",async()=>{
  for(const data of [{ayursargaRating:5},{ayursargaReviewNote:"Untrusted editorial"}]) {
    const f=fixture({"hospitals/centre":{status:"active"}});
    const response=await f.load("app/api/hospital/profile/route.ts").PATCH(request(data));
    assert.equal(response.status,400);assert.equal(f.calls.commits,0);
  }
  const denied=fixture({"hospitals/centre":{status:"active"}},{denied:true});
  assert.equal((await denied.load("app/api/hospital/profile/route.ts").PATCH(request({ayursargaRating:5}))).status,403);
  assert.equal(denied.calls.commits,0);
});

test("Hospital profile saves without a description preserve legacy text and remain atomically audited", async () => {
  const profile = { name: "Centre", email: "hospital@example.test", phone: "9876543210", hospitalPhone1: "9876543210", hospitalPhone2: null,
    address: "A complete centre address", registeredAddress: "A complete registered address", city: "Palakkad", district: "Palakkad", state: "Kerala",
    centreGuidelines: {}, additionalCentreRules: "", facilities: "", legalPolicies: "", additionalBystandersAllowed: false };
  const f = fixture({ "hospitals/centre": { ...profile, description: "Legacy description retained", status: "active", commissionPercentage: 10 } });
  const response = await f.load("app/api/hospital/profile/route.ts").PATCH(request(profile));
  assert.equal(response.status, 200);
  const changes = f.calls.writes.find(([kind, ref]) => kind === "update" && ref.path === "hospitals/centre")[2];
  assert.equal(Object.hasOwn(changes, "description"), false);
  assert.equal(f.calls.writes.length, 2);
  const audit = f.calls.writes.find(([kind, ref]) => kind === "set" && ref.path.startsWith("auditLogs/"))[2];
  assert.equal(audit.updatedValues.description, "Legacy description retained");
});

test("HOS-006: Admin edits preserve stored descriptions without returning them as a changed field",async()=>{
  const profile={name:"Centre",legalName:"Centre LLP",email:"hospital@example.test",phone:"9876543210",hospitalPhone1:"9876543210",hospitalPhone2:null,address:"A complete service address",registeredAddress:"A complete registered address",city:"Palakkad",district:"Palakkad",state:"Kerala",commissionPercentage:10,status:"active",description:"Retained legacy content"};
  const f=fixture({"hospitals/centre":profile});
  const response=await f.load("app/api/admin/hospitals/[hospitalId]/route.ts").PATCH(request({action:"update",data:{hospitalPhone1:"9876543211"}}),context("hospitalId","centre"));
  assert.equal(response.status,200);
  const audit=f.calls.writes.find(([,ref])=>ref.path.startsWith("auditLogs/"))[2];
  assert.equal(audit.updatedValues.description,"Retained legacy content");
  assert.equal(Object.hasOwn((await response.json()).changes,"description"),false);
});

test("capacity batches independent reads and returns committed fields with atomic audit", async () => {
  const f = fixture({ "hospitals/centre": { status: "active" }, "hospitalCapacity/centre": { hospitalId: "centre", totalRooms: 4, occupiedRooms: 1 } });
  const response = await f.load("app/api/hospital/capacity/route.ts").PATCH(request({ totalRooms: 9, occupiedRooms: 2 }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.changes.totalRooms, 9);
  assert.ok(body.changes.updatedAt.__ayursargaTimestamp);
  assert.equal(f.calls.batches, 1);
  assert.equal(f.calls.singles, 0);
  assert.equal(f.calls.writes.length, 2);
  assert.equal(f.calls.writes[0][3].lastUpdateTime.toMillis(), 1000);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("capacity creation uses create precondition; conflicts never return success", async () => {
  for (const failCommit of [false, true]) {
    const f = fixture({ "hospitals/centre": { status: "active" } }, { failCommit });
    const response = await f.load("app/api/hospital/capacity/route.ts").PATCH(request({ totalRooms: 5, occupiedRooms: 0 }));
    assert.equal(response.status, failCommit ? 503 : 200);
    assert.equal(f.calls.writes[0]?.[0], failCommit ? undefined : "create");
  }
});
test("package status batches reads, enforces ownership, and returns only changed fields", async () => {
  for (const owner of ["centre", "another-centre"]) {
    const f = fixture({ "hospitals/centre": { status: "active" }, "services/package": { hospitalId: owner, status: "active", description: "Private package details" } });
    const response = await f.load("app/api/hospital/services/[serviceId]/route.ts").PATCH(request({ action: "status", data: { status: "inactive" } }), context("serviceId", "package"));
    assert.equal(response.status, owner === "centre" ? 200 : 404);
    assert.equal(f.calls.batches, 1);
    if (owner === "centre") {
      const body = await response.json();
      assert.equal(body.changes.status, "inactive");
      assert.equal(body.changes.description, undefined);
      assert.equal(f.calls.writes.length, 2);
    } else assert.equal(f.calls.commits, 0);
  }
});
test("booking transitions remain validated and canonical results include completion fields", async () => {
  for (const treatmentStatus of ["completed", "started"]) {
    const f = fixture({ "hospitals/centre": { status: "active" }, "bookings/booking": { hospitalId: "centre", status: "confirmed", treatmentStatus: "ongoing" } });
    const response = await f.load("app/api/hospital/bookings/[bookingId]/route.ts").PATCH(request({ action: "treatment", treatmentStatus }), context("bookingId", "booking"));
    assert.equal(response.status, treatmentStatus === "completed" ? 200 : 409);
    assert.equal(f.calls.batches, 1);
    if (treatmentStatus === "completed") {
      const body = await response.json();
      assert.equal(body.changes.status, "completed");
      assert.ok(body.changes.treatmentCompletedAt.__ayursargaTimestamp);
    } else assert.equal(f.calls.commits, 0);
  }
});

test("hospital can start automatically confirmed treatment without an exact appointment time or approval", async () => {
  const f = fixture({ "hospitals/centre": { status: "active" }, "bookings/booking": {
    hospitalId: "centre", status: "confirmed", treatmentStatus: "not_started",
    confirmedDate: Timestamp.fromDate(new Date("2099-10-25T00:00:00+05:30")), confirmedTime: null,
  } });
  const response = await f.load("app/api/hospital/bookings/[bookingId]/route.ts").PATCH(request({ action: "treatment", treatmentStatus: "started" }), context("bookingId", "booking"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.changes.treatmentStatus, "started");
  assert.ok(body.changes.treatmentStartedAt.__ayursargaTimestamp);
  assert.equal(f.calls.commits, 1);
  assert.equal(f.calls.writes.length, 2);
});

test("Hospital can complete treatment directly after start with audited completion timestamps", async () => {
  const f = fixture({ "hospitals/centre": { status: "active" }, "bookings/booking": {
    hospitalId: "centre", status: "confirmed", treatmentStatus: "started",
  } });
  const response = await f.load("app/api/hospital/bookings/[bookingId]/route.ts").PATCH(request({ action: "treatment", treatmentStatus: "completed" }), context("bookingId", "booking"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.changes.status, "completed");
  assert.equal(body.changes.treatmentStatus, "completed");
  assert.ok(body.changes.completedAt.__ayursargaTimestamp);
  assert.ok(body.changes.treatmentCompletedAt.__ayursargaTimestamp);
  assert.equal(f.calls.commits, 1);
  assert.equal(f.calls.writes.length, 2);
});

test("legacy Hospital confirmation emails follow successful commits, never failed updates or treatment changes", async () => {
  for (const failCommit of [false, true]) {
    const f = fixture({ "hospitals/centre": { status: "active" }, "bookings/booking": {
      hospitalId: "centre", status: "requested", consumerEmail: "patient@example.com", serviceName: "7-day package",
    } }, { failCommit });
    const response = await f.load("app/api/hospital/bookings/[bookingId]/route.ts").PATCH(request({
      action: "booking", status: "confirmed", confirmedDate: "2099-10-25", confirmedTime: "10:30",
    }), context("bookingId", "booking"));
    assert.equal(response.status, failCommit ? 503 : 200);
    assert.equal(f.calls.emails.length, failCommit ? 0 : 1);
    if (!failCommit) assert.equal(f.calls.emails[0][2].consumerEmail, "patient@example.com");
  }
});
test("inactive hospitals and denied roles cannot write optimized routes", async () => {
  for (const denied of [false, true]) {
    const f = fixture({ "hospitals/centre": { status: "inactive" } }, { denied });
    const response = await f.load("app/api/hospital/capacity/route.ts").PATCH(request({ totalRooms: 5, occupiedRooms: 1 }));
    assert.equal(response.status, 403);
    assert.equal(f.calls.commits, 0);
  }
});
test("Admin assessment rechecks the revision transactionally and returns the committed delta without a post-save read", async () => {
  const f = fixture({ "hospitals/centre": { status: "active", name: "Centre", email: "private@example.com" } });
  const response = await f.load("app/api/admin/hospitals/[hospitalId]/route.ts").PATCH(request({ action: "update", data: { ayursargaRating: 4.5, ayursargaReviewNote: "Editorial assessment" } }), context("hospitalId", "centre"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.changes.ayursargaRating, 4.5);
  assert.equal(body.changes.email, undefined);
  assert.ok(body.changes.lastAuditId);
  assert.equal(f.calls.singles, 2);
  assert.equal(f.calls.commits, 1);
  assert.equal(f.calls.writes.length, 2);
});
test("overlapping identical requests share one write; later actions and retries remain independent", async () => {
  const { shareInFlightRequest } = loadTypeScript("utils/inFlightRequests.ts");
  let count = 0;
  const operation = async () => { count++; await new Promise((resolve) => setTimeout(resolve, 10)); return count; };
  await Promise.all([shareInFlightRequest("same", operation), shareInFlightRequest("same", operation)]);
  assert.equal(count, 1);
  await shareInFlightRequest("same", operation);
  assert.equal(count, 2);
  await Promise.all([shareInFlightRequest("user-a", operation), shareInFlightRequest("user-b", operation)]);
  assert.equal(count, 4);
  await assert.rejects(shareInFlightRequest("retry", async () => { throw new Error("failed"); }));
  assert.equal(await shareInFlightRequest("retry", async () => "retry succeeded"), "retry succeeded");
});

test("actual API client shares overlapping writes, hydrates timestamps, and never retries failures automatically", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let requests = 0;
  let tokens = 0;
  let fail = false;
  let complete = true;
  globalThis.fetch = async (_url, options) => {
    requests++;
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.get("authorization"), "Bearer test-token");
    await new Promise((resolve) => setTimeout(resolve, 10));
    return Response.json(fail ? { error: "Rejected" } : complete ? { changes: { status: "active", updatedAt: { __ayursargaTimestamp: [100, 123] } } } : { ok: true }, { status: fail ? 409 : 200 });
  };
  const { authorizedMutationRequest } = loadTypeScript("services/api/client.ts", {
    "@/services/auth/client": { getClientAuth: () => ({ currentUser: { uid: "test-user", getIdToken: async () => { tokens++; return "test-token"; } } }) },
    "firebase/firestore": { Timestamp },
  });
  const options = { method: "PATCH", body: '{"status":"active"}', signedOutMessage: "Signed out", failureMessage: "Failed" };
  const [first, second] = await Promise.all([authorizedMutationRequest("/api/test", options), authorizedMutationRequest("/api/test", options)]);
  assert.equal(requests, 1);
  assert.equal(tokens, 1);
  assert.equal(first.updatedAt.seconds, 100);
  assert.equal(first.updatedAt.nanoseconds, 123);
  assert.equal(first.updatedAt.toDate().getTime(), 100000);
  assert.equal(second.status, "active");
  fail = true;
  await assert.rejects(authorizedMutationRequest("/api/test", options), /Rejected/);
  assert.equal(requests, 2);
  fail = false;
  await authorizedMutationRequest("/api/test", options);
  assert.equal(requests, 3);
  complete = false;
  await assert.rejects(authorizedMutationRequest("/api/test", options), /response was incomplete/);
});
