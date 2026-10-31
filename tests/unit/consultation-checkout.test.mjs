import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

class ApiError extends Error { constructor(status) { super("Request declined"); this.status = status; } }
function fixture(request) {
  const saved = globalThis.window;
  const storage = new Map();
  const calls = [];
  let options;
  globalThis.window = { sessionStorage: { setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    Razorpay: class { constructor(value) { options = value; } open() {} close() {} } };
  const checkout = loadTypeScript("services/payments/consultationCheckout.ts", {
    "@/services/auth/client": { getClientAuth: () => ({ currentUser: { uid: "patient" } }) },
    "@/services/api/client": { AuthorizedApiError: ApiError, authorizedApiRequest: async (...args) => { calls.push(args); return request(...args); } },
  });
  return { checkout, storage, calls, options: () => options, restore: () => { globalThis.window = saved; } };
}
const ready = { intentId: "consultation-safe", state: "ready", orderId: "order_Test", keyId: "rzp_test_public", totalPaise: 11000, currency: "INR" };

test("checkout persists its deterministic own-user recovery ID before networking, retaining ambiguous outcomes only", async () => {
  for (const error of [new Error("Connection lost"), new ApiError(503), new ApiError(400), new ApiError(409)]) {
    const f = fixture(() => {
      assert.equal(f.storage.get("ayursarga-pending-consultation-payment:patient"), `consultation-${createHash("sha256").update("patient:stable-request").digest("hex")}`);
      throw error;
    });
    try {
      await assert.rejects(f.checkout.preparePaidConsultation({ requestId: "stable-request" }));
      assert.equal(f.storage.size, error.status === 400 || error.status === 409 ? 0 : 1);
    } finally { f.restore(); }
  }
});

test("checkout confirms only the backend result, ignores duplicate callbacks and sends no internal financial fields", async () => {
  const f = fixture(() => ({ checkout: { ...ready, bookingId: "confirmed-booking" } }));
  try {
    const outcome = f.checkout.payForConsultation(ready);
    await Promise.resolve(); await Promise.resolve();
    const options = f.options();
    assert.equal(options.amount, 11000); assert.equal(options.commission, undefined); assert.equal(options.notes, undefined);
    await options.handler({ razorpay_payment_id: "pay_Test", razorpay_signature: "signature" });
    await options.handler({ razorpay_payment_id: "pay_Test", razorpay_signature: "signature" });
    assert.equal((await outcome).bookingId, "confirmed-booking"); assert.equal(f.calls.length, 1); assert.equal(f.storage.size, 0);
    assert.deepEqual(JSON.parse(f.calls[0][1].body), { paymentId: "pay_Test", signature: "signature" });
  } finally { f.restore(); }
});

test("closing checkout checks the saved payment without claiming success or creating another order", async () => {
  const f = fixture(() => ({ checkout: ready }));
  try {
    const result = f.checkout.payForConsultation(ready);
    const rejected = assert.rejects(result, /not confirmed yet/);
    await Promise.resolve(); await Promise.resolve();
    await f.options().modal.ondismiss(); await rejected;
    assert.equal(f.calls.length, 1); assert.deepEqual(JSON.parse(f.calls[0][1].body), { action: "check" });
    assert.equal(f.storage.size, 1);
  } finally { f.restore(); }
});
