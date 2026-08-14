import "server-only";

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { contactEmailHtml, contactEmailText, type ContactEmailData } from "@/lib/contactEmail";

let transporter: Transporter | null = null;

function getContactEmailConfiguration() {
  const user = process.env.GMAIL_USER?.trim();
  const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !password) return null;
  return {
    user,
    password,
    recipient: process.env.CONTACT_TO_EMAIL?.trim() || "info@ayursarga.com",
  };
}

export function isContactEmailReady() {
  return getContactEmailConfiguration() !== null;
}

export async function sendContactEmail(data: ContactEmailData) {
  const configuration = getContactEmailConfiguration();
  if (!configuration) throw new Error("Email service is not configured.");

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      pool: true,
      maxConnections: 2,
      maxMessages: 50,
      auth: { user: configuration.user, pass: configuration.password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  await transporter.sendMail({
    from: `Ayursarga Website <${configuration.user}>`,
    to: configuration.recipient,
    replyTo: data.email,
    subject: `New Ayursarga Enquiry - ${data.interest}`,
    html: contactEmailHtml(data),
    text: contactEmailText(data),
  });
}
