import "server-only";

import type { Auth } from "firebase-admin/auth";
import { authEmail } from "@/lib/authEmail";
import { isEmailReady, sendEmail } from "@/services/email/emailService";

export function authEmailSiteUrl() {
  const url = new URL(process.env.APP_SITE_URL?.trim() || "https://ayursarga.com");
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new Error("Configure a secure APP_SITE_URL.");
  }
  return url.origin;
}

export function isAuthEmailReady() {
  try {
    authEmailSiteUrl();
    return isEmailReady();
  } catch {
    return false;
  }
}

/** Link generation and delivery stay server-only; never return/store action URLs. */
export async function sendAuthEmail(auth: Auth, input: {
  email: string; name: string; role: "admin" | "hospital"; invitation?: boolean;
}) {
  const continueUrl = new URL(`/${input.role}/login`, authEmailSiteUrl()).href;
  // No mobile deep links or custom Firebase template/action-URL settings needed.
  const firebaseActionUrl = new URL(await auth.generatePasswordResetLink(input.email, { url: continueUrl, handleCodeInApp: false }));
  const code = firebaseActionUrl.searchParams.get("oobCode");
  if (!code || firebaseActionUrl.searchParams.get("mode") !== "resetPassword") throw new Error("Password action could not be prepared.");
  const actionUrl = new URL("/auth/reset-password", authEmailSiteUrl());
  // Fragments are handled in the browser and never sent in HTTP requests.
  actionUrl.hash = new URLSearchParams({ oobCode: code, role: input.role, kind: input.invitation ? "invite" : "reset" }).toString();
  const template = authEmail({ kind: input.invitation ? "hospital-invitation" : "password-reset", name: input.name, actionUrl: actionUrl.href });
  await sendEmail({ to: input.email, replyTo: "info@ayursarga.com", ...template });
}
