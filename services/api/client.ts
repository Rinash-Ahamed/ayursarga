"use client";

import { getClientAuth } from "@/services/auth/client";
import { Timestamp } from "firebase/firestore";
import { shareInFlightRequest } from "@/utils/inFlightRequests";

type AuthorizedRequestOptions = RequestInit & {
  signedOutMessage: string;
  failureMessage: string;
};

export class AuthorizedApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

// A read started before a write must never be reused by its post-save refresh.
// This is a request-generation marker, not a response cache or auth bypass.
let readRevision = 0;

export async function authorizedApiRequest<T>(url: string, options: AuthorizedRequestOptions): Promise<T> {
  const { signedOutMessage, failureMessage, ...requestOptions } = options;
  const user = getClientAuth().currentUser;
  if (!user) throw new Error(signedOutMessage);

  const method = (requestOptions.method ?? "GET").toUpperCase();
  const mutation = ["POST", "PATCH", "PUT", "DELETE"].includes(method);
  if (mutation) readRevision++;
  const headers = new Headers(requestOptions.headers);
  // Binary uploads and caller-controlled abort signals must remain independent.
  const key = !requestOptions.signal && ["GET", "POST", "PATCH", "PUT", "DELETE"].includes(method)
    && (requestOptions.body == null || typeof requestOptions.body === "string")
    ? JSON.stringify([user.uid, url, method, method === "GET" ? readRevision : null, [...headers.entries()], requestOptions.body ?? null,
      requestOptions.credentials, requestOptions.mode, requestOptions.redirect, requestOptions.referrer,
      requestOptions.referrerPolicy, requestOptions.integrity, requestOptions.keepalive]) : null;
  const result = await shareInFlightRequest(key, async () => {
    headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
    const response = await fetch(url, { ...requestOptions, headers, cache: "no-store" });
    const body = await response.json().catch(() => ({})) as { error?: unknown } & T;
    return { body, ok: response.ok, status: response.status };
  }).finally(() => { if (mutation) readRevision++; });
  if (!result.ok) throw new AuthorizedApiError(typeof result.body.error === "string" && result.body.error ? result.body.error : failureMessage, result.status);
  return result.body;
}

export function decodeMutation(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeMutation);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const timestamp = record.__ayursargaTimestamp;
    if (Array.isArray(timestamp) && timestamp.length === 2 && timestamp.every(Number.isInteger)) return new Timestamp(timestamp[0], timestamp[1]);
    return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, decodeMutation(item)]));
  }
  return value;
}

export function readMutationChanges<T>(changes: unknown, incompleteMessage = "The update response was incomplete. Refresh the page to check the saved record."): Partial<T> {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new Error(incompleteMessage);
  }
  return decodeMutation(changes) as Partial<T>;
}

export async function authorizedMutationRequest<T>(url: string, options: AuthorizedRequestOptions): Promise<Partial<T>> {
  const result = await authorizedApiRequest<{ changes: Record<string, unknown> }>(url, options);
  return readMutationChanges<T>(result.changes);
}
