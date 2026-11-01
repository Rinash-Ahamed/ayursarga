import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
const { uniqueRecords, appendUniqueRecords } = loadTypeScript("utils/recordIdentity.ts");

test("replace/reload and append remove duplicate IDs while preserving distinct records and local edits", () => {
  const old = { id: "AS002", name: "Before" };
  const current = { id: "AS002", name: "Edited" };
  assert.deepEqual(uniqueRecords([old, { id: "AS001" }, current]), [current, { id: "AS001" }]);
  assert.deepEqual(appendUniqueRecords([current], [old, { id: "AS003", name: "First" }, { id: "AS003", name: "Latest" }]), [current, { id: "AS003", name: "Latest" }]);
  const separate = [{ id: "real-document-1", employeeId: "AS002" }, { id: "real-document-2", employeeId: "AS002" }];
  assert.deepEqual(uniqueRecords(separate), separate);
});

test("Firestore reads and queries cannot have their canonical document ID overridden by legacy stored id fields", async () => {
  const docs = ["real-document-1", "real-document-2"].map(id => ({ id, exists: () => true, data: () => ({ id: "AS002", name: "Legacy", status: "active" }) }));
  const service = loadTypeScript("services/firestore/firestoreService.ts", {
    "firebase/firestore": { collection: () => ({}), doc: () => ({}), getDoc: async () => docs[0], getDocs: async () => ({ docs }),
      query: (...args) => args, where: (...args) => args, documentId: () => "__name__", orderBy: (...args) => args, limit: size => size },
    "@/services/firestore/client": { getClientFirestore: () => ({}) },
  });
  assert.equal((await service.readDocument("consultants", "real-document-1")).id, "real-document-1");
  assert.deepEqual((await service.readDocumentsByIds("consultants", ["real-document-1", "real-document-2"])).map(record => record.id), docs.map(doc => doc.id));
  assert.deepEqual((await service.runFilteredQuery({ collectionPath: "consultants" })).documents.map(record => record.id), docs.map(doc => doc.id));
});
