import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
import { consultationPaymentFixture, paidConsultant, paidInput, prepare, verify, paymentRequest } from "../helpers/consultationPaymentFixture.mjs";
const {generateConsultationSlots, intervalsOverlap} = loadTypeScript("features/consultations/slots.ts");
const date=paidInput.preferredDate;
async function checkout(f, changes={}) { const r=await prepare(f,{...paidInput,...changes}); assert.equal(r.status,200,await r.clone().text()); return (await r.json()).checkout; }
async function book(f, changes={}) {const c=await checkout(f,changes);f.capture(c,{id:`pay_${f.paymentState.orderCalls}`});const r=await verify(f,c.intentId,`pay_${f.paymentState.orderCalls}`);assert.equal(r.status,200);assert.equal((await r.json()).checkout.state,"confirmed");return c.intentId;}
const dayOf=f=>f.records.get(`consultationSlotDays/AS001_${date}`);
async function change(f,id,body) { return f.load("app/api/consultations/[bookingId]/route.ts").PATCH(paymentRequest(body,"PATCH"),{params:Promise.resolve({bookingId:id})}); }

test("30/60-minute generation includes the exact final slot and never extends configured hours",()=>{
  const provider={...paidConsultant,preferredSlotTimings:{morning:{startTime:"09:00",endTime:"12:00"}}};
  const regular=generateConsultationSlots(date,"prenatal-doctor",provider), psychology=generateConsultationSlots(date,"psychologist",provider);
  assert.equal(regular.length,6);assert.equal(psychology.length,3);
  assert.deepEqual(regular.at(-1),{startTime:"11:30",endTime:"12:00",window:"morning",status:"available"});
  assert.equal(psychology.at(-1).endTime,"12:00");
  const uneven=generateConsultationSlots(date,"prenatal-doctor",{...provider,preferredSlotTimings:{morning:{startTime:"09:00",endTime:"11:45"}}});
  assert.equal(uneven.at(-1).startTime,"11:15");assert.equal(uneven.at(-1).endTime,"11:45");
  assert.ok(uneven.every((slot,index)=>index===0||!intervalsOverlap(uneven[index-1],slot)));
  assert.equal(generateConsultationSlots(date,"psychologist",{...provider,preferredSlotTimings:{morning:{startTime:"09:00",endTime:"09:59"}}}).length,0);
  assert.equal(generateConsultationSlots(date,"prenatal-doctor",{...provider,availableDates:["2099-10-26"]}).length,0);
  assert.equal(intervalsOverlap({startTime:"09:00",endTime:"09:30"},{startTime:"09:30",endTime:"10:00"}),false);
});

test("simultaneous checkout requests reserve one slot once; retries cannot duplicate orders or holds",async()=>{
  const f=consultationPaymentFixture();
  const responses=await Promise.all([prepare(f),prepare(f,{...paidInput,requestId:"second-request-0001"})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(f.paymentState.orderCalls,1);
  assert.equal(f.values("consultationPaymentIntents").length,1);assert.equal(Object.keys(dayOf(f).entries).length,1);
  assert.equal((await prepare(f)).status,200);assert.equal(f.paymentState.orderCalls,1);
  assert.equal(dayOf(f).entries["09:30"].state,"held");
});

test("different Consumers racing for the same consultant interval cannot both obtain payment orders",async()=>{
  const f=consultationPaymentFixture();f.records.set("users/other-consumer",{...f.profile,uid:"other-consumer"});
  const api=f.load("services/payments/consultationPaymentsAdmin.ts");
  const body={...paidInput,expectedCancellationPolicyVersion:"consultation-published-48h-v1"};
  const results=await Promise.allSettled([api.prepareConsultationPayment(f.firestore,"patient",body),api.prepareConsultationPayment(f.firestore,"other-consumer",body)]);
  assert.equal(results.filter(result=>result.status==="fulfilled").length,1);
  assert.equal(results.find(result=>result.status==="rejected").reason.status,409);
  assert.equal(f.paymentState.orderCalls,1);
});

test("the final regular and Psychology slots confirm with their exact end time",async()=>{
  for(const [serviceId,start] of [["prenatal-doctor","11:30"],["psychologist","11:00"]]) {
    const f=consultationPaymentFixture({records:{"consultants/AS001":{...paidConsultant,consultationServices:[serviceId],preferredSlotTimings:{morning:{startTime:"09:00",endTime:"12:00"}}}}});
    const id=await book(f,{serviceId,appointmentStartTime:start,expectedSlotStartTime:"09:00",expectedSlotEndTime:"12:00"});
    assert.equal(f.records.get(`consultationBookings/${id}`).confirmedTime,start);
    assert.equal(f.records.get(`consultationBookings/${id}`).confirmedEndTime,"12:00");
  }
});

test("failed payments never confirm and their holds stop blocking at expiry without deleting history",async()=>{
  const f=consultationPaymentFixture();const c=await checkout(f);
  f.capture(c,{captured:false,status:"failed"});
  await verify(f,c.intentId);assert.equal(f.values("consultationBookings").length,0);
  assert.equal((await prepare(f,{...paidInput,requestId:"failed-payment-retry-001"})).status,409);
  dayOf(f).entries["09:30"].expiresAt=Date.now()-1;
  assert.equal((await prepare(f,{...paidInput,requestId:"expired-payment-retry-001"})).status,200);
  assert.equal(f.values("consultationPaymentIntents").length,2);
});

test("mixed 30/60-minute services share overlap protection and adjacent slots remain bookable",async()=>{
  const f=consultationPaymentFixture({records:{"consultants/AS001":{...paidConsultant,consultationServices:["prenatal-doctor","psychologist"]}}});
  await checkout(f,{serviceId:"psychologist"});
  assert.equal((await prepare(f,{...paidInput,requestId:"overlap-attempt-0001",appointmentStartTime:"10:00"})).status,409);
  assert.equal((await prepare(f,{...paidInput,requestId:"adjacent-attempt-0001",appointmentStartTime:"10:30"})).status,200);
});

test("expired holds reopen without deletions; delayed payment cannot steal a newer hold",async()=>{
  const f=consultationPaymentFixture();const old=await checkout(f);
  dayOf(f).entries["09:30"].expiresAt=Date.now()-1;
  f.records.get(`consultationPaymentIntents/${old.intentId}`).holdExpiresAt=Date.now()-1;
  const next=await checkout(f,{requestId:"replacement-attempt-001"});
  f.capture(old,{id:"pay_Late"});const response=await verify(f,old.intentId,"pay_Late");
  assert.equal((await response.json()).checkout.state,"paid_review");
  assert.equal(f.values("consultationBookings").length,0);assert.equal(f.values("consultationFinancials")[0].settlementHold,true);
  assert.equal(dayOf(f).entries["09:30"].ownerId,next.intentId);
  f.capture(next,{id:"pay_Current"});assert.equal((await verify(f,next.intentId,"pay_Current")).status,200);
  assert.equal(f.values("consultationBookings").length,1);assert.equal(dayOf(f).entries["09:30"].state,"booked");
});

test("successful cancellation reopens time; failed cancellation/reschedule commits preserve original reservations",async()=>{
  const f=consultationPaymentFixture();const id=await book(f);
  const original=f.firestore.runTransaction;
  f.firestore.runTransaction=callback=>original(async tx=>{await callback(tx);throw Error("Synthetic commit rejection");});
  assert.equal((await change(f,id,{action:"cancelled"})).status,503);
  assert.equal(dayOf(f).entries["09:30"].state,"booked");
  f.actor.role="admin";
  assert.equal((await change(f,id,{action:"reschedule",requestId:"failed-reschedule-001",confirmedDate:date,confirmedTime:"10:30"})).status,503);
  assert.equal(dayOf(f).entries["09:30"].state,"booked");assert.equal(dayOf(f).entries["10:30"],undefined);
  f.actor.role="consumer";
  f.firestore.runTransaction=original;
  assert.equal((await change(f,id,{action:"cancelled"})).status,200);
  assert.equal(dayOf(f).entries["09:30"].state,"released");
  assert.equal((await prepare(f,{...paidInput,requestId:"reopened-slot-attempt-001"})).status,200);
});

test("reschedule atomically frees the old range and rejects a booked or payment-held destination",async()=>{
  const f=consultationPaymentFixture();const id=await book(f);
  await checkout(f,{requestId:"other-slot-attempt-001",appointmentStartTime:"10:00"});
  f.actor.role="admin";
  const action={action:"reschedule",requestId:"admin-reschedule-001",confirmedDate:date,confirmedTime:"10:00"};
  assert.equal((await change(f,id,action)).status,409);assert.equal(dayOf(f).entries["09:30"].state,"booked");
  assert.equal((await change(f,id,{...action,confirmedTime:"10:30"})).status,200);
  assert.equal(dayOf(f).entries["09:30"].state,"released");assert.equal(dayOf(f).entries["10:30"].state,"booked");
  assert.equal(f.records.get(`consultationBookings/${id}`).confirmedEndTime,"11:00");
});

test("legacy unknown-time bookings block their whole window without rewriting historical records",async()=>{
  const legacy={consultantId:"AS001",preferredDate:date,confirmedDate:date,confirmedTime:null,slotStartTime:"09:30",slotEndTime:"11:45",status:"confirmed",archivedAt:null};
  const f=consultationPaymentFixture({records:{"consultationBookings/legacy":legacy}});
  assert.equal((await prepare(f)).status,409);assert.deepEqual(f.records.get("consultationBookings/legacy"),legacy);
});

test("legacy exact-start bookings without an agreed duration retain their quoted end boundary",async()=>{
  const f=consultationPaymentFixture({records:{"consultationBookings/legacy":{consultantId:"AS001",preferredDate:date,confirmedDate:date,confirmedTime:"10:00",slotStartTime:"09:30",slotEndTime:"11:45",status:"confirmed",archivedAt:null}}});
  assert.equal((await prepare(f,{...paidInput,appointmentStartTime:"11:00"})).status,409);
  assert.equal((await prepare(f)).status,200);
});

test("slot API returns safe states to Admin, available times only to Consumers and denies Hospital/exclusion bypass",async()=>{
  const f=consultationPaymentFixture();await checkout(f);
  const get=query=>f.load("app/api/consultations/slots/route.ts").GET(new Request(`https://test.local/api/consultations/slots?consultantId=AS001&service=prenatal-doctor&date=${date}${query}`));
  const response=await get("");assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
  const consumer=await response.json();assert.equal(consumer.slots.length,3);assert.ok(consumer.slots.every(slot=>slot.status==="available"));
  assert.doesNotMatch(JSON.stringify(consumer),/ownerId|consumerId|commission|payable|patient@example/);
  assert.equal((await get("&excludeBookingId=consultation-"+"a".repeat(64))).status,400);
  f.actor.role="admin";const admin=await (await get("")).json();assert.equal(admin.slots[0].status,"reserved");
  f.actor.role="hospital";assert.equal((await get("")).status,403);
  assert.match(readFileSync("firestore.rules","utf8"),/match \/consultationSlotDays\/\{id\} \{ allow read, write: if false; \}/);
});
