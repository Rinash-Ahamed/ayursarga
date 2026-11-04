import { Timestamp } from "firebase-admin/firestore";
import { apiJson } from "@/services/api/server";

export function encodeMutation(value: unknown): unknown {
  if (value instanceof Timestamp) return { __ayursargaTimestamp: [value.seconds, value.nanoseconds] };
  if (Array.isArray(value)) return value.map(encodeMutation);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeMutation(item)]));
  return value;
}

/** Return only committed fields; callers must invoke this after the atomic write. */
export function mutationJson(changes: Record<string, unknown>, metadata?: { email: { status: string }; consultantEmail?: { status: string }; supportEmail?: { status: string } }) {
  return apiJson({ ok: true, changes: encodeMutation(changes), ...metadata });
}
