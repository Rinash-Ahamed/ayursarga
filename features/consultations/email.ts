export type ConsultationEmailStatus = "pending" | "sending" | "accepted" | "failed" | "unknown";
export type ConsultationEmailResult = { status: ConsultationEmailStatus };

export function consultationEmailFeedback(result?: ConsultationEmailResult) {
  if (!result) return "";
  if (result.status === "accepted") return "The consumer email was accepted by the mail service; inbox delivery is not guaranteed.";
  if (result.status === "failed") return "The appointment was saved, but the mail service did not confirm the consumer email. Please contact the consumer directly; the email will not be resent automatically.";
  return "The appointment was saved, but email delivery could not be verified. Please contact the consumer directly. The email will not be resent automatically.";
}
