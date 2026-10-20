import "server-only";
import { randomInt } from "node:crypto";
import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import type { PortalRole } from "@/features/auth/contracts";
import { requestAuditDevice } from "@/services/api/audit";

export function generateBookingReference() {
  return `AYUR${randomInt(36 ** 6).toString(36).padStart(6, "0").toUpperCase()}`;
}

// Call after all other transaction reads. Registry documents are server-only,
// permanent uniqueness reservations, including after a booking is archived.
export async function reserveBookingReference(transaction: Transaction, firestore: Firestore, documentId: string) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const value = generateBookingReference();
    const reservation = firestore.collection("bookingReferences").doc(value);
    if ((await transaction.get(reservation)).exists) continue;
    transaction.create(reservation, { bookingId: documentId, createdAt: FieldValue.serverTimestamp() });
    return value;
  }
  throw new Error("Unable to reserve a unique booking reference.");
}

export function canAccessBooking(data: FirebaseFirestore.DocumentData, actor: { uid: string; role: PortalRole; hospitalId?: string | null }) {
  return actor.role === "admin" || (actor.role === "consumer" && data.consumerId === actor.uid)
    || (actor.role === "hospital" && Boolean(actor.hospitalId) && data.hospitalId === actor.hospitalId);
}

// Lazy, audited compatibility migration: one stored reference on the original
// document, never a separate booking or a portal-specific display conversion.
export async function ensureBookingReference(firestore: Firestore, id: string, actor: { uid: string; role: PortalRole; hospitalId?: string | null }, request: Request) {
  return firestore.runTransaction(async (transaction) => {
    const reference = firestore.collection("bookings").doc(id);
    const snapshot = await transaction.get(reference);
    const previous = snapshot.data();
    if (!snapshot.exists || !previous || !canAccessBooking(previous, actor)) throw new Error("Booking unavailable.");
    if (typeof previous.bookingReference === "string" && previous.bookingReference) return previous.bookingReference;
    const bookingReference = await reserveBookingReference(transaction, firestore, id);
    const audit = firestore.collection("auditLogs").doc();
    const now = FieldValue.serverTimestamp();
    const changes = { bookingReference, updatedAt: now, updatedBy: actor.uid, lastAuditId: audit.id };
    transaction.update(reference, changes);
    transaction.create(audit, {
      action: "update", module: "bookings", recordId: id, actorId: actor.uid, actorRole: actor.role,
      previousValues: previous, updatedValues: { ...previous, ...changes }, timestamp: now,
      source: "server", device: requestAuditDevice(request),
    });
    return bookingReference;
  });
}
