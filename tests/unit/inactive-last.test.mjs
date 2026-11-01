import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const { inactiveLast } = loadTypeScript("utils/statusOrder.ts");
test("inactive partition is stable, non-mutating and leaves unrelated booking states alone", () => {
  const items = [{ id: 1, status: "inactive" }, { id: 2, status: "pending" }, { id: 3, status: "active" }, { id: 4, status: "inactive" }];
  assert.deepEqual(inactiveLast(items).map(item => item.id), [2, 3, 1, 4]);
  assert.deepEqual(items.map(item => item.id), [1, 2, 3, 4]);
  const bookings = [{ status: "cancelled" }, { status: "confirmed" }, { status: "completed" }];
  assert.deepEqual(inactiveLast(bookings), bookings);
  assert.deepEqual(inactiveLast([{ status: "active" }, { status: "inactive" }].map((item, id) => ({ ...item, id, status: id === 0 ? "inactive" : "active" }))).map(item => item.id), [1, 0]);
});

function fixture(records) {
  const calls = [];
  const { runStatusOrderedQuery } = loadTypeScript("services/firestore/statusOrderedQuery.ts", {
    "@/services/firestore/firestoreService": { runFilteredQuery: async options => {
      calls.push(options);
      const status = options.filters.find(filter => filter.field === "status");
      let matching = records.filter(item => status.operator === "in" ? status.value.includes(item.status) : item.status === status.value);
      if (options.startAtValues) matching = matching.filter(item => item.name >= options.startAtValues[0]);
      if (options.endAtValues) matching = matching.filter(item => item.name <= options.endAtValues[0]);
      const offset = options.cursor?.offset ?? 0;
      const page = matching.slice(offset, offset + options.pageSize);
      return { documents: options.excludeArchived === false ? page : page.filter(item => item.status !== "archived" && item.archivedAt == null), cursor: page.length ? { offset: offset + page.length } : null, hasMore: matching.length > offset + options.pageSize };
    } },
  });
  return { runStatusOrderedQuery, calls };
}

test("bounded phase cursors put every current result before inactive records across page boundaries", async () => {
  for (const [current, inactive, size] of [[0, 0, 2], [0, 5, 2], [1, 5, 3], [2, 0, 2], [2, 5, 2], [5, 2, 2], [7, 8, 3]]) {
    const records = Array.from({ length: current + inactive }, (_, index) => ({ id: `record-${index}`, name: "Centre", status: index < inactive ? "inactive" : index % 2 ? "pending" : "active" }));
    const f = fixture(records);
    const documents = [];
    let cursor = null;
    for (let page = 0; page < 20; page++) {
      const readsBefore = f.calls.length;
      const result = await f.runStatusOrderedQuery({ collectionPath: "hospitals", sort: { field: "createdAt", direction: "desc" }, cursor, pageSize: size });
      assert.ok(f.calls.length - readsBefore <= 2);
      assert.ok(result.documents.length <= size);
      documents.push(...result.documents);
      cursor = result.cursor;
      if (!result.hasMore) break;
      assert.ok(page < 19, "pagination terminates");
    }
    assert.deepEqual(documents, inactiveLast(records));
    assert.equal(new Set(documents.map(item => item.id)).size, records.length);
    assert.ok(f.calls.every(call => call.pageSize <= size && call.sort.field === "createdAt"));
  }
});

test("search bounds, role/tenant filters and archive compatibility survive the phase transition", async () => {
  const records = [{ id: "inactive", name: "Ayur inactive", status: "inactive" }, { id: "other", name: "Different", status: "active" }, { id: "legacy", name: "Ayur legacy", status: "active" }, { id: "archived", name: "Ayur archived", status: "archived", archivedAt: "date" }];
  const f = fixture(records);
  const options = { collectionPath: "services", filters: [{ field: "hospitalId", operator: "==", value: "centre" }], sort: { field: "name", direction: "asc" }, startAtValues: ["Ayur"], endAtValues: ["Ayur\uf8ff"], pageSize: 10 };
  const result = await f.runStatusOrderedQuery(options);
  assert.deepEqual(result.documents.map(item => item.id), ["legacy", "inactive"]);
  for (const call of f.calls) {
    assert.deepEqual(call.filters[0], options.filters[0]);
    assert.deepEqual(call.startAtValues, options.startAtValues);
    assert.deepEqual(call.endAtValues, options.endAtValues);
  }
  const visible = await f.runStatusOrderedQuery({ ...options, excludeArchived: false });
  assert.deepEqual(visible.documents.map(item => item.id), ["legacy", "archived", "inactive"]);
});

test("all operational list query variants have matching declared Firestore indexes", () => {
  const indexes = JSON.parse(readFileSync("firestore.indexes.json", "utf8")).indexes;
  for (const [collection, fields] of [
    ["hospitals", ["status:ASCENDING", "createdAt:DESCENDING"]], ["hospitals", ["status:ASCENDING", "name:ASCENDING"]],
    ["users", ["role:ASCENDING", "status:ASCENDING", "createdAt:DESCENDING"]],
    ["consultants", ["status:ASCENDING", "employeeSequence:DESCENDING"]], ["consultants", ["status:ASCENDING", "employeeId:ASCENDING"]], ["consultants", ["status:ASCENDING", "name:ASCENDING"]],
    ["services", ["hospitalId:ASCENDING", "status:ASCENDING", "name:ASCENDING"]],
  ]) assert.ok(indexes.some(index => index.collectionGroup === collection && index.fields.map(field => `${field.fieldPath}:${field.order}`).join() === fields.join()), `${collection} ${fields}`);
});
