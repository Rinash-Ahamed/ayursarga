import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { contactEmailHtml, contactEmailText, type ContactEmailData } from "@/lib/contactEmail";

export const runtime = "nodejs";

const value = (input: unknown, limit: number) => String(input || "").trim().slice(0, limit);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.website) return NextResponse.json({ ok: true });

    const data: ContactEmailData = {
      name: value(body.name, 100), email: value(body.email, 160), phone: value(body.phone, 50),
      interest: value(body.interest, 100), message: value(body.message, 3000),
    };
    if (!data.name || !data.phone || !data.interest || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
    if (!gmailUser || !gmailPassword) {
      return NextResponse.json({ error: "Email service is not configured." }, { status: 503 });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: gmailUser, pass: gmailPassword },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    });
    await transporter.sendMail({
      from: `Ayursarga Website <${gmailUser}>`,
      to: process.env.CONTACT_TO_EMAIL || "info@ayursarga.com",
      replyTo: data.email,
      subject: `New Ayursarga Enquiry - ${data.interest}`,
      html: contactEmailHtml(data), text: contactEmailText(data),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Contact email failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "We could not send your request. Please try again." }, { status: 502 });
  }
}
