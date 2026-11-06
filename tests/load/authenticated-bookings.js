/* global __ENV, __VU, open */
import http from "k6/http";
import encoding from "k6/encoding";
import { check, fail } from "k6";
import { Rate } from "k6/metrics";
import { validateStagingTarget } from "./guard.mjs";
const fixture = JSON.parse(open(__ENV.FIXTURE_FILE));
const target = validateStagingTarget(__ENV, fixture);
const mode = __ENV.WORKFLOW ?? "slots";
if (!["slots", "center", "consultation-hold", "consultation-change"].includes(mode)) throw Error("Choose a documented test workflow.");
if (mode !== "slots" && __ENV.ALLOW_STAGING_MUTATIONS !== "SYNTHETIC_RECORDS_ONLY") throw Error("Synthetic staging mutations require separate approval.");
if (!fixture.users || fixture.users.length < target.vus) throw Error("Use a separate completed Consumer test account per VU.");
if (!/^[a-zA-Z0-9-]{16,50}$/.test(__ENV.RUN_ID ?? "")) throw Error("Supply a unique run ID; keep it unchanged only for an intentional retry.");
const users = fixture.users.slice(0, target.vus);
const ids = new Set();
for (const user of users) {
  let token;
  try { token = JSON.parse(encoding.b64decode(user.token.split(".")[1], "rawurl", "s")); } catch { throw Error("Use valid fresh staging ID tokens."); }
  if (token.aud !== target.projectId || token.exp * 1000 < Date.now() + 300000 || !token.sub || ids.has(token.sub)) throw Error("Tokens must be fresh, unique and from the staging Firebase project.");
  ids.add(token.sub);
}
const errors = new Rate("workflow_errors");
export const options = {
  // One complete workflow per account; repeated iterations would create junk/quotas.
  scenarios: { booking: { executor: "per-vu-iterations", vus: target.vus, iterations: 1, maxDuration: "5m" } },
  summaryTrendStats: ["avg", "min", "med", "p(95)", "p(99)", "max"],
  systemTags: ["status", "method", "name", "scenario", "expected_response"],
  thresholds: { workflow_errors: ["rate<0.01"], http_req_failed: ["rate<0.01"], http_req_duration: ["p(95)<3000", "p(99)<10000"] },
};
function call(user, method, path, body, name, accepted = [200]) {
  const response = http.request(method, target.origin + path, body === undefined ? null : JSON.stringify(body), {
    redirects: 0, timeout: "60s", headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" }, tags: { name },
  });
  const ok = check(response, { "workflow request succeeded": value => accepted.includes(value.status) });
  errors.add(!ok);
  if (!ok) fail("Staging workflow failed; review private server diagnostics. No automatic retry.");
  return response.json();
}
export default function authenticatedBooking() {
  const user = users[__VU - 1];
  const requestId = `${__ENV.RUN_ID}-${__VU}`;
  if (mode === "slots") {
    call(user, "GET", `/api/consultations/slots?${["consultantId", "service", "date"].map(key => `${key}=${encodeURIComponent(user[key] ?? "")}`).join("&")}`, undefined, "GET /api/consultations/slots");
    return;
  }
  if (mode === "center") {
    const body = { ...user.centerInput, requestId, bookingTermsAccepted: true };
    const created = call(user, "POST", "/api/consumer/bookings", body, "POST /api/consumer/bookings", [200, 201]);
    const retry = call(user, "POST", "/api/consumer/bookings", body, "POST /api/consumer/bookings retry", [200]);
    if (!created.bookingId || created.bookingId !== retry.bookingId || created.bookingReference !== retry.bookingReference) fail("Booking retry identity mismatch.");
    // A Consumer's existing Firestore rule authorizes only their own record.
    const document = http.get(`https://firestore.googleapis.com/v1/projects/${target.projectId}/databases/(default)/documents/bookings/${created.bookingId}`, { redirects: 0, headers: { Authorization: `Bearer ${user.token}` }, tags: { name: "GET own staging booking" } });
    if (document.status !== 200) fail("Own-booking read failed.");
    const audit = document.json().fields?.lastAuditId?.stringValue;
    call(user, "POST", `/api/bookings/${created.bookingId}/cancel`, { expectedAuditId: audit, cancellationReason: "Synthetic staging load-test cancellation" }, "POST /api/bookings/[id]/cancel");
    // Search Center has no reschedule/payment flow in this release.
  } else if (mode === "consultation-hold") {
    const body = { ...user.consultationInput, requestId, bookingTermsAccepted: true, checkoutVersion: 1 };
    const first = call(user, "POST", "/api/consumer/consultations", body, "POST /api/consumer/consultations");
    const retry = call(user, "POST", "/api/consumer/consultations", body, "POST /api/consumer/consultations retry");
    if (!first.checkout?.intentId || first.checkout.intentId !== retry.checkout?.intentId || first.checkout.orderId !== retry.checkout?.orderId) fail("Checkout retry identity mismatch.");
    call(user, "POST", `/api/consumer/consultation-payments/${first.checkout.intentId}`, { action: "abandon" }, "POST /api/consumer/consultation-payments/[id] abandon");
  } else {
    // Seed distinct confirmed Test-mode appointments >24h away before this run.
    const changed = call(user, "PATCH", `/api/consultations/${user.bookingId}`, { action: "reschedule", expectedAuditId: user.expectedAuditId, requestId,
      confirmedDate: user.newDate, confirmedTime: user.newTime, rescheduleReason: "Synthetic staging reschedule" }, "PATCH /api/consultations/[id] reschedule");
    call(user, "PATCH", `/api/consultations/${user.bookingId}`, { action: "cancelled", expectedAuditId: changed.changes?.lastAuditId, requestId: `${requestId}-cancel`, cancellationReason: "Synthetic staging cancellation" }, "PATCH /api/consultations/[id] cancel");
  }
}
