import "server-only";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { DEFAULT_CONSULTATION_CANCELLATION_POLICY, parseConsultationCancellationPolicy } from "@/features/consultations/cancellationPolicy";

export async function readConsultationCancellationPolicy(firestore: Firestore, transaction?: Transaction) {
  const ref = firestore.collection("cancellationPolicies").doc("consultation");
  const snapshot = transaction ? await transaction.get(ref) : await ref.get();
  if (!snapshot.exists) return { ...DEFAULT_CONSULTATION_CANCELLATION_POLICY };
  const policy = parseConsultationCancellationPolicy(snapshot.data()?.policy);
  if (!policy) throw new Error("Cancellation policy configuration needs review.");
  return policy;
}
