type NotificationCandidate = { id: string; readAt: unknown };

export function createNotificationTracker() {
  return {
    authoritativeBaselineReady: false,
    seenIds: new Set<string>(),
    pendingIds: new Set<string>(),
  };
}

/** Initial history is silent; only newly observed unread records need attention. */
export function consumeNotificationSnapshot(
  tracker: ReturnType<typeof createNotificationTracker>,
  items: NotificationCandidate[],
  fromCache: boolean,
) {
  if (!tracker.authoritativeBaselineReady) {
    items.forEach((item) => tracker.seenIds.add(item.id));
    if (!fromCache) tracker.authoritativeBaselineReady = true;
    return false;
  }
  const unreadIds = new Set(items.filter((item) => !item.readAt).map((item) => item.id));
  for (const id of tracker.pendingIds) {
    if (!unreadIds.has(id)) tracker.pendingIds.delete(id);
  }
  for (const item of items) {
    if (!tracker.seenIds.has(item.id) && !item.readAt) tracker.pendingIds.add(item.id);
    tracker.seenIds.add(item.id);
  }
  return tracker.pendingIds.size > 0;
}
