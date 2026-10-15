"use client";

import {
  collection,
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
  onChange: (notifications: DocumentRecord<NotificationDocument>[]) => void,
  onError: (error: Error) => void,
) {
  const notificationsQuery = query(
    collection(getClientFirestore(), COLLECTIONS.notifications),
    where("recipientId", "==", recipientId),
    orderBy("createdAt", "desc"),
    limit(NOTIFICATION_LIMIT),
  );
  return onSnapshot(notificationsQuery, (snapshot) => {
    onChange(snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() } as DocumentRecord<NotificationDocument>))
      .filter((item) => item.status === "active"));
  }, (error) => onError(error));
}

export function markNotificationRead(notificationId: string, _recipientId: string) {
  return authorizedApiRequest<{ ok: true }>("/api/notifications/read", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notificationIds: [notificationId] }),
    signedOutMessage: "Your session has expired. Sign in again to update notifications.",
    failureMessage: "We could not update the notification. Please try again.",
  });
}

export async function markAllNotificationsRead(notifications: DocumentRecord<NotificationDocument>[], _recipientId: string) {
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
