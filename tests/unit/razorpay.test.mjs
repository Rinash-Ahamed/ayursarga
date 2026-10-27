import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const helpers = loadTypeScript("services/payments/razorpay.ts");
const envKeys = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"];
let originalEnv;
let originalFetch;
let requests;
const order = { entity: "order", id: "order_Test123", amount: 12345, currency: "INR", receipt: "test_receipt", status: "created", amount_paid: 0, amount_due: 12345 };
const payment = { entity: "payment", id: "pay_Test123", order_id: order.id, amount: order.amount, currency: "INR", status: "captured", captured: true, amount_refunded: 0 };
const expected = { orderId: order.id, paymentId: payment.id, amountPaise: order.amount };
const sign = (body, secret) => createHmac("sha256", secret).update(body).digest("hex");
const errorCode = (code, unknown = false, status) => (error) => {
  assert.equal(error.name, "RazorpayError");
  assert.equal(error.code, code);
  assert.equal(error.outcomeUnknown, unknown);
  if (status !== undefined) assert.equal(error.httpStatus, status);
  assert.doesNotMatch(error.message, /test_api_secret|test_webhook_secret|Basic |customer@example/);
  return true;
};

beforeEach(() => {
  originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  originalFetch = globalThis.fetch;
  process.env.RAZORPAY_KEY_ID = "rzp_test_fake123";
  process.env.RAZORPAY_KEY_SECRET = "test_api_secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
  requests = [];
  // No request can reach Razorpay in this suite.
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return Response.json(order);
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test("readiness is side-effect-free, secret-free and separates API/webhook configuration", async () => {
  assert.deepEqual(helpers.getRazorpayReadiness(), { apiConfigured: true, webhookConfigured: true, mode: "test" });
  process.env.RAZORPAY_KEY_ID = "rzp_live_fake123";
  assert.equal(helpers.getRazorpayReadiness().mode, "live");
  delete process.env.RAZORPAY_KEY_SECRET;
  assert.deepEqual(helpers.getRazorpayReadiness(), { apiConfigured: false, webhookConfigured: true, mode: null });
  await assert.rejects(helpers.createRazorpayOrder({ amountPaise: 12345, receipt: "test_receipt" }), errorCode("CONFIGURATION"));
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  assert.throws(() => helpers.verifyRazorpayWebhookSignature("{}", "a".repeat(64)), errorCode("CONFIGURATION"));
  assert.equal(requests.length, 0);
});

test("rupees become integer paise without silently rounding invalid money inputs", () => {
  for (const [input, output] of [["123.45", 12345], ["0.29", 29], [12.3, 1230], [0, 0], [" 1.01 ", 101]]) assert.equal(helpers.rupeesToPaise(input), output);
  for (const value of [-1, NaN, Infinity, "1.001", "1e3", "1,000", "", "abc", null, [100], 0.1 + 0.2, "9007199254740991"]) {
    assert.throws(() => helpers.rupeesToPaise(value), errorCode("VALIDATION"));
  }
});

test("invalid order inputs are rejected before networking", async () => {
  for (const amountPaise of [0, 99, -100, 100.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(helpers.createRazorpayOrder({ amountPaise, receipt: "valid" }), errorCode("VALIDATION"));
  }
  for (const receipt of ["", "x".repeat(41), "customer@example.com", "../invalid", "contains space"]) {
    await assert.rejects(helpers.createRazorpayOrder({ amountPaise: 100, receipt }), errorCode("VALIDATION"));
  }
  assert.equal(requests.length, 0);
});

test("order creation uses fixed HTTPS API, server credentials, INR and no retry/cache/redirect", async () => {
  assert.deepEqual(await helpers.createRazorpayOrder({ amountPaise: order.amount, receipt: order.receipt }), {
    id: order.id, amount: order.amount, currency: "INR", receipt: order.receipt, status: "created", amount_paid: 0, amount_due: order.amount,
  });
  assert.equal(requests.length, 1);
  const { url, options } = requests[0];
  assert.equal(url, "https://api.razorpay.com/v1/orders");
  assert.equal(options.method, "POST");
  assert.equal(options.headers.Authorization, `Basic ${Buffer.from("rzp_test_fake123:test_api_secret").toString("base64")}`);
  assert.equal(options.redirect, "error");
  assert.equal(options.cache, "no-store");
  assert.ok(options.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(options.body), { amount: 12345, currency: "INR", receipt: "test_receipt", partial_payment: false });
});

test("order/network timeouts are uncertain and never automatically retried", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new DOMException("test_api_secret", "TimeoutError"); };
  await assert.rejects(helpers.createRazorpayOrder({ amountPaise: 12345, receipt: "test_receipt" }), errorCode("NETWORK", true));
  assert.equal(calls, 1);
  await assert.rejects(helpers.fetchRazorpayOrder(order.id), errorCode("NETWORK", false));
  assert.equal(calls, 2);
});

test("provider HTTP failures remain safe, with uncertain create results distinguished", async () => {
  for (const status of [400, 401, 403, 408, 429, 500, 503]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ error: { description: "test_api_secret customer@example.com" } }, { status }); };
    await assert.rejects(helpers.createRazorpayOrder({ amountPaise: 12345, receipt: "test_receipt" }), errorCode("API", status >= 500 || status === 408, status));
    assert.equal(calls, 1);
  }
});

test("unreadable or mismatched successful create responses must be reconciled, not repeated", async () => {
  for (const result of [null, {}, { ...order, amount: 500 }, { ...order, currency: "USD" }, { ...order, receipt: "other" }, { ...order, amount_due: "12345" }, { ...order, amount_paid: 1 }, { ...order, status: ["created"] }]) {
    globalThis.fetch = async () => Response.json(result);
    await assert.rejects(helpers.createRazorpayOrder({ amountPaise: 12345, receipt: "test_receipt" }), errorCode("INVALID_RESPONSE", true));
  }
  globalThis.fetch = async () => new Response("not json", { status: 200 });
  await assert.rejects(helpers.createRazorpayOrder({ amountPaise: 12345, receipt: "test_receipt" }), errorCode("INVALID_RESPONSE", true));
});

test("order/payment retrieval validates IDs before networking and checks provider identity", async () => {
  for (const id of ["", null, [order.id], "../orders", "order_bad/../escape", "https://example.com", "pay_Test123?x=1"]) {
    await assert.rejects(helpers.fetchRazorpayOrder(id), errorCode("VALIDATION"));
    await assert.rejects(helpers.fetchRazorpayPayment(id), errorCode("VALIDATION"));
  }
  assert.equal(requests.length, 0);
  const fetched = await helpers.fetchRazorpayOrder(order.id);
  assert.equal(fetched.id, order.id);
  assert.equal(requests[0].url, `https://api.razorpay.com/v1/orders/${order.id}`);
  assert.equal(requests[0].options.method, "GET");
  globalThis.fetch = async () => Response.json({ ...order, id: "order_Other" });
  await assert.rejects(helpers.fetchRazorpayOrder(order.id), errorCode("INVALID_RESPONSE"));
});

test("payment retrieval returns only whitelisted fields, not customer/bank information", async () => {
  globalThis.fetch = async () => Response.json({ ...payment, email: "customer@example.com", card: { last4: "1234" }, notes: { private: "data" } });
  const result = await helpers.fetchRazorpayPayment(payment.id);
  const safePayment = { ...payment };
  delete safePayment.entity;
  assert.deepEqual(result, safePayment);
  for (const update of [{ id: "pay_Other" }, { order_id: "../bad" }, { currency: "USD" }, { captured: "true" }, { amount: "12345" }, { amount_refunded: -1 }, { status: "unexpected" }, { status: ["captured"] }]) {
    globalThis.fetch = async () => Response.json({ ...payment, ...update });
    await assert.rejects(helpers.fetchRazorpayPayment(payment.id), errorCode("INVALID_RESPONSE"));
  }
});

test("checkout verification binds the server's saved order and payment with constant-time HMAC comparison", () => {
  const signature = sign(`${order.id}|${payment.id}`, "test_api_secret");
  assert.equal(helpers.verifyRazorpayCheckoutSignature({ serverOrderId: order.id, paymentId: payment.id, signature }), true);
  for (const input of [
    { serverOrderId: "order_Other", paymentId: payment.id, signature },
    { serverOrderId: order.id, paymentId: "pay_Other", signature },
    ...[null, "", "a".repeat(63), "z".repeat(64), "0".repeat(64)].map((invalid) => ({ serverOrderId: order.id, paymentId: payment.id, signature: invalid })),
  ]) assert.equal(helpers.verifyRazorpayCheckoutSignature(input), false);
});

test("webhook verification uses untouched bytes and a different secret from checkout", () => {
  const body = Buffer.from('{ "event": "payment.captured", "message": "नमस्ते" }');
  const signature = sign(body, "test_webhook_secret");
  assert.equal(helpers.verifyRazorpayWebhookSignature(body, signature), true);
  assert.equal(helpers.verifyRazorpayWebhookSignature(body.toString(), signature), true);
  assert.equal(helpers.verifyRazorpayWebhookSignature(JSON.stringify(JSON.parse(body.toString())), signature), false);
  assert.equal(helpers.verifyRazorpayWebhookSignature(body, sign(body, "test_api_secret")), false);
  assert.equal(helpers.verifyRazorpayWebhookSignature(body, null), false);
});

test("a valid signature is not payment success: captured status, amount, order and refunds are checked separately", () => {
  assert.doesNotThrow(() => helpers.assertRazorpayCapturedPayment(payment, expected));
  for (const update of [{ status: "authorized", captured: false }, { status: "failed" }, { captured: false }, { amount: 100 }, { currency: "USD" }, { order_id: null }, { order_id: "order_Other" }, { id: "pay_Other" }, { amount_refunded: 1 }]) {
    assert.throws(() => helpers.assertRazorpayCapturedPayment({ ...payment, ...update }, expected), errorCode("PAYMENT_MISMATCH"));
  }
});

test("foundation remains server-only and disconnected from both existing booking endpoints", () => {
  const source = readFileSync("services/payments/razorpay.ts", "utf8");
  assert.match(source, /import "server-only"/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_|firebase|firestore|setInterval|console\./);
  for (const file of ["app/api/consumer/bookings/route.ts", "app/api/consumer/consultations/route.ts"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /razorpay|services\/payments/);
  }
});
