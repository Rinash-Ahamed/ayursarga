# Isolated staging load tests

These tests are prepared, not a claim of measured capacity. k6 is a separate
tool; it is not an application dependency. Do not run against production.

## Isolation checklist — verify before acknowledging the guard

1. Use a dedicated staging deployment **and a separate Firebase project**,
   Auth users, Storage bucket and synthetic records. A Vercel preview that points
   at production Firebase is not isolated staging. Verify deployed environment
   values in the dashboard, not only this fixture file.
2. Use Razorpay Test keys and the matching Test webhook. Do not copy live keys.
3. Sandbox outbound email at the infrastructure/transport level. The current
   application uses Gmail; do not simply set the fixture flag while it can send
   real mail. A staging email sink needs a separately reviewed configuration.
4. Verify deployed rules/indexes, limits and backup policy. Align test time with
   Vercel Observability and Firestore Monitoring; record before/after read/write/
   delete counts and index-entry reads separately from HTTP request counts.
5. Copy `fixtures.example.json` into `.secrets/load-fixtures.json`, seed public
   hospitals/approved packages and update the fixture. Never commit tokens.
   Set `isolated`/`emailDeliverySandboxed` true only after the above checks.

The guard rejects Ayursarga production domains, the production Firebase project,
host mismatches and missing isolation acknowledgements. It cannot independently
prove which Firebase credentials a deployment uses; operator verification is
mandatory. Do not use spoofed forwarding headers to bypass abuse controls.

## Run public discovery, one level at a time (PowerShell)

```powershell
$env:RUN_ENV='staging'
$env:ALLOW_STAGING_LOAD='I_HAVE_VERIFIED_ISOLATION'
$env:BASE_URL='https://your-isolated-staging.example'
$env:STAGING_HOST='your-isolated-staging.example'
$env:STAGING_FIREBASE_PROJECT_ID='your-separate-staging-project'
$env:FIXTURE_FILE='../../.secrets/load-fixtures.json'
$env:VUS='10' # Run 10, then 50, 100, 500, 1000 after reviewing each result.
$env:DURATION_SECONDS='60'
k6 run --out json=test-results/load-10.json tests/load/public-discovery.js
```

Create `test-results` first. The fixture path is relative to the script, not
the shell. Each iteration tests list/search/package filter/details/packages and
waits two seconds. Fixed VUs are concurrent virtual users, not requests/second.
The run is capped to 180 seconds, disallows redirects, uses safe metric tags
without URLs, and aborts after sustained >1% HTTP failure. A single source IP
may intentionally hit application rate limits: report 429 separately, don't
disable protection to make results green. Check normal and abuse traffic apart.

Metrics include p50 (`med`), p95, p99, throughput, HTTP and workflow errors,
and handler `Server-Timing`. Thresholds (p95 2s/public, 3s/authenticated) are
initial acceptance targets, not achieved measurements or capacity promises.
Use the same dataset, deployment, region, injector size and duration for a
comparison; warm up separately and repeat three times per level. Watch injector
CPU too; a saturated k6 host invalidates server capacity conclusions.

## Authenticated workflows — separate runs and synthetic test users

Give every VU a separate completed Consumer Google test account and a fresh
Firebase **ID token**, not an OAuth access token. Tokens must be from the
staging project and have at least five minutes remaining. Users are never
created automatically by these scripts. No secrets go in reports.

```powershell
$env:RUN_ID='staging-load-20261106-run01' # unique for a new run
$env:WORKFLOW='slots'
k6 run --out json=test-results/slots-10.json tests/load/authenticated-bookings.js

# Money/order/booking-affecting tests need a second explicit acknowledgement:
$env:ALLOW_STAGING_MUTATIONS='SYNTHETIC_RECORDS_ONLY'
$env:WORKFLOW='center' # or consultation-hold, consultation-change
k6 run --out json=test-results/center-10.json tests/load/authenticated-bookings.js
```

Each account performs one workflow, not an endless create loop. Fixture user
fields depend on the workflow:

- `slots`: `token`, `consultantId`, `service`, `date` (ISO).
- `center`: `token`, `centerInput` containing `hospitalId`, `serviceId`,
  `preferredDate`, `bystanderCount: 1`, `consumerNotes` and the current
  `expectedPackageVersion`. Creates/retries the same request, verifies stable
  IDs/references, reads its own revision via Firestore REST and cancels it.
  No Search Center payment or rescheduling is introduced.
- `consultation-hold`: `token`, `consultationInput` with `consultantId`,
  `serviceId`, `preferredDate`, `preferredTimeSlot`, `appointmentStartTime`,
  `expectedSlotStartTime`, `expectedSlotEndTime`, `expectedCharge`,
  `expectedCancellationPolicyVersion`, `consumerNotes`. Use distinct free slots
  per VU. Creates/retries one **Test** order and attempts verified abandonment;
  this does not simulate capture, confirmation or a refund.
- `consultation-change`: `token`, owned distinct confirmed Test `bookingId`,
  `expectedAuditId`, `newDate`, `newTime`. Existing and destination times must
  be >24 hours away with an unused Consumer reschedule allowance. Reschedules
  once then cancels against the committed revision. Seed records through the
  normal Test checkout flow first; never fabricate paid records in production.

Complete captured-payment, webhook, failed/late capture, refund and inbox
delivery tests still require controlled provider Test-mode/browser testing.
Use the local unit concurrency tests for simultaneous same-slot denial; for a
staging contention run use a separately reviewed expected-409 scenario, not
the success-only benchmark. No automatic cleanup deletes historical records.

## Collect operations, resources and cost

In an approved short staging window enable server-only `API_METRICS_ENABLED=true`
to obtain sanitized status/stage timings and process CPU/memory snapshots.
Process CPU deltas overlap under concurrent requests and are **not** per-request
CPU attribution. Disable detailed metrics after the measurement window to limit
log volume. Vercel active CPU, peak memory, timeouts/cold starts and Firestore
Monitoring are authoritative for hosted resources and billed operations; k6
does not know Firestore SDK/internal transaction retry counts. Keep 429, 4xx,
5xx, conflicts and abandoned holds separate. Export only sanitized aggregates.

Record deployment ID, commit, run window, VUs, requests/s, p50/p95/p99, errors,
429s, CPU/memory, Firestore reads/writes/index reads and observed costs. Stop at
the first failed level; do not run 500/1000 VUs merely because scripts support it.
