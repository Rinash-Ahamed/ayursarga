import "server-only";
import { createHash } from "node:crypto";
import type { Firestore, Transaction, FieldValue, Timestamp } from "firebase-admin/firestore";

export async function consultationAdminRecipients(transaction: Transaction, firestore: Firestore) {
  const snapshot = await transaction.get(firestore.collection("users").where("role", "==", "admin").limit(101));
  if (snapshot.size > 100) throw new Error("Consultation notification recipient limit exceeded.");
  const users = snapshot.docs.filter((doc) => doc.data().status === "active").map((doc) => doc.id);
  if (!users.length) throw new Error("No active consultation coordinator is configured.");
  return users;
}

export function addConsultationNotification(transaction: Transaction, firestore: Firestore, input: {
  recipientId: string; recipientRole: "admin" | "consumer"; bookingId: string; bookingReference: string;
  message: string; event: string; actorId: string; auditId: string; now: FieldValue | Timestamp;
}) {
  const id = createHash("sha256").update(`${input.event}:${input.bookingId}:${input.recipientId}`).digest("hex");
  transaction.create(firestore.collection("notifications").doc(id), {
    recipientId: input.recipientId, recipientRole: input.recipientRole, type: "consultation_updated",
    title: `Online consultation ${input.bookingReference}`, message: input.message,
    actionHref: `/${input.recipientRole === "consumer" ? "app" : "admin"}/bookings/consultations?booking=${encodeURIComponent(input.bookingId)}`,
    recordId: input.bookingId, bookingReference: input.bookingReference, readAt: null, status: "active",
    createdAt: input.now, createdBy: input.actorId, updatedAt: input.now, updatedBy: input.actorId,
    archivedAt: null, archivedBy: null, lastAuditId: input.auditId,
  });
}
