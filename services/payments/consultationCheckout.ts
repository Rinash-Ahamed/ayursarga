"use client";

import type { ConsultationCheckout } from "@/features/payments/checkout";
import { CONSULTATION_PAYMENT_CHANGE_EVENT } from "@/features/payments/checkout";
import { authorizedApiRequest, AuthorizedApiError } from "@/services/api/client";
import { getClientAuth } from "@/services/auth/client";

type CheckoutResult = { razorpay_payment_id: string; razorpay_signature: string };
type RazorpayConstructor = new (options: Record<string, unknown>) => { open(): void; close(): void };
declare global { interface Window { Razorpay?: RazorpayConstructor; } }
let scriptLoad: Promise<void> | null = null;

/** Load only following an explicit Pay action, not on public pages or during discovery. */
export function loadConsultationCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (scriptLoad) return scriptLoad;
  scriptLoad = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.async = true;
    const timer = window.setTimeout(() => { script.remove(); scriptLoad = null; reject(new Error("Payment checkout did not load. Please check your connection and try again.")); }, 15000);
    script.onload = () => { window.clearTimeout(timer); if (window.Razorpay) resolve(); else { scriptLoad = null; reject(new Error("Payment checkout is unavailable.")); } };
    script.onerror = () => { window.clearTimeout(timer); script.remove(); scriptLoad = null; reject(new Error("Payment checkout could not be loaded.")); };
    document.head.appendChild(script);
  });
  return scriptLoad;
}

export function consultationPaymentStatus(intentId: string) {
  return authorizedApiRequest<{ checkout: ConsultationCheckout }>(`/api/consumer/consultation-payments/${encodeURIComponent(intentId)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check" }),
    signedOutMessage: "Sign in to check your consultation payment.", failureMessage: "Payment status could not be checked. Contact Ayursarga before paying again.",
  });
}

function remember(intentId: string) {
  // Opaque request ID only, never financial breakdown, credentials, signatures or card data.
  try { window.sessionStorage.setItem(`ayursarga-pending-consultation-payment:${getClientAuth().currentUser?.uid}`, intentId); window.dispatchEvent?.(new Event(CONSULTATION_PAYMENT_CHANGE_EVENT)); } catch { /* Recovery still works through webhook/bookings. */ }
}
export async function preparePaidConsultation(input: { requestId: string } & Record<string, unknown>) {
  const uid = getClientAuth().currentUser?.uid;
  if (!uid) throw new Error("Sign in before booking a consultation.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${uid}:${input.requestId}`));
  const id = `consultation-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")}`;
  // Persist before the POST: a lost HTTP response must not let a remount create a second order.
  remember(id);
  try {
    return await authorizedApiRequest<{ ok: true; checkout: ConsultationCheckout }>("/api/consumer/consultations", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, checkoutVersion: 1 }),
      signedOutMessage: "Sign in before booking a consultation.", failureMessage: "Payment setup is uncertain. Check status before paying again.",
    });
  } catch (error) {
    // Explicit pre-creation denials are safe to correct. Network/5xx outcomes retain the recovery hint.
    if (error instanceof AuthorizedApiError && [400, 401, 403, 409, 429].includes(error.status)) clearConsultationPaymentReminder();
    throw error;
  }
}
export function clearConsultationPaymentReminder() { try { window.sessionStorage.removeItem(`ayursarga-pending-consultation-payment:${getClientAuth().currentUser?.uid}`); window.dispatchEvent?.(new Event(CONSULTATION_PAYMENT_CHANGE_EVENT)); } catch { /* No storage is required for payment verification. */ } }

export async function payForConsultation(checkout: ConsultationCheckout): Promise<ConsultationCheckout> {
  if (checkout.bookingId) return checkout;
  remember(checkout.intentId);
  if (checkout.state !== "ready" || !checkout.keyId || !checkout.orderId) throw new Error(checkout.state === "paid_review"
    ? "Your payment was received and needs Ayursarga review. Please contact support; do not pay again."
    : "Payment setup is pending review. Check payment status or contact Ayursarga before paying again.");
  await loadConsultationCheckout();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Payment checkout is unavailable.");
  return new Promise((resolve, reject) => {
    let handled = false;
    const instance = new Razorpay({
      key: checkout.keyId, amount: checkout.totalPaise, currency: checkout.currency, order_id: checkout.orderId,
      name: "Ayursarga", description: "Online consultation", theme: { color: "#1f3d2b" },
      handler: async (result: CheckoutResult) => {
        if (handled) return;
        handled = true;
        try {
          const response = await authorizedApiRequest<{ checkout: ConsultationCheckout }>(`/api/consumer/consultation-payments/${encodeURIComponent(checkout.intentId)}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId: result.razorpay_payment_id, signature: result.razorpay_signature }),
            signedOutMessage: "Sign in to verify your payment.", failureMessage: "Payment verification is pending. Check status before paying again.",
          });
          if (!response.checkout.bookingId) throw new Error("Payment is awaiting verification or Admin review. Check payment status before paying again.");
          clearConsultationPaymentReminder(); resolve(response.checkout);
        } catch (error) { reject(error); }
      },
      modal: { ondismiss: async () => {
        if (handled) return;
        handled = true;
        try {
          const response = await consultationPaymentStatus(checkout.intentId);
          if (response.checkout.bookingId) { clearConsultationPaymentReminder(); resolve(response.checkout); return; }
        } catch { /* Never interpret closing checkout as payment failure or success. */ }
        reject(new Error("Checkout closed. If money was debited, check payment status before trying again. Your appointment is not confirmed yet."));
      } },
    });
    instance.open();
  });
}
