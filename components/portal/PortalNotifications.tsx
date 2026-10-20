"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { NotificationDocument } from "@/features/firestore/models";
import type { DocumentRecord } from "@/services/firestore/firestoreService";
import {
  clearAllNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "@/services/notifications/notificationService";
import { PortalDialog } from "@/components/portal/PortalDialog";

function notificationTime(value: NotificationDocument["createdAt"]) {
  const date = value?.toDate?.();
  return date ? date.toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  }) : "Just now";
}

export function PortalNotifications({ recipientId }: { recipientId: string }) {
  const [items, setItems] = useState<DocumentRecord<NotificationDocument>[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const actionInFlight = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const unread = items.filter((item) => !item.readAt);

  async function clear() {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setClearing(true);
    setError("");
    try {
      const { clearedThrough } = await clearAllNotifications();
      setItems((current) => current.filter((item) => item.createdAt.seconds > clearedThrough.seconds
        || (item.createdAt.seconds === clearedThrough.seconds && item.createdAt.nanoseconds > clearedThrough.nanoseconds)));
      setConfirmClear(false);
      setOpen(true);
    } catch { setError("We could not clear notifications. Please try again."); setConfirmClear(false); setOpen(true); }
    finally { actionInFlight.current = false; setClearing(false); }
  }

  async function markAllRead() {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setMarkingRead(true);
    try { await markAllNotificationsRead(items); }
    catch { setError("We could not mark the notifications as read."); }
    finally { actionInFlight.current = false; setMarkingRead(false); }
  }

  useEffect(() => subscribeToNotifications(recipientId, (nextItems) => {
    setItems(nextItems);
    setLoading(false);
    setError("");
  }, () => {
    setLoading(false);
    setError("Notifications are temporarily unavailable.");
  }), [recipientId]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className="portal-notifications" ref={rootRef}>
    <button
      className="portal-notification-trigger"
      type="button"
      aria-label={unread.length ? `Notifications, ${unread.length} unread` : "Notifications"}
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {unread.length > 0 && <span className="portal-notification-count">{Math.min(unread.length, 9)}{unread.length > 9 ? "+" : ""}</span>}
    </button>
    {open && <section className="portal-notification-panel" aria-label="Recent notifications">
      <div className="portal-notification-heading">
        <strong>Notifications</strong>
        <div className="portal-notification-actions">
          {unread.length > 0 && <button type="button" disabled={clearing || markingRead} onClick={() => void markAllRead()}>Mark all read</button>}
          {items.length > 0 && <button className="portal-notification-clear" type="button" disabled={clearing || markingRead} onClick={() => { setOpen(false); setConfirmClear(true); }}>Clear</button>}
        </div>
      </div>
      {loading && <p className="portal-notification-state">Loading notifications...</p>}
      {error && <p className="portal-notification-state">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="portal-notification-state">No notifications yet.</p>}
      {!loading && items.length > 0 && <div className="portal-notification-list">
        {items.map((item) => <Link
          className="portal-notification-item"
          data-unread={!item.readAt || undefined}
          href={item.actionHref || "#"}
          key={item.id}
          onClick={() => {
            setOpen(false);
            if (!item.readAt) void markNotificationRead(item.id)
              .catch(() => setError("We could not mark this notification as read."));
          }}
        >
          <span>{item.title}</span>
          <p>{item.message}</p>
          <small>{notificationTime(item.createdAt)}</small>
        </Link>)}
      </div>}
    </section>}
    <PortalDialog open={confirmClear} title="Clear all notifications?" message="Earlier notifications will be dismissed from your list. Bookings, notification records and audit history are kept. New notifications will still appear." tone="danger" confirmLabel="Clear notifications" busy={clearing} onConfirm={() => void clear()} onCancel={() => { if (!clearing) { setConfirmClear(false); setOpen(true); } }} />
  </div>;
}
