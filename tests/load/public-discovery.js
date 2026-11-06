/* global __ENV, open */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { validateStagingTarget } from "./guard.mjs";
const fixture = JSON.parse(open(__ENV.FIXTURE_FILE));
const target = validateStagingTarget(__ENV, fixture);
const errors = new Rate("workflow_errors");
const handler = new Trend("handler_duration", true);
const seconds = Number(__ENV.DURATION_SECONDS ?? 60);
if (!Number.isInteger(seconds) || seconds < 10 || seconds > 180) throw Error("Use a 10–180 second measured run.");
export const options = {
  scenarios: { discovery: { executor: "constant-vus", vus: target.vus, duration: `${seconds}s`, gracefulStop: "15s" } },
  summaryTrendStats: ["avg", "min", "med", "p(95)", "p(99)", "max"],
  systemTags: ["status", "method", "name", "scenario", "expected_response"],
  thresholds: { http_req_failed: [{ threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "30s" }], workflow_errors: ["rate<0.01"], http_req_duration: ["p(95)<2000", "p(99)<5000"] },
};
function read(path, name, validate) {
  const response = http.get(target.origin + path, { redirects: 0, timeout: "20s", tags: { name } });
  let valid = false;
  try { valid = response.status === 200 && validate(response.json()); } catch { /* Count failures without logging payloads. */ }
  errors.add(!check(response, { "valid public response": () => valid }));
  const timing = response.headers["Server-Timing"]?.match(/total;dur=([\d.]+)/);
  if (timing) handler.add(Number(timing[1]), { name });
}
export function setup() {
  if (!fixture.hospitalId || !fixture.search || !fixture.serviceName) throw Error("Seed public hospital/package fixtures first.");
  const response = http.get(target.origin + "/api/health?deep=true", { redirects: 0, headers: { Accept: "application/json" }, tags: { name: "GET /api/health" } });
  if (response.status !== 200) throw Error("Staging configuration health failed.");
}
export default function publicDiscovery() {
  read("/api/public/hospitals?pageSize=12", "GET /api/public/hospitals", body => Array.isArray(body.documents) && body.documents.length > 0 && body.documents.length <= 12);
  read(`/api/public/hospitals?q=${encodeURIComponent(fixture.search)}&pageSize=12`, "GET /api/public/hospitals search", body => Array.isArray(body.documents) && body.documents.length > 0);
  read(`/api/public/hospitals?service=${encodeURIComponent(fixture.serviceName)}&pageSize=12`, "GET /api/public/hospitals filtered", body => Array.isArray(body.documents) && body.documents.length > 0);
  read(`/api/public/hospitals/${encodeURIComponent(fixture.hospitalId)}`, "GET /api/public/hospitals/[id]", body => Boolean(body.hospital));
  read(`/api/public/hospitals/${encodeURIComponent(fixture.hospitalId)}/services?pageSize=12`, "GET /api/public/hospitals/[id]/services", body => Array.isArray(body.documents) && body.documents.length > 0);
  sleep(2);
}
