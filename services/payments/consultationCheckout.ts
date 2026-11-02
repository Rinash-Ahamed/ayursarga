"use client";

import { ConsultationCheckoutClosedError, type ConsultationCheckout } from "@/features/payments/checkout";
import { authorizedApiRequest } from "@/services/api/client";
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

function abandonConsultationCheckout(intentId: string) {
  return authorizedApiRequest<{ checkout: ConsultationCheckout }>(`/api/consumer/consultation-payments/${encodeURIComponent(intentId)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "abandon" }),
    signedOutMessage: "Sign in to check your previous checkout.", failureMessage: "We could not confirm this checkout is unpaid. Check its status before paying again.",
  });
}

export async function preparePaidConsultation(input: { requestId: string } & Record<string, unknown>) {
  const uid = getClientAuth().currentUser?.uid;
  if (!uid) throw new Error("Sign in before booking a consultation.");
  return authorizedApiRequest<{ ok: true; checkout: ConsultationCheckout }>("/api/consumer/consultations", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, checkoutVersion: 1 }),
    signedOutMessage: "Sign in before booking a consultation.", failureMessage: "Payment could not be confirmed. Check My Bookings or contact Ayursarga before paying again.",
  });
}

export async function payForConsultation(checkout: ConsultationCheckout): Promise<ConsultationCheckout> {
  if (checkout.bookingId) return checkout;
  if (checkout.state !== "ready" || !checkout.keyId || !checkout.orderId) throw new Error(checkout.state === "paid_review"
    ? "Your payment was received and needs Ayursarga review. Please contact support; do not pay again."
    : "Payment setup is pending review. Check My Bookings or contact Ayursarga before paying again.");
  await loadConsultationCheckout();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Payment checkout is unavailable.");
  return new Promise((resolve, reject) => {
    let handled = false;
    const instance = new Razorpay({
      key: checkout.keyId, amount: checkout.totalPaise, currency: checkout.currency, order_id: checkout.orderId,
      name: "Ayursarga", description: "Online consultation", theme: { color: "#1f3d2b" },
      ...(checkout.customer ? { prefill: { name: checkout.customer.name, email: checkout.customer.email, contact: checkout.customer.contact } } : {}),
      handler: async (result: CheckoutResult) => {
        if (handled) return;
        handled = true;
        try {
          const response = await authorizedApiRequest<{ checkout: ConsultationCheckout }>(`/api/consumer/consultation-payments/${encodeURIComponent(checkout.intentId)}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId: result.razorpay_payment_id, signature: result.razorpay_signature }),
            signedOutMessage: "Sign in to verify your payment.", failureMessage: "Payment verification is pending. Check status before paying again.",
          });
          if (!response.checkout.bookingId) throw new Error("Payment is awaiting verification or Ayursarga review. Check My Bookings or contact support before paying again.");
          resolve(response.checkout);
        } catch (error) { reject(error); }
      },
      modal: { ondismiss: async () => {
        if (handled) return;
        handled = true;
        try {
          const response = await abandonConsultationCheckout(checkout.intentId);
          if (response.checkout.bookingId) { resolve(response.checkout); return; }
          if (response.checkout.state === "abandoned") { reject(new ConsultationCheckoutClosedError()); return; }
        } catch { /* Never interpret closing checkout as payment failure or success. */ }
        reject(new Error("Checkout closed. If money was debited, check My Bookings or contact Ayursarga before paying again. Your appointment is not confirmed yet."));
      } },
    });
    instance.open();
  });
}
