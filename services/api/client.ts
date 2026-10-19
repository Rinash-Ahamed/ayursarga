"use client";

import { getClientAuth } from "@/services/auth/client";
import { Timestamp } from "firebase/firestore";
import { shareInFlightRequest } from "@/utils/inFlightRequests";

type AuthorizedRequestOptions = RequestInit & {
  signedOutMessage: string;
  failureMessage: string;
};

export async function authorizedApiRequest<T>(url: string, options: AuthorizedRequestOptions): Promise<T> {
  const { signedOutMessage, failureMessage, ...requestOptions } = options;
  const user = getClientAuth().currentUser;
  if (!user) throw new Error(signedOutMessage);

  const method = (requestOptions.method ?? "GET").toUpperCase();
  const headers = new Headers(requestOptions.headers);
  // Binary uploads and caller-controlled abort signals must remain independent.
  const key = !requestOptions.signal && ["POST", "PATCH", "PUT", "DELETE"].includes(method)
    && (requestOptions.body == null || typeof requestOptions.body === "string")
    ? JSON.stringify([user.uid, url, method, [...headers.entries()], requestOptions.body ?? null]) : null;
  return shareInFlightRequest(key, async () => {
    headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
    const response = await fetch(url, { ...requestOptions, headers, cache: "no-store" });
    const body = await response.json().catch(() => ({})) as { error?: unknown } & T;
    if (!response.ok) {
      throw new Error(typeof body.error === "string" && body.error ? body.error : failureMessage);
    }
    return body;
  });
}

function decodeMutation(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeMutation);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const timestamp = record.__ayursargaTimestamp;
    if (Array.isArray(timestamp) && timestamp.length === 2 && timestamp.every(Number.isInteger)) return new Timestamp(timestamp[0], timestamp[1]);
    return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, decodeMutation(item)]));
  }
  return value;
}

export async function authorizedMutationRequest<T>(url: string, options: AuthorizedRequestOptions): Promise<Partial<T>> {
  const result = await authorizedApiRequest<{ changes: Record<string, unknown> }>(url, options);
  if (!result.changes || typeof result.changes !== "object" || Array.isArray(result.changes)) {
    throw new Error("The update response was incomplete. Refresh the page to check the saved record.");
  }
  return decodeMutation(result.changes) as Partial<T>;
}
