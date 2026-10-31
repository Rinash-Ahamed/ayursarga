import "server-only";
import type { Firestore, Transaction } from "firebase-admin/firestore";

export class DuplicateCreationEmailError extends Error {
  readonly status = 409;
  constructor(module: "hospitals" | "consultants") {
    super(`This email is already used by a ${module === "hospitals" ? "hospital" : "consultant"}. Open the existing record or use a different email.`);
  }
}

/** Call inside a transaction that also advances the collection's creation counter.
 * That shared document serializes concurrent creates, including an empty query.
 * Existing app writes already store trimmed lowercase emails. Include inactive
 * and archived records, without scanning or rewriting the collection.
 */
export async function assertUniqueCreationEmail(transaction: Transaction, firestore: Firestore, module: "hospitals" | "consultants", email: string) {
  const matches = await transaction.get(firestore.collection(module).where("email", "==", email.trim().toLowerCase()).limit(1));
  if (matches.docs.length) throw new DuplicateCreationEmailError(module);
}
