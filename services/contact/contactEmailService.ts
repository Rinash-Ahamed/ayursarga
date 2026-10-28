import "server-only";

import { contactEmailHtml, contactEmailText, type ContactEmailData, type ContactSubmissionContext } from "@/lib/contactEmail";
import { isEmailReady, sendEmail } from "@/services/email/emailService";

export function isContactEmailReady() {
  return isEmailReady();
}

export async function sendContactEmail(data: ContactEmailData, submission?: ContactSubmissionContext) {
  await sendEmail({
    senderName: "Ayursarga Website",
    to: process.env.CONTACT_TO_EMAIL?.trim() || "info@ayursarga.com",
    replyTo: data.email,
    subject: `New Ayursarga Enquiry - ${data.interest}${submission ? ` [${submission.reference}]` : ""}`,
    html: contactEmailHtml(data, submission),
    text: contactEmailText(data, submission),
  });
}
