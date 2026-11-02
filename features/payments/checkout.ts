/** Explicit safe Consumer response. No financial breakdown or operational document spreads. */
export const CONSULTATION_PAYMENT_CHANGE_EVENT = "ayursarga-consultation-payment-change";
export class ConsultationCheckoutClosedError extends Error {
  constructor() { super("Payment window closed. Your appointment is not booked. You can try again when ready."); this.name = "ConsultationCheckoutClosedError"; }
}
export type ConsultationCheckout = {
  intentId: string; state: string; bookingId: string | null; bookingReference: string | null;
  totalPaise: number; currency: "INR"; keyId?: string; orderId?: string;
  consultantName?: string; serviceName?: string; date?: string; timeWindow?: string;
  cancellationPolicy?: import("@/features/consultations/cancellationPolicy").ConsultationCancellationSnapshot;
};
