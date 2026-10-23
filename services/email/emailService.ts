import "server-only";

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function emailConfiguration() {
  const user = process.env.GMAIL_USER?.trim();
  const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  return user && password ? { user, password } : null;
}

export function isEmailReady() {
  return emailConfiguration() !== null;
}

/** Shared server-only delivery for contact, authentication and booking emails. */
export async function sendEmail(message: {
  to: string; subject: string; html: string; text: string; replyTo?: string; senderName?: string;
}) {
  const configuration = emailConfiguration();
  if (!configuration) throw new Error("Email service is not configured.");
  if (!transporter) transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true, pool: true,
    maxConnections: 2, maxMessages: 50,
    auth: { user: configuration.user, pass: configuration.password },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  const { senderName = "Ayursarga", ...content } = message;
  const result = await transporter.sendMail({ ...content, from: `${senderName} <${configuration.user}>` });
  // SMTP acceptance is not a guarantee of inbox delivery, but rejection must
  // never be reported as a successful invitation.
  if (!result.accepted?.length || result.rejected?.length) throw new Error("Email delivery was not accepted.");
}
