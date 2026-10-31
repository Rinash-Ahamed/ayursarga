import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Provider adapter only: booking/ledger changes belong to the authenticated orchestration layer.
const API_URL = "https://api.razorpay.com/v1";
const REQUEST_TIMEOUT_MS = 20_000;
const ORDER_ID = /^order_[A-Za-z0-9]{1,64}$/;
const PAYMENT_ID = /^pay_[A-Za-z0-9]{1,64}$/;

type ErrorCode = "CONFIGURATION" | "VALIDATION" | "NETWORK" | "API" | "INVALID_RESPONSE" | "PAYMENT_MISMATCH";
export class RazorpayError extends Error {
  constructor(public readonly code: ErrorCode, message: string, public readonly outcomeUnknown = false, public readonly httpStatus?: number) {
    super(message);
    this.name = "RazorpayError";
  }
}

function apiConfiguration() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  return keyId && /^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId) && keySecret ? { keyId, keySecret } : null;
}

export function getRazorpayReadiness() {
  const config = apiConfiguration();
  return {
    apiConfigured: config !== null,
    webhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim()),
    mode: config ? (config.keyId.startsWith("rzp_test_") ? "test" : "live") : null,
  };
}

/** Public checkout identifier only. Never return the API key secret. */
export function razorpayCheckoutKey() { return requireConfiguration().keyId; }

function requireConfiguration() {
  const config = apiConfiguration();
  if (!config) throw new RazorpayError("CONFIGURATION", "Razorpay server credentials are not configured.");
  return config;
}

/** Convert decimal INR without floating-point multiplication/rounding. */
export function rupeesToPaise(amount: string | number) {
  if (typeof amount !== "string" && typeof amount !== "number") throw new RazorpayError("VALIDATION", "Invalid INR amount.");
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(String(amount).trim());
  if (!match) throw new RazorpayError("VALIDATION", "Use a non-negative INR amount with at most two decimal places.");
  const paise = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(paise)) throw new RazorpayError("VALIDATION", "The INR amount is outside the supported range.");
  return paise;
}

function validateOrderAmount(amountPaise: number) {
  // Razorpay INR orders require at least INR 1; callers calculate prices server-side.
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) throw new RazorpayError("VALIDATION", "Order amount must be an integer of at least 100 paise.");
}

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}
const nonNegativeInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

async function request(path: string, body?: JsonObject): Promise<unknown> {
  const config = requireConfiguration();
  const writing = body !== undefined;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: writing ? "POST" : "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`,
        Accept: "application/json",
        ...(writing ? { "Content-Type": "application/json" } : {}),
      },
      body: writing ? JSON.stringify(body) : undefined,
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Never forward provider errors, credentials, customer data or request bodies.
    throw new RazorpayError("NETWORK", "Razorpay could not be reached. Reconcile any uncertain order before retrying.", writing);
  }
  if (!response.ok) {
    throw new RazorpayError("API", "Razorpay rejected the request.", writing && (response.status >= 500 || response.status === 408), response.status);
  }
  try { return await response.json(); }
  catch { throw new RazorpayError("INVALID_RESPONSE", "Razorpay returned an unreadable response.", writing); }
}

export type RazorpayOrder = {
  id: string; amount: number; currency: "INR"; receipt: string | null;
  status: "created" | "attempted" | "paid"; amount_paid: number; amount_due: number;
};

function parseOrder(value: unknown, outcomeUnknown = false): RazorpayOrder {
  const order = object(value);
  if (order.entity !== "order" || typeof order.id !== "string" || !ORDER_ID.test(order.id)
    || order.currency !== "INR" || !nonNegativeInteger(order.amount) || order.amount < 100
    || !nonNegativeInteger(order.amount_paid) || !nonNegativeInteger(order.amount_due)
    || typeof order.status !== "string" || !["created", "attempted", "paid"].includes(order.status)
    || order.amount_paid + order.amount_due !== order.amount
    || !(order.receipt === null || typeof order.receipt === "string")) {
    throw new RazorpayError("INVALID_RESPONSE", "Razorpay returned an unexpected order.", outcomeUnknown);
  }
  return { id: order.id, amount: order.amount, currency: "INR", receipt: order.receipt,
    status: order.status as RazorpayOrder["status"], amount_paid: order.amount_paid, amount_due: order.amount_due };
}

/** Receipt is an opaque server-generated reference, not customer/medical data.
 * This is NOT an idempotency store. Future callers must persist/claim a payment
 * intent before calling, and reconcile uncertain creates instead of resending.
 */
export async function createRazorpayOrder(input: { amountPaise: number; receipt: string }) {
  validateOrderAmount(input.amountPaise);
  if (typeof input.receipt !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(input.receipt)) {
    throw new RazorpayError("VALIDATION", "Use an opaque order receipt of 1 to 40 letters, digits, underscores or hyphens.");
  }
  const order = parseOrder(await request("/orders", { amount: input.amountPaise, currency: "INR", receipt: input.receipt, partial_payment: false }), true);
  if (order.amount !== input.amountPaise || order.receipt !== input.receipt) throw new RazorpayError("INVALID_RESPONSE", "Razorpay returned a different order amount or reference.", true);
  return order;
}

export async function fetchRazorpayOrder(orderId: string) {
  if (typeof orderId !== "string" || !ORDER_ID.test(orderId)) throw new RazorpayError("VALIDATION", "Invalid Razorpay order ID.");
  const order = parseOrder(await request(`/orders/${orderId}`));
  if (order.id !== orderId) throw new RazorpayError("INVALID_RESPONSE", "Razorpay returned a different order.");
  return order;
}

export type RazorpayPayment = {
  id: string; order_id: string | null; amount: number; currency: "INR";
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  captured: boolean; amount_refunded: number;
  fee?: number | null; tax?: number | null;
};

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  if (typeof paymentId !== "string" || !PAYMENT_ID.test(paymentId)) throw new RazorpayError("VALIDATION", "Invalid Razorpay payment ID.");
  return parsePayment(await request(`/payments/${paymentId}`), paymentId);
}

/** Recovery uses only the server-owned order, never a client-supplied payment claim. */
export async function fetchRazorpayOrderPayments(orderId: string): Promise<RazorpayPayment[]> {
  if (!ORDER_ID.test(orderId)) throw new RazorpayError("VALIDATION", "Invalid Razorpay order ID.");
  const response = object(await request(`/orders/${orderId}/payments`));
  if (response.entity !== "collection" || !Array.isArray(response.items) || response.items.length > 100
    || response.count !== response.items.length) throw new RazorpayError("INVALID_RESPONSE", "Payment attempts require manual review.");
  return response.items.map(value => {
    const payment = parsePayment(value, String(object(value).id));
    if (payment.order_id !== orderId) throw new RazorpayError("INVALID_RESPONSE", "Payment belongs to a different order.");
    return payment;
  });
}

function parsePayment(value: unknown, paymentId: string): RazorpayPayment {
  const payment = object(value);
  if (!PAYMENT_ID.test(paymentId) || payment.entity !== "payment" || payment.id !== paymentId || payment.currency !== "INR"
    || !nonNegativeInteger(payment.amount) || !nonNegativeInteger(payment.amount_refunded)
    || typeof payment.captured !== "boolean"
    || typeof payment.status !== "string" || !["created", "authorized", "captured", "refunded", "failed"].includes(payment.status)
    || !(payment.order_id === null || (typeof payment.order_id === "string" && ORDER_ID.test(payment.order_id)))) {
    throw new RazorpayError("INVALID_RESPONSE", "Razorpay returned an unexpected payment.");
  }
  // Deliberately exclude provider customer/contact/card/bank details.
  return { id: paymentId, order_id: payment.order_id, amount: payment.amount, currency: "INR",
    status: payment.status as RazorpayPayment["status"], captured: payment.captured, amount_refunded: payment.amount_refunded,
    fee: nonNegativeInteger(payment.fee) ? payment.fee : null, tax: nonNegativeInteger(payment.tax) ? payment.tax : null };
}

function validSignature(payload: string | Uint8Array, signature: string | null, secret: string) {
  if (typeof signature !== "string" || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

/** Use the order ID saved on OUR server, never an untrusted checkout order ID.
 * Authenticity alone does not establish capture, amount, ownership or availability.
 */
export function verifyRazorpayCheckoutSignature(input: { serverOrderId: string; paymentId: string; signature: string | null }) {
  const config = requireConfiguration();
  if (typeof input.serverOrderId !== "string" || !ORDER_ID.test(input.serverOrderId)
    || typeof input.paymentId !== "string" || !PAYMENT_ID.test(input.paymentId)) return false;
  return validSignature(`${input.serverOrderId}|${input.paymentId}`, input.signature, config.keySecret);
}

/** Pass untouched request bytes BEFORE parsing JSON. Verification is not replay
 * protection: future handlers must deduplicate x-razorpay-event-id atomically.
 */
export function verifyRazorpayWebhookSignature(rawBody: string | Uint8Array, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) throw new RazorpayError("CONFIGURATION", "Razorpay webhook secret is not configured.");
  return validSignature(rawBody, signature, secret);
}

/** Only pass a payment fetched server-side, plus expectations from a saved intent.
 * Does not confirm a booking or replace authorization, audits or transactions.
 */
export function assertRazorpayCapturedPayment(payment: RazorpayPayment, expected: { orderId: string; paymentId: string; amountPaise: number }) {
  validateOrderAmount(expected.amountPaise);
  if (!ORDER_ID.test(expected.orderId) || !PAYMENT_ID.test(expected.paymentId)
    || payment.id !== expected.paymentId || payment.order_id !== expected.orderId
    || payment.currency !== "INR" || payment.amount !== expected.amountPaise
    || payment.status !== "captured" || payment.captured !== true || payment.amount_refunded !== 0) {
    throw new RazorpayError("PAYMENT_MISMATCH", "Payment is not an unrefunded captured payment for the expected order and amount.");
  }
}
