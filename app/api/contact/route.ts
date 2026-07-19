import { NextResponse } from "next/server";

export const runtime = "nodejs";

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const interest = String(body.interest || "").trim();
    const message = String(body.message || "").trim();

    if (body.website) return NextResponse.json({ ok: true });
    if (!name || !phone || !email || !interest || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Email service is not configured." }, { status: 503 });

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM_EMAIL || "Ayursarga Website <onboarding@resend.dev>",
        to: [process.env.CONTACT_TO_EMAIL || "info@ayursarga.com"],
        reply_to: email,
        subject: `New Ayursarga enquiry - ${interest}`,
        html: `<h2>New website enquiry</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Phone:</strong> ${escapeHtml(phone)}</p><p><strong>Interest:</strong> ${escapeHtml(interest)}</p><p><strong>Message:</strong><br>${escapeHtml(message || "No message provided").replace(/\n/g, "<br>")}</p>`,
      }),
    });
    if (!response.ok) return NextResponse.json({ error: "Email provider rejected the request." }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to process the request." }, { status: 500 });
  }
}
