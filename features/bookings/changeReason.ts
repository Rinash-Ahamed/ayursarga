export const MAX_BOOKING_CHANGE_REASON = 500;
/** Shared validation for reasons visible to the booking's recipients. */
export function bookingChangeReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason.length >= 3 && reason.length <= MAX_BOOKING_CHANGE_REASON
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(reason) ? reason : null;
}
export function bookingActorLabel(role: unknown) {
  return role === "admin" ? "Ayursarga team" : role === "consumer" ? "Customer" : "Not recorded";
}
