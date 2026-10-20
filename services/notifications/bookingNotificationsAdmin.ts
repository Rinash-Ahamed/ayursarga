import "server-only";
import { createHash } from "node:crypto";
import type { FieldValue, Firestore, Transaction } from "firebase-admin/firestore";

export async function bookingNotificationRecipients(transaction: Transaction, firestore: Firestore, hospitalId: string) {
  const [admins, partners] = await Promise.all([
    transaction.get(firestore.collection("users").where("role", "==", "admin").limit(101)),
    transaction.get(firestore.collection("users").where("hospitalId", "==", hospitalId).limit(21)),
  ]);
  // Fail safely rather than silently dropping recipients or using an unbounded read.
  if (admins.size > 100 || partners.size > 20) throw new Error("Booking notification recipient limit exceeded.");
  const recipients = [
    ...admins.docs.filter((user) => user.data().status === "active").map((user) => ({ id: user.id, role: "admin" as const })),
    ...partners.docs.filter((user) => user.data().status === "active" && user.data().role === "hospital").map((user) => ({ id: user.id, role: "hospital" as const })),
  ];
  if (!recipients.some((recipient) => recipient.role === "admin") || !recipients.some((recipient) => recipient.role === "hospital")) {
    throw new Error("Active booking notification recipients are not configured.");
  }
  return recipients;
}

export function addBookingNotifications(transaction: Transaction, firestore: Firestore, input: {
  recipients: Awaited<ReturnType<typeof bookingNotificationRecipients>>; documentId: string;
  bookingReference: string; hospitalName: string; consumerName: string; consumerPhone: string;
  serviceName: string; preferredDate: Date; preferredEndDate: Date; bystanderCount: number;
  actorId: string; auditId: string; now: FieldValue;
}) {
  const dateLabel = (date: Date) => date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
  const dates = input.preferredDate.getTime() === input.preferredEndDate.getTime()
    ? dateLabel(input.preferredDate) : `${dateLabel(input.preferredDate)} to ${dateLabel(input.preferredEndDate)}`;
  for (const recipient of input.recipients) {
    const id = createHash("sha256").update(`booking_created:${input.documentId}:${recipient.id}`).digest("hex");
    transaction.create(firestore.collection("notifications").doc(id), {
      recipientId: recipient.id, recipientRole: recipient.role, type: "booking_created",
      title: `New booking ${input.bookingReference}`,
      message: `${input.hospitalName} · ${input.consumerName} · ${input.consumerPhone} · ${input.serviceName} · ${dates} · ${input.bystanderCount} bystander(s). Booked, awaiting hospital confirmation.`,
      actionHref: `/${recipient.role}/bookings?booking=${encodeURIComponent(input.documentId)}`,
      recordId: input.documentId, bookingReference: input.bookingReference,
      readAt: null, status: "active", createdAt: input.now, createdBy: input.actorId,
      updatedAt: input.now, updatedBy: input.actorId, archivedAt: null, archivedBy: null, lastAuditId: input.auditId,
    });
  }
}
