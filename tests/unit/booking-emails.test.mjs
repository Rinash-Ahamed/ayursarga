import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

const record = {
  consumerName: 'Patient <script>"test"</script>', consumerEmail: "patient@example.com",
  bookingReference: "AYURTEST01", hospitalName: "Trusted centre", hospitalLocation: "Kochi, Kerala",
  consultantName: "Assigned Doctor", serviceName: "7-day package", confirmedDate: "2099-10-25", confirmedTime: null,
  servicePrice: 12000, consultantCharge: 900.5, bystanderCount: 2, additionalBystanderTotal: 500,
  commissionPercentage: 10, estimatedCommission: 1200, consumerNotes: "private care notes", adminNotes: "private admin notes",
};

test("confirmation email is branded, escaped, day-first and contains only Consumer details", () => {
  const { bookingEmail } = loadTypeScript("lib/bookingEmail.ts");
  for (const kind of ["hospital", "consultation"]) {
    const result = bookingEmail({ kind, ...record, providerName: kind === "hospital" ? record.hospitalName : record.consultantName,
      date: record.confirmedDate, time: kind === "hospital" ? null : "10:15", amount: kind === "hospital" ? 12000 : 900.5,
      bookingUrl: "https://ayursarga.com/app/bookings?booking=test" });
    assert.match(result.html, /#1f3d2b/);
    assert.match(result.html, /#f9f5ea/);
    assert.match(result.html, /&lt;script&gt;/);
    assert.doesNotMatch(result.html, /<script>/);
    assert.match(result.text, /25\/10\/2099/);
    assert.match(result.text, /AYURTEST01/);
    assert.doesNotMatch(result.text, /commission|private care notes|private admin notes/i);
    assert.equal(result.text.includes("Appointment time"), kind === "consultation");
    assert.equal(result.text.includes("10:15 IST"), kind === "consultation");
    assert.equal(result.text.includes("Bystanders"), kind === "hospital");
    assert.match(result.text, /not a payment receipt/);
  }
  assert.throws(() => bookingEmail({ ...record, kind: "hospital", bookingUrl: "javascript:alert(1)" }));
});

test("confirmation emails are deferred, use saved recipients, and failures never escape or log personal data", async () => {
  const callbacks = [];
  const sent = [];
  const logs = [];
  const oldError = console.error;
  console.error = (...args) => logs.push(args.join(" "));
  let fail = false;
  try {
    const service = loadTypeScript("services/email/bookingEmailService.ts", {
      "next/server": { after: (callback) => callbacks.push(callback) },
      "@/services/auth/authEmailService": { authEmailSiteUrl: () => "https://ayursarga.com" },
      "@/services/email/emailService": { sendEmail: async (data) => { if (fail) throw new Error("Sensitive SMTP credentials"); sent.push(data); } },
    });
    service.scheduleBookingConfirmation("hospital", "hospital-booking", record);
    assert.equal(sent.length, 0);
    assert.equal(callbacks.length, 1);
    await callbacks.shift()();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, record.consumerEmail);
    assert.match(sent[0].text, /https:\/\/ayursarga.com\/app\/bookings\?booking=hospital-booking/);
    service.scheduleBookingConfirmation("consultation", "online-booking", { ...record, confirmedTime: "10:15" });
    await callbacks.shift()();
    assert.match(sent[1].text, /\/app\/bookings\/consultations\?booking=online-booking/);
    fail = true;
    service.scheduleBookingConfirmation("hospital", "failed-delivery", record);
    await assert.doesNotReject(callbacks.shift()());
    assert.equal(logs.length, 1);
    assert.doesNotMatch(logs.join(" "), /Sensitive|patient@example.com/);
    service.scheduleBookingConfirmation("hospital", "invalid-email", { ...record, consumerEmail: "invalid" });
    assert.equal(callbacks.length, 0);
    assert.equal(logs.length, 2);
  } finally { console.error = oldError; }
});
