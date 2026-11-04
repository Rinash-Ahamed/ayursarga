# Ayursarga security review — 4 November 2026

Scope: current local application, Admin/Hospital/Consumer boundaries, all 44 API
route files, Firebase rules, payments, emails, uploads, public projections,
dependencies and selected read-only production HTTP headers. Fix release: 4.37.3.
This is a source/configuration review with local regression tests, not a
penetration-test certification or proof that deployed rules match local files.
No production records, payments, credentials, IAM settings or deployments changed.

## Confirmed gaps fixed locally

| Priority | Location | Finding and fix |
| --- | --- | --- |
| Medium | `services/api/rateLimit.ts` | Default fingerprints included caller-controlled User-Agent, permitting a new bucket by changing that header. Default fingerprints now remain stable for the same address/namespace. The limiter is still process-local; this is not a distributed rate-limit solution. |
| Medium | `services/api/server.ts` and 10 Admin route files | Raw provider error messages could enter hosting logs, including provider-supplied details. Shared logging now omits message/stack/payloads, bounds diagnostic name/code, and accepts only the opaque enquiry reference as context. Replaced remaining raw caught-error logs in Admin API routes. Existing generic failure responses and business operations remain unchanged. |
| Low | `app/api/admin/authenticator/route.ts` | The sole unbounded API JSON parser was on privileged MFA replacement. It now uses the shared 2,000-byte streaming cap and JSON content-type validation before factor mutation. Existing MFA/recent-auth/own-factor/audit/revocation checks remain intact. This was authenticated resource hardening, not an unauthenticated MFA bypass. |
| Hardening | `next.config.mjs` | Added baseline CSP: `object-src 'none'; base-uri 'self'; frame-ancestors 'none'`. This blocks plugin objects, foreign base URLs and framing without changing scripts/styles or rendering strategy. It is deliberately not a full script-injection policy. |

## Items requiring owner action or consideration

### High — previously shared credentials

A Firebase Admin private key and Gmail app password appeared earlier in the
conversation. Treat any unchanged copies as exposed. Rotate the service-account
key and Gmail app password, update local/hosting environments securely, deploy
and verify the replacements, then revoke the old credentials. Do not revoke the
old key first if that would leave the production application without credentials.
No secret values are included in this report. No evidence of exploitation was
established; absence of evidence does not make exposed credentials safe.

### Medium — cross-instance abuse limits

`allowRequest` uses an in-memory Map. Instance restarts, parallel Vercel instances
and bucket eviction prevent it from providing a durable/global quota. Public
discovery can consume database reads; resets can trigger Auth/SMTP work. Contact
and Ayu additionally fail closed on server-verified Turnstile tokens, hostname
and action. Decide on edge rate limiting or a shared durable limiter before
large-scale exposure. Review Vercel plan limits/pricing before enabling paid
features. Do not apply a browser challenge to Razorpay webhooks; preserve signed
provider callbacks. Trust forwarded address headers only behind the hosting
proxy that sanitizes them; the hash is not a verified user identity.

Reference: [Vercel WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

### Medium hardening — full script CSP

Read-only production GETs of `/`, `/admin/login` and `/hospital/login` returned
200 with HSTS, DENY framing, nosniff, referrer and permissions policies. No CSP
was present before this local change. Baseline CSP above does not restrict
script execution. A full policy needs staged reporting and real Google sign-in,
Turnstile, Razorpay checkout, maps and image checks. Nonce-based Next.js policies
can require dynamic rendering; avoid blindly changing the static public site's
performance. No aggressive policy was introduced without this testing.

Reference: [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy).

### Verification blocker — native rules tests and deployed parity

The available PATH Java is 8; installed firebase-tools requires Java 21 or newer.
No local Firestore emulator was running. Native emulator rules tests were not
executed; install/configure a supported JDK and run the existing isolated
`demo-ayursarga` suite. No runtime was installed automatically. Local rules were
reviewed, but current deployed Firebase rules/Storage rules, IAM privileges,
credential rotation and Vercel Firewall settings were not independently verified.
Do not claim these are production-cleared based on mocks or a health endpoint.

## Controls reviewed and retained

- Shared server authorization verifies Firebase ID tokens with revocation checks,
  reads active profiles, enforces roles and native Admin TOTP/cutoff proof.
  No security checks were cached or bypassed for performance.
- Protected portal pages retain matching RequireRole gates; sensitive access also
  depends on backend checks and rules, not those UI gates alone. Consumer Google,
  Hospital password and Admin password/TOTP flows remain separate in the shared
  auth system. Password resets have generic responses and server-owned URLs.
- Hospital mutation endpoints enforce assigned-centre access and eligibility;
  Consumer consultation/payment access is ownership-scoped. Finance/settlements,
  consultant management, contract approval and account controls require Admin.
- Public discovery uses whitelisted projections; no anonymous operational
  consultant/hospital/service document reads. Consultant contacts, private payment
  splits, settlement data, contracts and audit metadata stay out of public APIs.
- Local Firestore rules deny client access to payment intents/ledgers, slot days,
  webhook journals, email events and policies; consultant/service mutations are
  server-only. Storage rules deny direct browser reads/writes; public photos use
  individual download-token URLs. Operational deletion remains denied.
- Razorpay raw-body HMAC checks, server-owned orders/amounts/currency, capture
  verification, atomic webhook journaling, idempotency, financial review holds,
  manual settlement revision checks and private commission data remain intact.
- Slot transactions cover overlapping appointments, expiring holds, concurrent
  requests, cancellation and rescheduling. Consumer cancellation/reschedule
  eligibility is revalidated server-side against agreed snapshots.
- Upload routes check role/ownership, stream byte limits, actual decoded image
  formats/pixel limits and re-encode metadata-free WebP under generated paths.
  Old files remain preserved. Server fetch destinations are fixed provider APIs,
  not arbitrary user-controlled imports. Next image remote hosts stay bounded.
- React text escaping, escaped email/contract interpolation and sandboxed contract
  previews remain in place. API auth uses explicit bearer headers, not ambient
  cookies; no permissive credentialed API CORS policy was found. Public home HTML
  had wildcard CORS, but protected login HTML did not; public HTML alone is not
  an authenticated data-exposure finding.

## Executed checks and limits

- `npm audit --omit=dev --json` and `npm audit --json`: both reported zero known
  vulnerabilities. No dependency changes; audit results are advisory-database
  evidence, not a guarantee against undiscovered vulnerabilities.
- Read-only tracked-file credential-pattern scan: 504 text/source files, no
  matching private-key material/service-account objects/public secret-variable
  assignments; only `.env.example` was tracked among checked credential paths.
  This limited scan does not clear Git history, external copies or earlier chat
  exposure. Runtime source credential guards were also added to local tests.
- Focused tests cover denied roles/ownership, native MFA/recovery, malformed and
  oversized requests, Turnstile, private projections, verified payments/webhooks,
  concurrent slots, policy cutoffs, revisions/audits, uploads, package approval,
  invoices, notifications and the new hardening guards.
- Final focused run: **208/208 passed**, no skips (26 selected test files).
  `git diff --check` passed. Following explicit owner approval, fresh ESLint,
  standalone typecheck and production build all passed for 4.37.3 (85 static
  pages generated). The same build's temporary production server returned 200
  for deep health JSON (deep-configuration/ok, all six dependencies ready),
  themed /health?deep=true HTML and Admin/Hospital login HTML. Baseline CSP was
  present on all four responses. Health is configuration-only, not a live
  delivery/payment/database probe. The temporary server was stopped; generated
  tsbuildinfo removed and the pre-existing next-env.d.ts import preserved.
- Initial runs identified fixture gaps (new logger missing in mocks, a health
  test assuming a synchronous handler) and a sandbox-blocked Git subprocess.
  Corrected the fixtures; application-source scanning no longer spawns Git.
- No live exploit attempts, authenticated production mutations, emails, payment
  attempts or destructive tests. Native rules engine, physical devices and full
  third-party checkout/login interactions are not established by local fixtures.

