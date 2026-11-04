import { test } from "node:test";
import assert from "node:assert/strict";
import { Timestamp } from "firebase/firestore";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

test("identical overlapping authorized GETs share one fetch/token check, but subsequent reads stay fresh", async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  let release, requests = 0, tokens = 0;
  const gate = new Promise(resolve => { release = resolve; });
  globalThis.fetch = async (_url, options) => { requests++; assert.equal(options.cache,"no-store"); await gate; return Response.json({sequence:requests}); };
  const client = loadTypeScript("services/api/client.ts", {
    "@/services/auth/client": { getClientAuth: () => ({currentUser:{uid:"consumer-a",getIdToken:async()=>{tokens++;return "token";}}}) },
  });
  const options = {signedOutMessage:"Signed out",failureMessage:"Failed"};
  const first = client.authorizedApiRequest("/api/consultations/availability?date=2099-01-01",options);
  const second = client.authorizedApiRequest("/api/consultations/availability?date=2099-01-01",{...options,method:"GET"});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests,1); assert.equal(tokens,1); release();
  assert.deepEqual(await first,await second);
  await client.authorizedApiRequest("/api/consultations/availability?date=2099-01-01",options);
  assert.equal(requests,2); assert.equal(tokens,2);
});

test("authorized reads never share across users, query values, headers, request modes or independent abort scopes", async t => {
  const original=globalThis.fetch; t.after(()=>{globalThis.fetch=original;});
  let release, requests=0;
  const gate=new Promise(resolve=>{release=resolve;});
  const auth={currentUser:{uid:"admin-a",getIdToken:async()=>"token-a"}};
  globalThis.fetch=async()=>{requests++;await gate;return Response.json({ok:true});};
  const client=loadTypeScript("services/api/client.ts",{"@/services/auth/client":{getClientAuth:()=>auth}});
  const options={signedOutMessage:"Signed out",failureMessage:"Failed"};
  const pending=[client.authorizedApiRequest("/api/example?a=1",options)];
  auth.currentUser={uid:"consumer-b",getIdToken:async()=>"token-b"};
  pending.push(client.authorizedApiRequest("/api/example?a=1",options));
  pending.push(client.authorizedApiRequest("/api/example?a=2",options));
  pending.push(client.authorizedApiRequest("/api/example?a=1",{...options,headers:{Accept:"application/json"}}));
  pending.push(client.authorizedApiRequest("/api/example?a=1",{...options,credentials:"omit"}));
  pending.push(client.authorizedApiRequest("/api/example?a=1",{...options,signal:new AbortController().signal}));
  pending.push(client.authorizedApiRequest("/api/example?a=1",{...options,signal:new AbortController().signal}));
  await new Promise(resolve=>setImmediate(resolve)); assert.equal(requests,7); release(); await Promise.all(pending);
});

test("failed authorized reads can retry and preserve caller-specific errors without caching failures", async t => {
  const original=globalThis.fetch; t.after(()=>{globalThis.fetch=original;});
  let requests=0;
  globalThis.fetch=async()=>{requests++;return Response.json({error:"Permission denied"},{status:403});};
  const client=loadTypeScript("services/api/client.ts",{"@/services/auth/client":{getClientAuth:()=>({currentUser:{uid:"user",getIdToken:async()=>"token"}})}});
  const options={signedOutMessage:"Signed out",failureMessage:"Failed"};
  await assert.rejects(client.authorizedApiRequest("/api/example",options),/Permission denied/);
  await assert.rejects(client.authorizedApiRequest("/api/example",options),/Permission denied/);
  assert.equal(requests,2);
});

test("shared failed GET transport retains each caller's fallback message", async t => {
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  let requests=0;
  globalThis.fetch=async()=>{requests++;return Response.json({},{status:503});};
  const client=loadTypeScript("services/api/client.ts",{"@/services/auth/client":{getClientAuth:()=>({currentUser:{uid:"user",getIdToken:async()=>"token"}})}});
  const results=await Promise.allSettled([client.authorizedApiRequest("/api/shared",{signedOutMessage:"Sign in",failureMessage:"Could not load bookings"}),client.authorizedApiRequest("/api/shared",{signedOutMessage:"Sign in",failureMessage:"Could not load dashboard"})]);
  assert.equal(requests,1);
  assert.equal(results[0].reason.message,"Could not load bookings"); assert.equal(results[1].reason.message,"Could not load dashboard");
  assert.equal(results[0].reason.status,503); assert.equal(results[1].reason.status,503);
});

test("post-mutation refreshes cannot reuse a GET that started before the save", async t => {
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  let release,reads=0;
  const gate=new Promise(resolve=>{release=resolve;});
  globalThis.fetch=async(_url,options)=>{
    if(options.method==="PATCH")return Response.json({changes:{status:"active"}});
    const sequence=++reads;if(sequence===1)await gate;
    return Response.json({sequence});
  };
  const client=loadTypeScript("services/api/client.ts",{"@/services/auth/client":{getClientAuth:()=>({currentUser:{uid:"user",getIdToken:async()=>"token"}})}});
  const options={signedOutMessage:"Signed out",failureMessage:"Failed"};
  const old=client.authorizedApiRequest("/api/shared",options);
  await new Promise(resolve=>setImmediate(resolve));
  await client.authorizedMutationRequest("/api/change",{...options,method:"PATCH",body:"{}"});
  const fresh=await client.authorizedApiRequest("/api/shared",options);
  assert.equal(reads,2);assert.equal(fresh.sequence,2);release();assert.equal((await old).sequence,1);
});

test("shared mutation decoding retains timestamps, metadata separation and each caller's incomplete-response message", () => {
  const {readMutationChanges}=loadTypeScript("services/api/client.ts",{"@/services/auth/client":{getClientAuth:()=>({currentUser:null})}});
  const result=readMutationChanges({updatedAt:{__ayursargaTimestamp:[100,123]},nested:[{value:1}],reason:null});
  assert.equal(result.updatedAt.toDate().getTime(),100000); assert.equal(result.updatedAt.nanoseconds,123);
  assert.deepEqual(result.nested,[{value:1}]); assert.equal(result.reason,null);
  for(const value of [undefined,null,[],"text",3]) {
    assert.throws(()=>readMutationChanges(value),/The update response was incomplete/);
    assert.throws(()=>readMutationChanges(value,"Check the saved refund first"),/Check the saved refund first/);
  }
});

test("contract signing and activation retain identical URL acceptance and length limits", () => {
  const {validContractUrl}=loadTypeScript("features/hospitals/contractApproval.ts");
  for(const value of ["https://example.test/contract.pdf","https://example.test/?signed=1"," https://example.test "]) assert.equal(validContractUrl(value),true);
  for(const value of [null,undefined,123,"","/contract.pdf","http://example.test/contract.pdf","javascript:alert(1)",`https://example.test/${"x".repeat(500)}`]) assert.equal(validContractUrl(value),false);
  const base="https://example.test/"; assert.equal(validContractUrl(base+"x".repeat(500-base.length)),true);
});

test("shared field errors preserve alert markup, escaping and absence for valid fields", () => {
  const {FieldError}=loadTypeScript("components/forms/FieldError.tsx");
  assert.equal(renderToStaticMarkup(createElement(FieldError,{field:"email",errors:{}})),"");
  assert.equal(renderToStaticMarkup(createElement(FieldError,{field:"email",errors:{email:"Check <email>"}})), '<span class="portal-field-error" role="alert">Check &lt;email&gt;</span>');
});

test("Admin/Hospital booking filters share implementation without changing scope, order, dates, cursor or query count", async () => {
  const calls=[];
  const service=loadTypeScript("services/bookings/bookingService.ts",{
    "@/services/firestore/firestoreService":{runFilteredQuery:async input=>{calls.push(input);return {documents:[],cursor:null,hasMore:false};}},
    "firebase/firestore":{Timestamp},
    "@/services/api/client":{authorizedApiRequest:async()=>{throw Error("No extra reference API expected");}},
  });
  const start=new Date("2026-11-01T00:00:00+05:30"), end=new Date("2026-12-01T00:00:00+05:30");
  const filters={status:"confirmed",createdFrom:start,createdBefore:end}; const options={pageSize:20,cursor:"cursor"};
  await service.listAdminBookings({hospitalId:"centre",...filters},options);
  await service.listHospitalBookings("centre",filters,options);
  assert.equal(calls.length,2); assert.deepEqual(calls[0],calls[1]);
  assert.deepEqual(calls[0].filters.map(f=>[f.field,f.operator,f.value?.toDate?.()??f.value]),[["hospitalId","==","centre"],["status","==","confirmed"],["createdAt",">=",start],["createdAt","<",end]]);
  assert.equal(calls[0].cursor,"cursor"); assert.equal(calls[0].pageSize,20);
  await service.listAdminBookings({},options); assert.deepEqual(calls[2].filters,[]);
  await service.listHospitalBookings("",{},options); assert.deepEqual(calls[3].filters,[{field:"hospitalId",operator:"==",value:""}]);
});
