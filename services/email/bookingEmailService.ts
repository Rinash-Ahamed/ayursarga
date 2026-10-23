import "server-only";

import { after } from "next/server";
import { bookingEmail, type BookingEmailData } from "@/lib/bookingEmail";
import { authEmailSiteUrl } from "@/services/auth/authEmailService";
import { sendEmail } from "@/services/email/emailService";
import { isValidEmail } from "@/utils/text";

/** Invoke only for a newly committed confirmation, never inside a transaction. */
export function scheduleBookingConfirmation(kind: BookingEmailData["kind"], bookingId: string, booking: Record<string, unknown>) {
  try {
    const recipient = typeof booking.consumerEmail === "string" ? booking.consumerEmail.trim().toLowerCase() : "";
    if (!isValidEmail(recipient)) throw new Error("Missing booking recipient");
    const url = new URL(kind === "hospital" ? "/app/bookings" : "/app/bookings/consultations", authEmailSiteUrl());
    url.searchParams.set("booking", bookingId);
    // Whitelist email fields: no commission, private notes or clinical details.
    const template = bookingEmail({
      kind, consumerName: String(booking.consumerName ?? ""), bookingReference: String(booking.bookingReference ?? ""),
      providerName: String((kind === "hospital" ? booking.hospitalName : booking.consultantName) ?? ""),
      serviceName: String(booking.serviceName ?? ""), location: String(booking.hospitalLocation ?? ""),
      date: booking.confirmedDate ?? booking.preferredDate, time: typeof booking.confirmedTime === "string" ? booking.confirmedTime : null,
      amount: typeof (kind === "hospital" ? booking.servicePrice : booking.consultantCharge) === "number"
        ? (kind === "hospital" ? booking.servicePrice : booking.consultantCharge) as number : undefined,
      bystanderCount: typeof booking.bystanderCount === "number" ? booking.bystanderCount : undefined,
      additionalBystanderTotal: typeof booking.additionalBystanderTotal === "number" ? booking.additionalBystanderTotal : undefined,
      bookingUrl: url.href,
    });
    after(async () => {
      try { await sendEmail({ to: recipient, replyTo: "info@ayursarga.com", ...template }); }
      catch { console.error("Ayursarga booking confirmation email could not be delivered."); }
    });
  } catch {
    // Email failure must never change an already committed booking response.
    console.error("Ayursarga booking confirmation email could not be scheduled.");
  }
}
