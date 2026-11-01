import { test } from "node:test";
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
import { consultationPaymentFixture, paidConsultant, paidInput } from "../helpers/consultationPaymentFixture.mjs";

if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080") throw Error("Only the local demo Firestore emulator is permitted.");
test("native Firestore transactions serialize competing payment holds and captured booking confirmation", async()=>{
  const app=initializeApp({projectId:"demo-ayursarga"},`slots-${randomUUID()}`);
  const firestore=getFirestore(app), fake=consultationPaymentFixture();
  const uid=`slot-user-${randomUUID()}`, consultantId=`AS${randomInt(10000000,99999999)}`;
  try {
    await firestore.collection("users").doc(uid).set({...fake.profile,uid,role:"consumer",status:"active"});
    await firestore.collection("users").doc(`admin-${uid}`).set({role:"admin",status:"active"});
    await firestore.collection("consultants").doc(consultantId).set(paidConsultant);
    const api=loadTypeScript("services/payments/consultationPaymentsAdmin.ts",{
      "@/services/payments/razorpay":fake.provider,
      "@/services/auth/authEmailService":{authEmailSiteUrl:()=>"https://ayursarga.com"},
      "@/services/email/emailService":{sendEmail:async()=>{throw Error("SMTP is forbidden in emulator tests");}},
    });
    const requests=[0,1].map(i=>({...paidInput,consultantId,requestId:`emulator-${randomUUID()}-${i}`,expectedCancellationPolicyVersion:"consultation-published-48h-v1"}));
    const results=await Promise.allSettled(requests.map(body=>api.prepareConsultationPayment(firestore,uid,body)));
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    assert.equal(results.find(r=>r.status==="rejected").reason.status,409);
    const checkout=results.find(r=>r.status==="fulfilled").value;
    fake.capture(checkout);
    const confirmed=await api.reconcileConsultationPayment(firestore,checkout.intentId,"pay_Synthetic");
    assert.equal(confirmed.state,"confirmed");
    const bookings=await firestore.collection("consultationBookings").where("consumerId","==",uid).get();
    assert.equal(bookings.size,1);assert.equal(bookings.docs[0].data().confirmedEndTime,"10:00");
    const day=(await firestore.collection("consultationSlotDays").doc(`${consultantId}_${paidInput.preferredDate}`).get()).data();
    assert.equal(day.entries["09:30"].state,"booked");
  } finally {await firestore.terminate();await deleteApp(app);}
});
