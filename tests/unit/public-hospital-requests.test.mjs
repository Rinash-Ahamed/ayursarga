import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

function service() {
  return loadTypeScript("services/hospitals/publicHospitalService.ts", { "firebase/firestore": { Timestamp: { fromDate: (date) => date } } });
}

test("identical public GETs share one in-flight response, not completed outcomes", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return Response.json({ documents: [], cursor: null, hasMore: false });
  });
  const api = service();
  await Promise.all([api.listPublicHospitals(), api.listPublicHospitals()]);
  assert.equal(calls, 1);
  await api.listPublicHospitals();
  assert.equal(calls, 2);
  await Promise.all([api.listPublicHospitals({ pageSize: 8 }), api.listPublicHospitals({ pageSize: 12 })]);
  assert.equal(calls, 4);
});

test("failed public requests are not cached and may be retried", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    if (++calls === 1) return Response.json({ error: "Unavailable" }, { status: 503 });
    return Response.json({ documents: [] });
  });
  const api = service();
  await assert.rejects(api.listPublicHospitals(), /Unavailable/);
  assert.equal((await api.listPublicHospitals()).documents.length, 0);
  assert.equal(calls, 2);
});

test("caller-abortable package reads remain independent", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return Response.json({ documents: [] });
  });
  const api = service();
  await Promise.all([
    api.listPublicHospitalServices("centre", { signal: new AbortController().signal }),
    api.listPublicHospitalServices("centre", { signal: new AbortController().signal }),
  ]);
  assert.equal(calls, 2);
});
