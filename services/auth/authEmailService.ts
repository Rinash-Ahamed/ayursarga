import "server-only";

import type { Auth } from "firebase-admin/auth";
import { authEmail } from "@/lib/authEmail";
import { sendEmail } from "@/services/email/emailService";

export function authEmailSiteUrl() {
  const url = new URL(process.env.APP_SITE_URL?.trim() || "https://ayursarga.com");
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new Error("Configure a secure APP_SITE_URL.");
  }
  return url.origin;
}

/** Link generation and delivery stay server-only; never return/store action URLs. */
export async function sendAuthEmail(auth: Auth, input: {
  email: string; name: string; role: "admin" | "hospital"; invitation?: boolean;
}) {
  const continueUrl = new URL(`/${input.role}/login`, authEmailSiteUrl()).href;
  // No mobile deep links or custom Firebase template/action-URL settings needed.
  const actionUrl = await auth.generatePasswordResetLink(input.email, { url: continueUrl, handleCodeInApp: false });
  const template = authEmail({ kind: input.invitation ? "hospital-invitation" : "password-reset", name: input.name, actionUrl });
  await sendEmail({ to: input.email, replyTo: "info@ayursarga.com", ...template });
}
