import { bookingFlowFixture } from "./bookingFlowFixture.mjs";
import { loadTypeScript } from "./loadTypeScript.mjs";

const pure = loadTypeScript("services/payments/razorpay.ts");
export const paidConsultant = { name: "Assigned Professional", designation: "Physician", qualification: "BAMS", yearsExperience: 3,
  status: "active", archivedAt: null, consultationServices: ["prenatal-doctor"], consultantCharge: 900.5, ayursargaCommissionPercentage: 10,
  preferredTimeSlots: ["morning"], preferredSlotTimings: { morning: { startTime: "09:30", endTime: "11:45" } }, email: "consultant@example.test" };
export const paidInput = { checkoutVersion: 1, consultantId: "AS001", serviceId: "prenatal-doctor", preferredDate: "2099-10-25", preferredTimeSlot: "morning",
  expectedSlotStartTime: "09:30", expectedSlotEndTime: "11:45", expectedCharge: 990.55, bookingTermsAccepted: true, requestId: "payment-attempt-0001", consumerNotes: "" };
export function consultationPaymentFixture(options = {}) {
  const state = { orders: new Map(), payments: new Map(), orderCalls: 0, mode: "test", uncertainOrder: false, ...options.paymentState };
  const provider = {
    ...pure, getRazorpayReadiness: () => ({ apiConfigured: true, webhookConfigured: true, mode: state.mode }), razorpayCheckoutKey: () => "rzp_test_synthetic",
    createRazorpayOrder: async ({ amountPaise, receipt }) => {
      state.orderCalls++;
      const order = { id: `order_Synthetic${state.orderCalls}`, receipt, amount: amountPaise, currency: "INR", status: "created", amount_paid: 0, amount_due: amountPaise };
      state.orders.set(order.id, order); if (state.uncertainOrder) throw Error("network"); return order;
    },
    fetchRazorpayOrder: async id => { if (!state.orders.has(id)) throw Error("missing order"); return state.orders.get(id); },
    fetchRazorpayPayment: async id => { if (!state.payments.has(id)) throw Error("missing payment"); return state.payments.get(id); },
    fetchRazorpayOrderPayments: async id => [...state.payments.values()].filter(payment => payment.order_id === id),
    verifyRazorpayCheckoutSignature: ({ signature }) => signature === "synthetic-valid-signature",
    verifyRazorpayWebhookSignature: (_raw, signature) => signature === "synthetic-valid-webhook",
  };
  let f;
  f = bookingFlowFixture({ deferInitialThrowUntilBooking: true, ...options, records: { "consultants/AS001": paidConsultant, ...options.records }, overrides: {
    "@/services/payments/razorpay": provider, "next/server": { after: () => {} },
    "@/services/firebase/admin": { getFirebaseAdminFirestore: () => f.firestore }, ...options.overrides,
  } });
  function capture(checkout, changes = {}) {
    const payment = { id: "pay_Synthetic", order_id: checkout.orderId, amount: checkout.totalPaise, currency: "INR", captured: true, status: "captured", amount_refunded: 0, fee: 234, tax: 36, ...changes };
    state.payments.set(payment.id, payment);
    const order = state.orders.get(payment.order_id);
    if (payment.captured && order) Object.assign(order, { status: "paid", amount_paid: order.amount, amount_due: 0 });
    return payment;
  }
  return { ...f, paymentState: state, provider, capture };
}
export const paymentRequest = (body, method = "POST", headers = {}) => new Request("https://test.local/api/consumer/consultations", { method, headers: { "Content-Type": "application/json", ...headers }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
export async function prepare(f, body = paidInput) {
  return f.load("app/api/consumer/consultations/route.ts").POST(paymentRequest(body));
}
export async function verify(f, id, paymentId = "pay_Synthetic", signature = "synthetic-valid-signature") {
  return f.load("app/api/consumer/consultation-payments/[intentId]/route.ts").POST(paymentRequest({ paymentId, signature }), { params: Promise.resolve({ intentId: id }) });
}
