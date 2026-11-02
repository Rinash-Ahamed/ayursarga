import "server-only";
import type { Firestore, Transaction } from "firebase-admin/firestore";

export class DuplicateCreationEmailError extends Error {
  readonly status = 409;
  constructor(module: "hospitals" | "consultants") {
    super(`This email is already used by a ${module === "hospitals" ? "hospital" : "consultant"}. Open the existing record or use a different email.`);
  }
}

/** Call inside a transaction that also writes the collection's creation counter.
 * That shared document serializes concurrent creates/email edits, even for empty queries.
 * Existing app writes already store trimmed lowercase emails. Include inactive
 * and archived records, without scanning or rewriting the collection.
 */
export async function assertUniqueCreationEmail(transaction: Transaction, firestore: Firestore, module: "hospitals" | "consultants", email: string, excludingId?: string) {
  const matches = await transaction.get(firestore.collection(module).where("email", "==", email.trim().toLowerCase()).limit(excludingId ? 2 : 1));
  if (matches.docs.some(document => document.id !== excludingId)) throw new DuplicateCreationEmailError(module);
}
