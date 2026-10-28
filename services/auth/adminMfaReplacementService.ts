"use client";

import { multiFactor } from "firebase/auth";
import { getClientAuth } from "@/services/auth/client";
import { authService } from "@/services/auth/authService";
import { authorizedApiRequest } from "@/services/api/client";

export async function replaceAdminAuthenticator(password: string, code: string) {
  if (!password || !/^[0-9]{6}$/.test(code)) throw new Error("Enter your password and current six-digit authenticator code.");
  await authService.reauthenticate(password, code);
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Sign in again before continuing.");
  await user.reload();
  const factors = multiFactor(user).enrolledFactors;
  if (factors.length !== 1 || factors[0].factorId !== "totp") throw new Error("Contact the project owner to review your authenticator configuration.");
  let completed = false;
  try {
    const result = await authorizedApiRequest<{ ok?: boolean }>("/api/admin/authenticator", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "replace-my-authenticator", factorId: factors[0].uid }),
      signedOutMessage: "Sign in again before continuing.", failureMessage: "Authenticator replacement could not be confirmed.",
    });
    completed = result.ok === true;
  } finally {
    // Once sent, a lost response may conceal a completed reset. Never blindly retry.
    await authService.logout().catch(() => undefined);
    window.location.assign(`/admin/login?authenticator=${completed ? "setup" : "check"}`);
  }
}
