import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

class AuthError extends Error { constructor(status) { super("Denied"); this.status = status; } }
const record = (hospitalId, reviewStatus, extra = {}) => ({ hospitalId, reviewStatus, status: "inactive", archivedAt: null, ...extra });
const records = [record("one", "pending"), record("one", "approved"), record("one", "draft"), record("one", "changes_requested"),
  record("one", undefined), record("one", "pending", {status:"archived",archivedAt:"date"}), record("two", "approved"), record("one", "pending", {archivedAt:"date"})];
function fixture(options = {}) {
  const queries = [];
  function query(filters = []) {
    return { where: (...filter) => query([...filters, filter]), count: () => ({ get: async () => {
      queries.push(filters);
      if (options.fail) throw new Error("Synthetic unavailable index");
      return { data: () => ({ count: records.filter(item => filters.every(([key, op, value]) => op === "in" ? value.includes(item[key]) : item[key] === value)).length }) };
    } }) };
  }
  const { POST } = loadTypeScript("app/api/admin/hospitals/package-summary/route.ts", {
    "@/services/firebase/adminAuthorization": { AdminAuthorizationError:AuthError, requireActiveAdmin:async () => { if(options.denied) throw new AuthError(options.denied); return {firestore:{collection:name => {assert.equal(name,"services");return query();}, runTransaction:async (callback,settings)=>{assert.deepEqual(settings,{readOnly:true});return callback({get:aggregate=>aggregate.get()});}}}; } },
    "@/services/api/server": {apiJson:(body,status=200)=>Response.json(body,{status})},
  });
  return { queries, send: body => POST(new Request("https://test.local/api/admin/hospitals/package-summary", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})) };
}
test("Admin package summaries count each review state, preserve legacy approval and exclude archived/cross-hospital packages", async () => {
  const f = fixture();
  const response = await f.send({hospitalIds:["one","two","empty"]});
  assert.equal(response.status,200);
  const {summaries} = await response.json();
  assert.deepEqual(summaries.one,{total:5,pending:1,approved:2,draft:1,changesRequested:1});
  assert.deepEqual(summaries.two,{total:1,pending:0,approved:1,draft:0,changesRequested:0});
  assert.deepEqual(summaries.empty,{total:0,pending:0,approved:0,draft:0,changesRequested:0});
  assert.equal(f.queries.length,12);
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
  assert.equal(f.queries.length,80);
  const response=await fixture().send({hospitalIds:["__proto__"]});
  const {summaries}=await response.json();
  assert.equal(Object.hasOwn(summaries,"__proto__"),true);
  assert.equal(summaries.__proto__.total,0);
});
