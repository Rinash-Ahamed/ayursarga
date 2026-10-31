import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

test("installed Auth persistence reconnects after pagehide without closing on visibility changes", async () => {
  // Exercise the installed SDK class, isolating only browser/database services.
  // This is not an end-to-end browser sign-in or real IndexedDB test.
  const root = path.dirname(require.resolve("@firebase/auth/package.json"));
  const directory = path.join(root, "dist/esm");
  const source = readdirSync(directory).filter(name => /^index-.*\.js$/.test(name))
    .map(name => readFileSync(path.join(directory, name), "utf8"))
    .find(value => value.includes("class IndexedDBLocalPersistence {"));
  assert.ok(source, "Expected installed SDK persistence implementation");
  const start = source.indexOf("class IndexedDBLocalPersistence {");
  const end = source.indexOf("IndexedDBLocalPersistence.type =", start);
  assert.ok(end > start);
  const events = new Map();
  let opens = 0, closes = 0;
  const Persistence = new Function("window", "_openDatabase", `${source.slice(start, end)}; return IndexedDBLocalPersistence;`)(
    { addEventListener: (name, callback) => events.set(name, callback), removeEventListener: name => events.delete(name) },
    async () => { opens++; return { close: () => { closes++; } }; },
  );
  Persistence.prototype.initializeServiceWorkerMessaging = async () => {};
  Persistence.prototype.stopPolling = () => {};
  const persistence = new Persistence();
  persistence.registerLifecycleListeners();
  assert.equal(events.has("visibilitychange"), false);
  await persistence._openDb();
  assert.equal(opens, 1);
  for (let iteration = 0; iteration < 3; iteration++) {
    events.get("pagehide")();
    // Reconnection must work even before pageshow (the iOS popup regression).
    await persistence._openDb();
    events.get("pageshow")();
  }
  assert.equal(opens, 4);
  assert.equal(closes, 3);
  persistence.unregisterLifecycleListeners();
  assert.equal(events.size, 0);
});
