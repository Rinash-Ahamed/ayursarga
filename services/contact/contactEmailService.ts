import "server-only";

import { contactEmailHtml, contactEmailText, type ContactEmailData } from "@/lib/contactEmail";
import { isEmailReady, sendEmail } from "@/services/email/emailService";

export function isContactEmailReady() {
  return isEmailReady();
}

export async function sendContactEmail(data: ContactEmailData) {
  await sendEmail({
    senderName: "Ayursarga Website",
    to: process.env.CONTACT_TO_EMAIL?.trim() || "info@ayursarga.com",
    replyTo: data.email,
    subject: `New Ayursarga Enquiry - ${data.interest}`,
    html: contactEmailHtml(data),
    text: contactEmailText(data),
  });
}
