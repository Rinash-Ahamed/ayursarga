import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { contactEmailHtml, contactEmailText, type ContactEmailData } from "@/lib/contactEmail";
import { isValidEmail, toTrimmedString } from "@/utils/text";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16_000;
let transporter: Transporter | null = null;

function response(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

function getTransporter(user: string, password: string): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true, pool: true,
      maxConnections: 2, maxMessages: 50,
      auth: { user, pass: password },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    });
  }
  return transporter;
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_REQUEST_BYTES) return response({ error: "Request is too large." }, 413);
    const input: unknown = await request.json();
    const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
    if (body.website) return response({ ok: true });

    const data: ContactEmailData = {
      name: toTrimmedString(body.name, 100), email: toTrimmedString(body.email, 160),
      phone: toTrimmedString(body.phone, 50), interest: toTrimmedString(body.interest, 100),
      message: toTrimmedString(body.message, 3000), matchProfile: toTrimmedString(body.matchProfile, 2000),
    };
    if (!data.name || !data.phone || !data.interest || !isValidEmail(data.email)) {
      return response({ error: "Please complete all required fields." }, 400);
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
    if (!gmailUser || !gmailPassword) {
      return response({ error: "Email service is not configured." }, 503);
    }

    await getTransporter(gmailUser, gmailPassword).sendMail({
      from: `Ayursarga Website <${gmailUser}>`,
      to: process.env.CONTACT_TO_EMAIL || "info@ayursarga.com",
      replyTo: data.email,
      subject: `New Ayursarga Enquiry - ${data.interest}`,
      html: contactEmailHtml(data), text: contactEmailText(data),
    });
    return response({ ok: true });
  } catch (error) {
    console.error("Contact email failed", error instanceof Error ? error.message : error);
    return response({ error: "We could not send your request. Please try again." }, 502);
  }
}
