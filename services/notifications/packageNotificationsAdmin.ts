import "server-only";
import type { DocumentData, DocumentReference, Firestore, Timestamp } from "firebase-admin/firestore";

export class PackageNotificationError extends Error {
  readonly status = 409;
}

export async function packageReviewRecipients(firestore: Firestore, hospitalId?: string) {
  const snapshot = await (hospitalId
    ? firestore.collection("users").where("hospitalId", "==", hospitalId).limit(21)
    : firestore.collection("users").where("role", "==", "admin").limit(101)).get();
  if (snapshot.size > (hospitalId ? 20 : 100)) throw new Error("Package review notification recipient limit exceeded.");
  const recipients = snapshot.docs.filter((item) => item.data().status === "active" && item.data().role === (hospitalId ? "hospital" : "admin")).map((item) => item.id);
  if (!recipients.length) throw new PackageNotificationError(hospitalId
    ? "No active Hospital account is available for review notifications. Restore the hospital account before reviewing packages."
    : "No active Admin is available to receive package approval requests. Please contact Ayursarga support.");
  return recipients;
}

export function addPackageReviewNotifications(writer: { set(reference: DocumentReference, data: DocumentData): unknown }, firestore: Firestore, input: {
  recipients: string[]; role: "admin" | "hospital"; hospitalId: string; packageId: string;
  title: string; message: string; actorId: string; auditId: string; now: Timestamp;
}) {
  input.recipients.forEach((recipientId) => writer.set(firestore.collection("notifications").doc(), {
    recipientId, recipientRole: input.role, type: input.role === "admin" ? "package_submitted" : "package_reviewed",
    title: input.title, message: input.message,
    actionHref: input.role === "admin" ? `/admin/hospitals/${encodeURIComponent(input.hospitalId)}#hospital-packages-title` : "/hospital/services",
    recordId: input.packageId, readAt: null, status: "active", createdAt: input.now, createdBy: input.actorId,
    updatedAt: input.now, updatedBy: input.actorId, archivedAt: null, archivedBy: null, lastAuditId: input.auditId,
  }));
}
