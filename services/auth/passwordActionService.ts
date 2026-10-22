"use client";

import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { getClientAuth } from "@/services/auth/client";
import { isValidPassword } from "@/features/auth/password";

const pendingVerifications = new Map<string, Promise<void>>();

export async function verifyPasswordAction(code: string) {
  if (!code) throw new Error("This password link is missing its verification code.");
  let pending = pendingVerifications.get(code);
  if (!pending) {
    pending = verifyPasswordResetCode(getClientAuth(), code).then(() => undefined).finally(() => {
      pendingVerifications.delete(code);
    });
    pendingVerifications.set(code, pending);
  }
  await pending;
}

export async function completePasswordAction(code: string, password: string) {
  if (!code || !isValidPassword(password)) throw new Error("Enter a valid password.");
  await confirmPasswordReset(getClientAuth(), code, password);
}

export function passwordActionError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : "";
  if (code === "auth/network-request-failed") return "Unable to connect. Check your connection and try again.";
  if (code === "auth/weak-password" || code === "auth/password-does-not-meet-requirements") return "Choose a stronger password and try again.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait and try again.";
  return "This password link is invalid, expired or already used. Request a new link to continue.";
}
