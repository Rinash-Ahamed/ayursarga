"use client";

import { getClientAuth } from "@/services/auth/client";

type AuthorizedRequestOptions = RequestInit & {
  signedOutMessage: string;
  failureMessage: string;
};

export async function authorizedApiRequest<T>(url: string, options: AuthorizedRequestOptions): Promise<T> {
  const { signedOutMessage, failureMessage, ...requestOptions } = options;
  const user = getClientAuth().currentUser;
  if (!user) throw new Error(signedOutMessage);

  const headers = new Headers(requestOptions.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  const response = await fetch(url, { ...requestOptions, headers, cache: "no-store" });
  const body = await response.json().catch(() => ({})) as { error?: unknown } & T;
  if (!response.ok) {
    throw new Error(typeof body.error === "string" && body.error ? body.error : failureMessage);
  }
  return body;
}
