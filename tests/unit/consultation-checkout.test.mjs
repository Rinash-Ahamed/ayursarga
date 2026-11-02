import { test } from "node:test";
import assert from "node:assert/strict";
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

test("checkout sends the stable action identity without storing previous-payment state, including ambiguous failures", async () => {
  for (const error of [new Error("Connection lost"), new ApiError(503), new ApiError(400), new ApiError(409)]) {
    const f = fixture(() => {
      assert.equal(f.storage.size, 0);
      throw error;
    });
    try {
      await assert.rejects(f.checkout.preparePaidConsultation({ requestId: "stable-request" }));
      assert.equal(f.storage.size, 0);
      assert.equal(JSON.parse(f.calls[0][1].body).requestId, "stable-request");
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

test("checkout prefills the consumer identity separately from the Ayursarga merchant name without extra fields", async () => {
  const f = fixture(() => ({ checkout: { ...ready, bookingId: "confirmed-booking" } }));
  try {
    const outcome = f.checkout.payForConsultation({ ...ready, customer: { name: "Consumer Name", email: "consumer@example.test", contact: "+919876543210", commission: 100 } });
    await Promise.resolve(); await Promise.resolve();
    const options = f.options();
    assert.equal(options.name, "Ayursarga");
    assert.deepEqual(options.prefill, { name: "Consumer Name", email: "consumer@example.test", contact: "+919876543210" });
    assert.equal(options.amount, ready.totalPaise);
    await options.handler({ razorpay_payment_id: "pay_Test", razorpay_signature: "signature" });
    assert.equal((await outcome).bookingId, "confirmed-booking");
  } finally { f.restore(); }
});

test("closing checkout checks the saved payment without claiming success or creating another order", async () => {
  const f = fixture(() => ({ checkout: ready }));
  try {
    const result = f.checkout.payForConsultation(ready);
    const rejected = assert.rejects(result, /not confirmed yet/);
    await Promise.resolve(); await Promise.resolve();
    await f.options().modal.ondismiss(); await rejected;
    assert.equal(f.calls.length, 1); assert.deepEqual(JSON.parse(f.calls[0][1].body), { action: "abandon" });
    assert.equal(f.storage.size, 0);
  } finally { f.restore(); }
});

test("closing a verified never-attempted checkout signals a fresh attempt without browser recovery state or false payment success", async () => {
  const f = fixture(() => ({ checkout: { ...ready, state: "abandoned" } }));
  try {
    const result = f.checkout.payForConsultation(ready);
    const rejected = assert.rejects(result, error => error.name === "ConsultationCheckoutClosedError");
    await Promise.resolve(); await Promise.resolve();
    await f.options().modal.ondismiss();
    await f.options().modal.ondismiss();
    await rejected;
    assert.equal(f.calls.length, 1);
    assert.equal(f.storage.size, 0);
  } finally { f.restore(); }
});

test("an uncertain close reports unconfirmed payment; a verified paid close opens the existing booking", async () => {
  for (const paid of [false, true]) {
    const f = fixture(() => { if (!paid) throw new Error("Network unavailable"); return { checkout: { ...ready, bookingId: "existing-booking" } }; });
    try {
      const result = f.checkout.payForConsultation(ready);
      const outcome = paid ? result : assert.rejects(result, /not confirmed yet/);
      await Promise.resolve(); await Promise.resolve();
      await f.options().modal.ondismiss();
      const confirmed = await outcome;
      assert.equal(f.storage.size, 0);
      if (paid) assert.equal(confirmed.bookingId, "existing-booking");
    } finally { f.restore(); }
  }
});
