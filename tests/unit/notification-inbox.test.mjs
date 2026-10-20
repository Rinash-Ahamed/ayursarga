import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

test("persistent inbox cutoff filters old notifications, ignores stale listeners and cleans up", () => {
  const subscriptions = [];
  const received = [];
  const api = loadTypeScript("services/notifications/notificationService.ts", {
    "firebase/firestore": {
      doc: (_db, collection, id) => ({ collection, id }), collection: (_db, collection) => ({ collection }),
      where: (...args) => ({ where: args }), orderBy: (...args) => ({ orderBy: args }), limit: (count) => ({ limit: count }),
      query: (...args) => ({ query: args }),
      onSnapshot: (target, next) => {
        const subscription = { target, next, stopped: false };
        subscriptions.push(subscription);
        return () => { subscription.stopped = true; };
      },
    },
    "@/services/firestore/client": { getClientFirestore: () => ({}) },
    "@/services/api/client": { authorizedApiRequest: async () => ({ ok: true }) },
  });
  const stop = api.subscribeToNotifications("partner", (items) => received.push(items), () => assert.fail("Unexpected subscription error"));
  assert.equal(subscriptions[0].target.collection, "notificationInboxes");
  subscriptions[0].next({ data: () => undefined });
  const oldListener = subscriptions[1];
  oldListener.next({ docs: [{ id: "old", data: () => ({ status: "active", recipientId: "partner" }) }] });
  assert.equal(received.at(-1)[0].id, "old");
  const cutoff = { seconds: 100, nanoseconds: 0 };
  subscriptions[0].next({ data: () => ({ clearedThrough: cutoff }) });
  assert.equal(oldListener.stopped, true);
  const current = subscriptions[2];
  assert.ok(current.target.query.some((item) => item.where?.[0] === "createdAt" && item.where[1] === ">" && item.where[2] === cutoff));
  current.next({ docs: [] });
  oldListener.next({ docs: [{ id: "stale", data: () => ({ status: "active" }) }] });
  assert.deepEqual(received.at(-1), []);
  current.next({ docs: [{ id: "new", data: () => ({ status: "active", recipientId: "partner" }) }] });
  assert.equal(received.at(-1)[0].id, "new");
  stop();
  assert.equal(subscriptions[0].stopped, true);
  assert.equal(current.stopped, true);
});
