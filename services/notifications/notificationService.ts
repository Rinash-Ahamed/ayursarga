"use client";

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import type { NotificationDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { getClientFirestore } from "@/services/firestore/client";
import { COLLECTIONS } from "@/constants/firestore";
import { authorizedApiRequest } from "@/services/api/client";

const NOTIFICATION_LIMIT = 20;

export function subscribeToNotifications(
  recipientId: string,
  onChange: (notifications: DocumentRecord<NotificationDocument>[], metadata: { fromCache: boolean }) => void,
  onError: (error: Error) => void,
) {
  let stopNotifications: (() => void) | undefined;
  let generation = 0;
  let active = true;
  const firestore = getClientFirestore();
  const stopInbox = onSnapshot(doc(firestore, "notificationInboxes", recipientId), (inbox) => {
    if (!active) return;
    const version = ++generation;
    stopNotifications?.();
    const clearedThrough = inbox.data()?.clearedThrough;
    const notificationsQuery = query(
      collection(firestore, COLLECTIONS.notifications),
      where("recipientId", "==", recipientId),
      ...(clearedThrough ? [where("createdAt", ">", clearedThrough)] : []),
      orderBy("createdAt", "desc"), limit(NOTIFICATION_LIMIT),
    );
    // The tracker needs the authoritative baseline even when only fromCache
    // changes. Otherwise the first real arrival is mistaken for initial history.
    stopNotifications = onSnapshot(notificationsQuery, { includeMetadataChanges: true }, (snapshot) => {
      if (version !== generation) return;
      onChange(snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() } as DocumentRecord<NotificationDocument>))
        .filter((item) => item.status === "active"), { fromCache: snapshot.metadata?.fromCache === true });
    }, (error) => { if (version === generation) onError(error); });
  }, (error) => { if (active) onError(error); });
  return () => { active = false; generation++; stopInbox(); stopNotifications?.(); };
}

export function clearAllNotifications() {
  return authorizedApiRequest<{ ok: true; clearedThrough: { seconds: number; nanoseconds: number } }>("/api/notifications/clear", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true }),
    signedOutMessage: "Sign in again to clear your notifications.",
    failureMessage: "We could not clear your notifications. Please try again.",
  });
}

export function markNotificationRead(notificationId: string) {
  return authorizedApiRequest<{ ok: true }>("/api/notifications/read", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notificationIds: [notificationId] }),
    signedOutMessage: "Your session has expired. Sign in again to update notifications.",
    failureMessage: "We could not update the notification. Please try again.",
  });
}

export async function markAllNotificationsRead(notifications: DocumentRecord<NotificationDocument>[]) {
  const unread = notifications.filter((item) => !item.readAt);
  if (!unread.length) return;
  await authorizedApiRequest<{ ok: true }>("/api/notifications/read", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notificationIds: unread.slice(0, 20).map((item) => item.id) }),
    signedOutMessage: "Your session has expired. Sign in again to update notifications.",
    failureMessage: "We could not update the notifications. Please try again.",
  });
}
