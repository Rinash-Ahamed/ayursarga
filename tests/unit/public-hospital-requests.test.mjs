import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";
import { readFileSync } from "node:fs";

test("hospital descriptions stay private while package descriptions remain public", () => {
  const api = loadTypeScript("services/hospitals/publicProjection.ts");
  const stored = { name: "Test centre", description: "Legacy private description", city: "Palakkad" };
  for (const project of [api.publicHospitalProjection, api.publicHospitalListProjection]) {
    const result = project("centre", stored);
    assert.equal(result.name, stored.name);
    assert.equal(result.city, stored.city);
    assert.equal(Object.hasOwn(result, "description"), false);
  }
  assert.equal(stored.description, "Legacy private description");
  assert.equal(api.publicServiceProjection("package", { description: "Included treatments" }).description, "Included treatments");
});

test("Add Hospital disables the shared description field and public views do not render it", () => {
  const source = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
  assert.match(source("components/admin/HospitalsManager.tsx"), /includeDescription=\{false\}/);
  for (const path of ["components/PublicHospitalSearch.tsx", "components/PublicCentreDetails.tsx"]) {
    assert.doesNotMatch(source(path), /hospital\.description/);
  }
});

function service() {
  return loadTypeScript("services/hospitals/publicHospitalService.ts");
}

test("public blocked dates use plain dates with unchanged ISO instants and inclusive India-day checks", async (t) => {
  const hospital = { id: "centre", blockedDateRanges: [{ startDate: "2099-10-24T18:30:00.000Z", endDate: "2099-10-26T18:30:00.000Z" }] };
  t.mock.method(globalThis, "fetch", async (url) => Response.json(String(url).includes("pageSize") ? { documents: [hospital] } : { hospital }));
  const api = service();
  const { isHospitalSoldOut, isHospitalUnavailable } = loadTypeScript("features/hospitals/availability.ts");
  const fromList = (await api.listPublicHospitals()).documents[0];
  const fromDetail = await api.getPublicHospital("centre");
  for (const record of [fromList, fromDetail]) {
    assert.ok(record.blockedDateRanges[0].startDate instanceof Date);
    assert.equal(record.blockedDateRanges[0].startDate.toISOString(), hospital.blockedDateRanges[0].startDate);
    assert.equal(record.blockedDateRanges[0].endDate.toISOString(), hospital.blockedDateRanges[0].endDate);
    for (const date of ["2099-10-25", "2099-10-26", "2099-10-27"]) assert.equal(isHospitalSoldOut(record, date), true);
    for (const date of ["2099-10-24", "2099-10-28"]) assert.equal(isHospitalSoldOut(record, date), false);
    assert.equal(isHospitalUnavailable(record, "2099-10-24", "2099-10-28"), true);
    assert.equal(isHospitalSoldOut(record, "", "", new Date("2099-10-24T20:00:00Z")), true);
  }
});

test("identical public GETs share one in-flight response, not completed outcomes", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.cache, "no-store");
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

test("selected booking package resolves beyond the first bounded page", async (t) => {
  const urls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    urls.push(String(url));
    return urls.length === 1
      ? Response.json({ documents: [{ id: "first" }], cursor: "first", hasMore: true })
      : Response.json({ documents: [{ id: "selected", name: "14-day package" }], cursor: "selected", hasMore: false });
  });
  const selected = await service().getPublicHospitalService("centre", "selected");
  assert.equal(selected.id, "selected");
  assert.equal(urls.length, 2);
  assert.match(urls[0], /pageSize=24/);
  assert.match(urls[1], /cursor=first/);
});

test("missing packages stop at the final page rather than selecting another package", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ documents: [{ id: "other" }], hasMore: false }));
  assert.equal(await service().getPublicHospitalService("centre", "missing"), null);
});
