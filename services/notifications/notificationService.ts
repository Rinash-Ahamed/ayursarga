"use client";

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  doc,
} from "firebase/firestore";
import type { NotificationDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import { getClientFirestore } from "@/services/firestore/client";
import { COLLECTIONS } from "@/constants/firestore";

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

export function markNotificationRead(notificationId: string, recipientId: string) {
  return updateDoc(doc(getClientFirestore(), COLLECTIONS.notifications, notificationId), {
    readAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: recipientId,
  });
}

export async function markAllNotificationsRead(notifications: DocumentRecord<NotificationDocument>[], recipientId: string) {
  const unread = notifications.filter((item) => !item.readAt);
  if (!unread.length) return;
  const batch = writeBatch(getClientFirestore());
  unread.forEach((item) => batch.update(doc(getClientFirestore(), COLLECTIONS.notifications, item.id), {
    readAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: recipientId,
  }));
  await batch.commit();
}
