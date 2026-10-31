import { test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

if(process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080") throw new Error("Use only the local Firestore demo emulator.");
test("package summary runs real consistent read-only count queries without changing package records", async () => {
  const id=`summary-${randomUUID()}`;
  const app=initializeApp({projectId:"demo-ayursarga"},id);
  try {
    const firestore=getFirestore(app);
    const batch=firestore.batch();
    const states=["pending","approved","draft","changes_requested",undefined,"pending"];
    states.forEach((reviewStatus,index)=>batch.set(firestore.collection("services").doc(`${id}-${index}`),{
      hospitalId:id,status:index===5?"archived":"inactive",archivedAt:index===5?new Date():null,...(reviewStatus?{reviewStatus}:{}),
    }));
    await batch.commit();
    const {POST}=loadTypeScript("app/api/admin/hospitals/package-summary/route.ts",{
      "@/services/firebase/adminAuthorization":{requireActiveAdmin:async()=>({firestore}),AdminAuthorizationError:class extends Error{}},
      "@/services/api/server":{apiJson:(body,status=200)=>Response.json(body,{status})},
    });
    const response=await POST(new Request("https://local.test/api/admin/hospitals/package-summary",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({hospitalIds:[id]})}));
    assert.equal(response.status,200,await response.clone().text());
    assert.deepEqual((await response.json()).summaries[id],{total:5,pending:1,approved:2,draft:1,changesRequested:1});
    const unchanged=await firestore.collection("services").where("hospitalId","==",id).get();
    assert.equal(unchanged.size,6);
    assert.equal(unchanged.docs.every(doc=>!Object.hasOwn(doc.data(),"updatedAt")),true);
  } finally {await deleteApp(app);}
});
