export type ConsultationEmailStatus = "pending" | "sending" | "accepted" | "failed" | "unknown";
export type ConsultationEmailResult = { status: ConsultationEmailStatus };

export function consultationEmailFeedback(result?: ConsultationEmailResult, recipient: "consumer" | "consultant" = "consumer") {
  if (!result) return "";
  if (result.status === "accepted") return `The ${recipient} email was accepted by the mail service; inbox delivery is not guaranteed.`;
  if (result.status === "failed") return `The appointment was saved, but the mail service did not confirm the ${recipient} email. Please contact the ${recipient} directly; the email will not be resent automatically.`;
  return `The appointment was saved, but ${recipient} email delivery could not be verified. Please contact the ${recipient} directly. The email will not be resent automatically.`;
}
