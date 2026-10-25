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
  event?: "confirmed" | "rescheduled" | "cancelled";
  timeWindow?: string;
  previousDate?: unknown;
  previousTime?: string | null;
  previousTimeWindow?: string;
  audience?: "consumer" | "consultant";
};

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);

export function bookingEmail(data: BookingEmailData) {
  const url = new URL(data.bookingUrl);
  if (url.protocol !== "https:" && !(["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:")) throw new Error("A secure booking link is required.");
  const hospital = data.kind === "hospital";
  const consultant = !hospital && data.audience === "consultant";
  const event = hospital ? "confirmed" : data.event ?? "confirmed";
  const subject = `Ayursarga booking ${event}${data.bookingReference ? `: ${data.bookingReference}` : ""}`;
  const heading = hospital ? "Your hospital booking is confirmed" : consultant ? `Consultation ${event === "confirmed" ? "booked" : event}` : `Your online consultation is ${event}`;
  const rows: [string, string][] = [
    ["Booking reference", data.bookingReference || "See My Bookings"],
    [hospital ? "Hospital" : "Consultant", data.providerName],
    [hospital ? "Package" : "Service", data.serviceName],
    [hospital ? "Preferred start date / Expected Delivery Date" : event === "rescheduled" ? "Updated appointment date" : event === "cancelled" ? "Original appointment date" : "Appointment date", formatDisplayDate(data.date, "See My Bookings")],
  ];
  if (consultant) rows.splice(2, 0, ["Consumer", data.consumerName]);
  if (data.time) rows.push([event === "rescheduled" ? "Updated appointment time" : event === "cancelled" ? "Original appointment time" : "Appointment time", `${data.time} IST`]);
  else if (!hospital && data.timeWindow) rows.push([event === "cancelled" ? "Original appointment window" : "Appointment window", `${data.timeWindow} IST`]);
  if (event === "rescheduled") {
    rows.push(["Original appointment date", formatDisplayDate(data.previousDate, "See My Bookings")]);
    rows.push(["Original appointment time", `${data.previousTime || data.previousTimeWindow || "See My Bookings"} IST`]);
  }
  if (hospital && data.location) rows.push(["Location", data.location]);
  if (typeof data.amount === "number" && Number.isFinite(data.amount)) rows.push([hospital ? "Package amount" : "Consultation charge", formatCurrency(data.amount)]);
  if (hospital && typeof data.bystanderCount === "number") rows.push(["Bystanders", String(data.bystanderCount)]);
  if (hospital && data.additionalBystanderTotal) rows.push(["Additional bystander amount", formatCurrency(data.additionalBystanderTotal)]);
  const greetingName = consultant ? data.providerName : data.consumerName;
  const greeting = greetingName ? `Hello ${greetingName},` : "Hello,";
  const note = consultant
    ? `An assigned consultation has been ${event === "confirmed" ? "booked" : event}. ${event === "rescheduled" ? "Please use the updated schedule shown above. " : ""}For appointment coordination, contact info@ayursarga.com and quote the booking reference.`
    : event === "rescheduled"
    ? "Your appointment has been rescheduled. Please use the updated date and time shown above. Contact info@ayursarga.com if this schedule does not suit you."
    : event === "cancelled"
      ? "Your appointment has been cancelled. For assistance or to arrange another appointment, contact info@ayursarga.com or explore Wellness Path on Ayursarga. This notice does not confirm a refund."
      : "You can view the latest booking details in your Ayursarga account. This confirmation is not a payment receipt.";
  const actionLabel = consultant ? "Contact Ayursarga" : "View My Bookings";
  const text = `Ayursarga\n\n${heading}\n\n${greeting}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\n${note}\n\n${actionLabel}: ${url.href}\n\nNeed help? info@ayursarga.com`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f9f5ea;color:#243b2d;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e2e5dc;border-radius:20px;overflow:hidden">
<tr><td style="padding:28px 24px;background:#1f3d2b;border-bottom:3px solid #c9a66b"><div style="font-family:Georgia,serif;font-size:30px;color:#fff">Ayursarga</div><p style="margin:8px 0 0;color:#e3d1af;font-size:11px;letter-spacing:1.5px">BOOKING ${event === "confirmed" ? "CONFIRMATION" : event === "rescheduled" ? "RESCHEDULED" : "CANCELLATION"}</p></td></tr>
<tr><td style="padding:28px 24px"><h1 style="margin:0 0 20px;color:#1f3d2b;font-family:Georgia,serif;font-size:28px;font-weight:400;line-height:1.3">${heading}</h1>
<p style="font-size:15px;line-height:1.7">${escapeHtml(greeting)}</p>
<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;line-height:1.6">${rows.map(([label, value]) => `<tr><th scope="row" align="left" valign="top" style="width:42%;padding:12px 10px 12px 0;border-bottom:1px solid #e2e5dc;color:#526253;font-weight:400">${label}</th><td valign="top" style="padding:12px 0;border-bottom:1px solid #e2e5dc;overflow-wrap:anywhere;word-break:break-word;font-weight:700">${escapeHtml(value)}</td></tr>`).join("")}</table>
<p style="margin:22px 0;color:#526253;font-size:13px;line-height:1.7">${note}</p>
<a href="${escapeHtml(url.href)}" style="display:inline-block;padding:15px 24px;border-radius:999px;background:#1f3d2b;color:#fff;text-decoration:none;font-weight:700;font-size:15px;line-height:1.5">${actionLabel}</a></td></tr>
<tr><td style="padding:20px 24px;background:#f1ede2;font-size:12px;line-height:1.7;color:#526253">Need help? <a href="mailto:info@ayursarga.com" style="color:#1f3d2b">info@ayursarga.com</a><br>Ayursarga · Trusted care, connected.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}
