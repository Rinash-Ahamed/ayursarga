import { formatCurrency } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";

export type BookingEmailData = {
  kind: "hospital" | "consultation";
  consumerName: string;
  bookingReference: string;
  providerName: string;
  serviceName: string;
  location?: string;
  date: unknown;
  time?: string | null;
  amount?: number;
  bystanderCount?: number;
  additionalBystanderTotal?: number;
  bookingUrl: string;
};

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);

export function bookingEmail(data: BookingEmailData) {
  const url = new URL(data.bookingUrl);
  if (url.protocol !== "https:" && !(["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:")) throw new Error("A secure booking link is required.");
  const hospital = data.kind === "hospital";
  const subject = `Ayursarga booking confirmed${data.bookingReference ? `: ${data.bookingReference}` : ""}`;
  const heading = hospital ? "Your hospital booking is confirmed" : "Your online consultation is confirmed";
  const rows: [string, string][] = [
    ["Booking reference", data.bookingReference || "See My Bookings"],
    [hospital ? "Hospital" : "Consultant", data.providerName],
    [hospital ? "Package" : "Service", data.serviceName],
    [hospital ? "Preferred start date / Expected Delivery Date" : "Appointment date", formatDisplayDate(data.date, "See My Bookings")],
  ];
  if (data.time) rows.push(["Appointment time", `${data.time} IST`]);
  if (hospital && data.location) rows.push(["Location", data.location]);
  if (typeof data.amount === "number" && Number.isFinite(data.amount)) rows.push([hospital ? "Package amount" : "Consultation charge", formatCurrency(data.amount)]);
  if (hospital && typeof data.bystanderCount === "number") rows.push(["Bystanders", String(data.bystanderCount)]);
  if (hospital && data.additionalBystanderTotal) rows.push(["Additional bystander amount", formatCurrency(data.additionalBystanderTotal)]);
  const greeting = data.consumerName ? `Hello ${data.consumerName},` : "Hello,";
  const note = "You can view the latest booking details in your Ayursarga account. This confirmation is not a payment receipt.";
  const text = `Ayursarga\n\n${heading}\n\n${greeting}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\n${note}\n\nView My Bookings: ${url.href}\n\nNeed help? info@ayursarga.com`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f9f5ea;color:#243b2d;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e2e5dc;border-radius:20px;overflow:hidden">
<tr><td style="padding:28px 24px;background:#1f3d2b;border-bottom:3px solid #c9a66b"><div style="font-family:Georgia,serif;font-size:30px;color:#fff">Ayursarga</div><p style="margin:8px 0 0;color:#e3d1af;font-size:11px;letter-spacing:1.5px">BOOKING CONFIRMATION</p></td></tr>
<tr><td style="padding:28px 24px"><h1 style="margin:0 0 20px;color:#1f3d2b;font-family:Georgia,serif;font-size:28px;font-weight:400;line-height:1.3">${heading}</h1>
<p style="font-size:15px;line-height:1.7">${escapeHtml(greeting)}</p>
<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;line-height:1.6">${rows.map(([label, value]) => `<tr><th scope="row" align="left" valign="top" style="width:42%;padding:12px 10px 12px 0;border-bottom:1px solid #e2e5dc;color:#526253;font-weight:400">${label}</th><td valign="top" style="padding:12px 0;border-bottom:1px solid #e2e5dc;overflow-wrap:anywhere;word-break:break-word;font-weight:700">${escapeHtml(value)}</td></tr>`).join("")}</table>
<p style="margin:22px 0;color:#526253;font-size:13px;line-height:1.7">${note}</p>
<a href="${escapeHtml(url.href)}" style="display:inline-block;padding:15px 24px;border-radius:999px;background:#1f3d2b;color:#fff;text-decoration:none;font-weight:700;font-size:15px;line-height:1.5">View My Bookings</a></td></tr>
<tr><td style="padding:20px 24px;background:#f1ede2;font-size:12px;line-height:1.7;color:#526253">Need help? <a href="mailto:info@ayursarga.com" style="color:#1f3d2b">info@ayursarga.com</a><br>Ayursarga · Trusted care, connected.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}
