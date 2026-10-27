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
      onSnapshot: (target, optionsOrNext, callback) => {
        const next = typeof optionsOrNext === "function" ? optionsOrNext : callback;
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
  oldListener.next({ docs: [{ id: "old", data: () => ({ status: "active", recipientId: "partner" }) }], metadata: { fromCache: false } });
  assert.equal(received.at(-1)[0].id, "old");
  const cutoff = { seconds: 100, nanoseconds: 0 };
  subscriptions[0].next({ data: () => ({ clearedThrough: cutoff }) });
  assert.equal(oldListener.stopped, true);
  const current = subscriptions[2];
  assert.ok(current.target.query.some((item) => item.where?.[0] === "createdAt" && item.where[1] === ">" && item.where[2] === cutoff));
  current.next({ docs: [], metadata: { fromCache: false } });
  oldListener.next({ docs: [{ id: "stale", data: () => ({ status: "active" }) }], metadata: { fromCache: false } });
  assert.deepEqual(received.at(-1), []);
  current.next({ docs: [{ id: "new", data: () => ({ status: "active", recipientId: "partner" }) }], metadata: { fromCache: false } });
  assert.equal(received.at(-1)[0].id, "new");
  stop();
  assert.equal(subscriptions[0].stopped, true);
  assert.equal(current.stopped, true);
});

test("visual notification alerts ignore history, remain until viewed, and do not replay", () => {
  const { createNotificationTracker, consumeNotificationSnapshot } = loadTypeScript("utils/portalNotificationAlerts.ts");
  const tracker = createNotificationTracker();
  const oldUnread = { id: "old", readAt: null };
  assert.equal(consumeNotificationSnapshot(tracker, [oldUnread], true), false);
  assert.equal(consumeNotificationSnapshot(tracker, [oldUnread, { id: "server-old", readAt: null }], false), false);
  assert.equal(consumeNotificationSnapshot(tracker, [oldUnread, { id: "fresh-read", readAt: {} }], false), false);
  assert.equal(consumeNotificationSnapshot(tracker, [oldUnread, { id: "fresh", readAt: null }], false), true);
  assert.equal(consumeNotificationSnapshot(tracker, [{ id: "fresh", readAt: null }], false), true);
  tracker.pendingIds.clear(); // Viewing acknowledges attention, not the unread record.
  assert.equal(consumeNotificationSnapshot(tracker, [{ id: "fresh", readAt: null }], false), false);
  assert.equal(consumeNotificationSnapshot(tracker, [oldUnread], false), false);
  assert.equal(consumeNotificationSnapshot(tracker, [{ id: "another", readAt: null }], false), true);
  assert.equal(consumeNotificationSnapshot(tracker, [{ id: "another", readAt: {} }], false), false);
  assert.equal(consumeNotificationSnapshot(tracker, [{ id: "last", readAt: null }], false), true);
  assert.equal(consumeNotificationSnapshot(tracker, [], false), false);
});

test("cache-to-server metadata establishes the baseline before the first new unread notification", () => {
  for (const initialIds of [[], ["existing"]]) {
    const { createNotificationTracker, consumeNotificationSnapshot } = loadTypeScript("utils/portalNotificationAlerts.ts");
    const tracker = createNotificationTracker();
    const deliveries = [];
    let emit;
    const api = loadTypeScript("services/notifications/notificationService.ts", {
      "firebase/firestore": {
        doc: (_db, collection, id) => ({ collection, id }), collection: (_db, collection) => ({ collection }),
        where: (...args) => ({ where: args }), orderBy: (...args) => ({ orderBy: args }), limit: (count) => ({ limit: count }),
        query: (...args) => ({ query: args }),
        onSnapshot: (target, optionsOrNext, callback) => {
          const options = typeof optionsOrNext === "function" ? {} : optionsOrNext;
          const next = typeof optionsOrNext === "function" ? optionsOrNext : callback;
          if (!target.query) { next({ data: () => undefined }); return () => {}; }
          let previous;
          emit = (ids, fromCache) => {
            const contents = JSON.stringify(ids);
            // Firestore omits metadata-only snapshots unless explicitly requested.
            if (previous === contents && !options.includeMetadataChanges) return;
            previous = contents;
            next({ docs: ids.map((id) => ({ id, data: () => ({ status: "active", readAt: null }) })), metadata: { fromCache } });
          };
          return () => {};
        },
      },
      "@/services/firestore/client": { getClientFirestore: () => ({}) },
      "@/services/api/client": { authorizedApiRequest: async () => ({ ok: true }) },
    });
    const stop = api.subscribeToNotifications("partner", (items, metadata) => {
      deliveries.push(consumeNotificationSnapshot(tracker, items, metadata.fromCache));
    }, () => assert.fail("Unexpected error"));
    emit(initialIds, true);
    emit(initialIds, false);
    assert.equal(tracker.authoritativeBaselineReady, true);
    assert.deepEqual(deliveries, [false, false]);
    emit([...initialIds, "new-arrival"], false);
    assert.equal(deliveries.at(-1), true);
    tracker.pendingIds.clear(); // Viewed, without changing read status/count.
    emit([...initialIds, "new-arrival"], true);
    emit([...initialIds, "new-arrival"], false);
    assert.equal(deliveries.at(-1), false);
    stop();
  }
});
