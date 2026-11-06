export const LOAD_LEVELS = [10, 50, 100, 500, 1000];
export function validateStagingTarget(env, fixture) {
  if (env.RUN_ENV !== "staging" || env.ALLOW_STAGING_LOAD !== "I_HAVE_VERIFIED_ISOLATION") throw Error("Explicit isolated-staging approval is required.");
  // No remote JS imports or browser-only URL global required by the k6 runner.
  const match = /^https:\/\/([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::(\d{1,5}))?\/?$/.exec(env.BASE_URL ?? "");
  if (!match || match[1] !== env.STAGING_HOST || /(^|\.)ayursarga\.com$/i.test(match[1])) throw Error("An exact non-production HTTPS staging host is required.");
  const origin = `https://${match[1]}${match[2] ? `:${match[2]}` : ""}`;
  const projectId = env.STAGING_FIREBASE_PROJECT_ID;
  if (!projectId || projectId === "ayursarga-connect" || fixture.projectId !== projectId || fixture.baseUrl !== origin
    || fixture.isolated !== true || fixture.emailDeliverySandboxed !== true || fixture.razorpayMode !== "test") throw Error("Verify separate Firebase data, Test-mode Razorpay and sandboxed email before running.");
  const vus = Number(env.VUS ?? 10);
  if (!LOAD_LEVELS.includes(vus)) throw Error("VUS must be 10, 50, 100, 500 or 1000.");
  return { origin, projectId, vus };
}
