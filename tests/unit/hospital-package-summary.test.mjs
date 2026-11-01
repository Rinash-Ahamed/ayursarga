import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
import { setTimeout as delay } from "node:timers/promises";

class AuthError extends Error { constructor(status) { super("Denied"); this.status = status; } }
const record = (hospitalId, reviewStatus, extra = {}) => ({ hospitalId, reviewStatus, status: "inactive", archivedAt: null, ...extra });
const records = [record("one", "pending"), record("one", "approved"), record("one", "draft"), record("one", "changes_requested"),
  record("one", undefined), record("one", "pending", {status:"archived",archivedAt:"date"}), record("two", "approved"), record("one", "pending", {archivedAt:"date"})];
function fixture(options = {}) {
  const queries = [];
  const matches = filters => (options.records ?? records).filter(item => filters.every(([key, op, value]) => op === "in" ? value.includes(item[key]) : item[key] === value));
  function query(filters = [], maximum = Infinity) {
    return { where: (...filter) => query([...filters, filter], maximum),
      select: (...fields) => { assert.deepEqual(fields, ["hospitalId", "reviewStatus"]); return query(filters, maximum); },
      limit: value => { assert.equal(value, 201); return query(filters, value); },
      get: async () => {
        queries.push(filters);
        if (options.latency) await delay(options.latency);
        if (options.fail) throw new Error("Synthetic unavailable index");
        const docs = matches(filters).slice(0, maximum).map(({hospitalId, reviewStatus}) => ({ data: () => ({hospitalId, reviewStatus}) }));
        return {size: docs.length, docs};
      }, count: () => ({ get: async () => {
      queries.push(filters);
      if (options.latency) await delay(options.latency);
      if (options.fail) throw new Error("Synthetic unavailable index");
      return { data: () => ({ count: matches(filters).length }) };
    } }) };
  }
  const { POST } = loadTypeScript("app/api/admin/hospitals/package-summary/route.ts", {
    "@/services/firebase/adminAuthorization": { AdminAuthorizationError:AuthError, requireActiveAdmin:async () => { if(options.denied) throw new AuthError(options.denied); return {firestore:{collection:name => {assert.equal(name,"services");return query();}, runTransaction:async (callback,settings)=>{assert.deepEqual(settings,{readOnly:true});return callback({get:aggregate=>aggregate.get()});}}}; } },
    "@/services/api/server": {apiJson:(body,status=200)=>Response.json(body,{status})},
    "@/services/api/rateLimit": {allowRequest:()=>!options.rateLimited},
  });
  return { queries, sendRequest: POST, send: body => POST(new Request("https://test.local/api/admin/hospitals/package-summary", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})) };
}

test("package summary RPC latency benchmark (simulated database, not production)", async () => {
  const f = fixture({ latency: 20 });
  const started = performance.now();
  const response = await f.send({ hospitalIds: Array.from({ length: 20 }, (_, i) => `hospital-${i}`) });
  assert.equal(response.status, 200);
  console.log(JSON.stringify({ benchmark: "package-summary", simulatedRpcMs: 20, hospitals: 20, rpcCount: f.queries.length, elapsedMs: Math.round(performance.now() - started) }));
});
test("Admin package summaries count each review state, preserve legacy approval and exclude archived/cross-hospital packages", async () => {
  const f = fixture();
  const response = await f.send({hospitalIds:["one","two","empty"]});
  assert.equal(response.status,200);
  const {summaries} = await response.json();
  assert.deepEqual(summaries.one,{total:5,pending:1,approved:2,draft:1,changesRequested:1});
  assert.deepEqual(summaries.two,{total:1,pending:0,approved:1,draft:0,changesRequested:0});
  assert.deepEqual(summaries.empty,{total:0,pending:0,approved:0,draft:0,changesRequested:0});
  assert.equal(f.queries.length,1);
});
test("package summary denies unauthorized roles and rejects invalid or unbounded requests before database reads", async () => {
  for(const denied of [401,403]) {
    const f=fixture({denied});assert.equal((await f.send({hospitalIds:["one"]})).status,denied);assert.equal(f.queries.length,0);
  }
  for(const body of [null,{},[],{hospitalIds:[]},{hospitalIds:["one","one"]},{hospitalIds:Array(21).fill("one")},{hospitalIds:[null]},{hospitalIds:["../bad"]},{hospitalIds:["x".repeat(161)]}]) {
    const f=fixture();assert.equal((await f.send(body)).status,400);assert.equal(f.queries.length,0);
  }
});
test("summary failures are explicit rather than reporting falsely approved packages", async () => {
  const response=await fixture({fail:true}).send({hospitalIds:["one"]});
  assert.equal(response.status,503);
  assert.equal(Object.hasOwn(await response.json(),"summaries"),false);
});
test("summary page size is bounded to 20 hospitals and special document IDs remain plain response keys", async () => {
  const f=fixture();
  assert.equal((await f.send({hospitalIds:Array.from({length:20},(_,index)=>`hospital-${index}`)})).status,200);
  assert.equal(f.queries.length,2);
  const response=await fixture().send({hospitalIds:["__proto__"]});
  const {summaries}=await response.json();
  assert.equal(Object.hasOwn(summaries,"__proto__"),true);
  assert.equal(summaries.__proto__.total,0);
});

test("large package datasets retain exact totals through bounded count fallback", async () => {
  for (const count of [200, 201, 230]) {
    const f = fixture({records:Array.from({length:count}, (_, i) => record("one", i % 2 ? "pending" : "approved"))});
    const response = await f.send({hospitalIds:["one", "empty"]});
    assert.equal(response.status,200);
    const {summaries} = await response.json();
    assert.equal(summaries.one.total,count);
    assert.equal(summaries.one.pending,Math.floor(count/2));
    assert.equal(summaries.one.approved,Math.ceil(count/2));
    assert.equal(summaries.empty.total,0);
    assert.equal(f.queries.length,count < 201 ? 1 : 9);
  }
});

test("summary throttles authenticated repeated requests before querying", async () => {
  const f = fixture({rateLimited:true});
  assert.equal((await f.send({hospitalIds:["one"]})).status,429);
  assert.equal(f.queries.length,0);
});

test("summary rejects malformed JSON, unsupported types and oversized bodies before database reads", async () => {
  for (const [body, type, status] of [["{}", "text/plain", 415], ["{", "application/json", 400], [JSON.stringify({hospitalIds:["one"], extra:"x".repeat(5000)}), "application/json", 413]]) {
    const f = fixture();
    const response = await f.sendRequest(new Request("https://test.local/api/admin/hospitals/package-summary", {method:"POST",headers:{"content-type":type},body}));
    assert.equal(response.status,status);
    assert.equal(f.queries.length,0);
  }
});
