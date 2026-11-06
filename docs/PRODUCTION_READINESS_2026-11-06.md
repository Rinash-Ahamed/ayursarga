# Ayursarga production-readiness audit — 6 November 2026

Release under review: **4.41.1**, including the preceding uncommitted
consultant-first workflow changes. No deployment, live authenticated mutation,
email send, payment, refund, destructive operation or production load test was
performed. This is an engineering review and local regression exercise, not a
penetration-test certification or a measured capacity guarantee.

## Launch decision

**Not yet cleared for an unrestricted/high-traffic launch.** The current Next.js
API/Firebase architecture does not require a separate backend or larger CPU
merely because bookings grow. Keep this architecture, address the open gates
below, and measure the isolated staging workloads before making infrastructure
changes. No evidence from this audit establishes 500/1,000-user capacity.

Required gates:

1. Confirm rotation/revocation of the Firebase Admin private key and Gmail app
   password previously shared in conversation. No credential values are in this
   report. If those copies remain usable, treat this as a High security issue.
2. Enable and verify an approved recovery plan: read-only metadata confirms no
   scheduled Firestore backups, PITR disabled and database deletion protection
   disabled. No recovery settings were changed by this audit.
3. Run native rules/concurrency tests with a supported JDK. Deployed rules match
   local source and all 33 required composite indexes are READY; metadata parity
   does not prove runtime role isolation under the native rules engine.
4. Provide isolated staging Firebase/Auth/Storage, Razorpay Test configuration,
   synthetic users and sandboxed email; execute load tests progressively.
5. Complete real Test checkout/capture/webhook/refund and email-delivery checks,
   verify backups/restore and monitoring ownership before opening paid scale.

## Architecture and request boundaries

- Next.js 16.2.11 App Router, React 19, TypeScript, Node 24, Firebase Auth,
  Firestore, Admin Storage, Razorpay, Gmail SMTP and Turnstile. Browser tests use
  Playwright; local API/transaction fixtures use Node's test runner.
- `/`, `/centers` and discovery are separate from protected `/app`, `/hospital`
  and `/admin` modules. The home page and informational pages remain static;
  search/detail pages use dynamic URL input. Build generated 86 static pages.
- Inventoried **46 API route files**. All exported methods use shared request-
  local timing. Operational endpoints use verified bearer-token guards and
  resource checks; public discovery uses whitelists. Health/configuration GETs
  are not permission or database probes. The webhook instead uses raw HMAC.
- `vercel.json` pins execution to `bom1`; read-only Firestore metadata confirmed
  `asia-south1` and Native mode. Vercel CLI confirmed Next.js/Node 24. Firebase
  CLI authentication expired; the existing application service account could
  read the metadata without changing permissions. No infrastructure changed.
- Auth, Firestore, Razorpay and SMTP are external dependencies/single-service
  failure domains. Moving the same calls into another backend would not remove
  those dependencies. Retain payment review/uncertainty handling during outages.

## Ranked findings and disposition

No new confirmed Critical exploit was established by the checks executed.
Unverified permissions/provider behavior must not be interpreted as cleared.

| Priority | Evidence / location | Finding | Disposition |
| --- | --- | --- | --- |
| High, conditional security | Prior credential exposure; `services/firebase/admin.ts`, `services/email/emailService.ts` | Earlier shared server credentials remain a risk until rotation/revocation is confirmed. Source scans cannot clear external copies or Git history. | Owner action; do not revoke a working key before safely installing/verifying its replacement. |
| High, confirmed recovery gap | Read-only database metadata and backupSchedules API | No scheduled Firestore backups; PITR and database deletion protection are disabled. Accidental privileged deletion or corruption has no verified recovery path. | Owner configuration and restore rehearsal required. No paid setting or protection was changed automatically. |
| High, upload mismatch — fixed locally | `services/consultants/consultantService.ts`, `utils/prepareImageUpload.ts` | Portraits previously posted original files up to 8 MB, above Vercel's 4.5 MB request cap. Gallery uploads already resized to at most 3 MB; the original broad gallery finding was narrowed after tracing its caller. | Owner approved automatic resizing. Shared browser preparation now covers portraits and galleries, preserves aspect ratio, caps the longest edge at 1600 px without upscaling, and rejects output above 3 MB. Server validation/re-encoding remains unchanged. [Vercel limits](https://vercel.com/docs/functions/limitations). |
| High, verification gate | `tests/emulator/*`, staging suite | Native security rules and 10–1,000 VU staging capacity are not verified. Java on PATH is 8; no k6 executable or isolated staging was supplied. | Configure JDK 21+ / supported Firebase tooling and isolated staging; do not benchmark production. |
| Medium, privacy — fixed locally | `services/hospitals/publicProjection.ts` | Public centre detail JSON included the owner's WhatsApp `phone`, unused by public screens. | Removed only that field; official hospital email and primary/secondary hospital phones remain. No data rewritten. |
| Medium, validation — fixed locally | `app/api/hospital/availability/route.ts` | Hospital block requests accepted impossible ISO-shaped dates that JavaScript normalizes. Admin's equivalent validation was already strict. | Shared strict calendar parser now rejects impossible dates and retains IST midnight/valid leap dates. |
| Medium, boundedness — fixed locally | Hospital availability route and `services/hospitals/availabilityAdmin.ts` | Two notification-recipient queries were unbounded and could grow batch fan-out. | Bounded to 101 Admin / 21 Hospital candidate profiles; >100 / >20 fails before writes instead of silently dropping recipients. |
| Medium, transfer efficiency — fixed locally | `app/api/public/hospitals/route.ts` | Directory reads fetched complete operational hospital/package documents before discarding contract/draft/audit fields. | Database projections now fetch 12 card/eligibility fields and 3 package-publication/link fields. Same public response, pagination and publication checks. This does **not** reduce billed document-read counts. |
| Medium, index fan-out — local configuration prepared | `firestore.indexes.json` | Audit snapshots/device maps are large, repeated and not queried by their nested fields. Automatic indexing adds unnecessary fan-out. | Added index exemptions for `auditLogs.previousValues`, `updatedValues`, `device`; retained all top-level query indexes and history. Not deployed. |
| Medium, cross-instance abuse | `services/api/rateLimit.ts` | In-memory buckets reset on restart and differ by instance; public reads and resets lack a global quota. Forwarded-IP trust depends on the hosting proxy. | Retained limits/Turnstile; choose edge or durable shared quotas after plan/cost review. Never challenge signed Razorpay callbacks. |
| Medium, mail reliability | `services/email/emailService.ts`, `bookingEmailService.ts`, `consultationEmailService.ts` | Gmail has two pooled connections per instance. Consultation events are durable but `after()` is not a durable scheduled worker. Search Center confirmation uses deferred SMTP without the durable event journal; cancellation uses a journal. Process loss can strand delivery. | Booking commits remain independent of SMTP. Plan monitored pending-event recovery and bring centre confirmations into the same journal separately. Never blindly retry `sending`/`unknown`/ambiguous SMTP. No new provider/worker was introduced. |
| Medium, load-dependent bottleneck | `services/consultations/slotReservationsAdmin.ts` | Per-consultant/day document intentionally serializes overlaps. Every check also performs two legacy date queries, each with a 201-result overflow guard. | Correctness retained. Measure contention/read amplification before any audited migration removes legacy checks. Never shard away overlap protection casually. |
| Medium, financial query cost | `app/api/admin/consultant-finance/route.ts` | Seven independent reads/aggregates execute per Finance refresh. Aggregations avoid payload scans but still consume index work. | Already parallel; do not cache financial balances blindly. Measure aggregate cost before proposing transactionally maintained summaries. |
| Medium, discovery at larger catalogue sizes | `components/PublicHospitalSearch.tsx`, public list route | Main directory text filtering searches the currently loaded pages; users may need Load more to reach later matches. Comparison prefix search is capped and case-sensitive variants are not a full search index. | Preserve current behavior; design indexed normalized search/pagination as a separate product/data change if catalogue growth justifies it. |
| Medium, measured bundle weight | Production browser probe | Loaded JS gzip was about 263 kB for Search Center and 486 kB for the anonymous consultant booking shell during the observation window. Auth/SDK and portal dependencies matter, not only images. | Future targeted split/lazy-loading candidate; no speculative architecture rewrite. Public discovery import-graph regression still excludes Firestore runtime imports. |
| Low, headers — fixed locally | `next.config.mjs` | Dynamic HTML exposed framework branding. | `poweredByHeader: false`; baseline CSP and integration behavior preserved. Full script CSP remains a staged hardening task. |
| Low, test/document drift — fixed locally | Unit/browser tests; foundation docs | Tests still expected a bare consultant ID, synchronous health handler, old audit wording and date-first guidance selection. Several old foundation documents described features as deferred that are now implemented. | Corrected test contracts without suppressing checks/forcing clicks; marked historical docs and linked this report/current guardrails. |

### Additional operational considerations

- Slot-day documents are intentionally distributed by provider/date, not a
  single platform booking lock. Sequential consultant creation/invoice counters
  are small Admin-write hotspots, not every-consumer payment counters. Benchmark
  before replacing identifiers/counters.
- Notification listeners are a genuine realtime requirement: one own-inbox
  document plus a latest-20 bounded query with unsubscribe/generation guards.
  They are not whole-collection listeners. The badge/panel covers recent items,
  not a complete paginated historical inbox; plan explicit history/count semantics
  if operational notification volume grows. Do not add unbounded listeners.
- Each selected consultant/date quietly refreshes slots every 45 seconds while
  visible. **Planning estimate only:** 1,000 simultaneously active selections
  imply roughly 22 periodic slot requests/s, before focus/user actions. This is
  not a measured capacity or billed-operation count. No blanket polling increase.
- Existing uploaded images use metadata-free WebP and 480/800/1200 responsive
  variants with immutable URLs. Search loads near-viewport covers, not all
  gallery photos. Off-screen loading, decode deduplication and original-image
  fallback tests passed. Old files are intentionally preserved; monitor storage
  growth rather than introducing unauthorized TTL/deletion.
- Browser photo preparation accepts the existing 15 MB gallery / 8 MB portrait
  source limits, checks decoded dimensions, releases object URLs/canvas memory,
  and sends the actual encoded MIME type (including Safari's PNG fallback).
  Oversized/unreadable output fails before an API call. Two browser-engine tests
  verified noisy source PNGs above 4.5 MB become requests below 3 MB, small images
  retain dimensions, and corrupt files fail. Real physical-device memory limits
  and visual quality still require device checks.
- A 7.65 MB local hero video and some multi-megabyte source images still exist.
  Source size is not proof they all download on every route: Next optimization,
  responsive variants, visibility and media playback affect transferred bytes.
- Google Fonts is another external initial-render dependency. Consider licensed
  self-hosting only after measuring the real font waterfall; local lab blocked
  external origins, so it does not measure Google latency or real font swaps.
- If Admin credentials are shared across people, the same UID cannot establish
  which person acted. Individual controlled Admin accounts improve attribution,
  but changing provisioning/reset policy requires a deliberate product decision.

## Security and booking controls verified locally

- Shared guard verifies ID tokens with revocation, reads active profiles, derives
  roles on the server and requires native Admin TOTP/cutoff proof. No auth cache
  or validation bypass was added for performance. Profile/route UI is not the
  sole security boundary.
- Source/rule/fixture checks cover own-Consumer access, assigned-Hospital access,
  denied inactive/wrong roles, private consultant records, commission privacy,
  server-only payments/refunds/slots/email events and denied client deletion.
  Native rules-engine/deployed-role isolation is still unverified here.
- Centre booking creation checks current public/active centre, approved package
  revision, pricing, consent and block dates in its transaction. Stable request
  IDs preserve booking/reference identity on concurrent or lost-response retries.
  Search Center remains immediately confirmed without hospital approval and has
  no new payment/rescheduling/refund flow.
- Consultant booking checks explicit assignment, charge, service duration,
  configured days/dates, generated slot, overlap/hold, policy version and
  consent. Tests cover final exact-end slots, mixed 30/60-minute overlaps,
  simultaneous Consumers, hold expiry, cancellation/release and rescheduling.
- Razorpay confirms only backend-verified matching captured INR payments. Tests
  cover signed raw webhooks, duplicate/mismatched callbacks, late/unbookable
  captures, financial review, immutable refund idempotency keys and unknown
  outcomes. Private commission/base payable/settlements are not returned through
  consultation Consumer APIs; admin financial mutations remain revision-checked.
- Consultation emails queue atomically after booking change, claim independently
  per recipient and check the current booking revision/status before sending.
  Obsolete events are superseded. Email failures do not roll back confirmations.
  Mocked SMTP acceptance is not real inbox-delivery proof.
- Uploads enforce role/centre ownership, streamed byte caps, actual format/pixel
  limits, server re-encoding, generated paths and revision-checked audits.
  Direct browser Storage access remains denied. The platform payload mismatch
  above is distinct from these controls.
- Tracked-text scan inspected 520 files: only `.env.example` was tracked among
  environment files. Two key-marker hits were reviewed as placeholders in the
  example/docs, not real key material. Source security guards passed. This is
  not a Git-history scan or proof earlier exposed credentials were rotated.
- Read-only production HEADs for `/` and `/admin/login` returned 200 with HSTS,
  baseline CSP, nosniff, DENY framing, referrer and permissions policies. Login
  HTML still exposed X-Powered-By in the deployed build; local fix is not deployed.
  Baseline CSP does not restrict script sources; test Google/Turnstile/checkout/
  maps before introducing a stronger report-only policy.

## Monitoring additions and findings

`withApiTiming` retains `Server-Timing` and fixed-route slow logs. It now logs
sanitized 5xx outcomes and escaped handler failures, without raw error messages,
tokens, URLs, IDs, payloads or contacts. Optional server-only
`API_METRICS_ENABLED=true` adds total/selective stage timings and numeric process
CPU/RSS/heap snapshots. Default is off to control cost. CPU deltas and memory
are process-wide; concurrent requests overlap. These are not per-request CPU
attribution, billed Firestore counts, durable error retention or an alert service.

Vercel project configuration and a bounded last-hour production log query were
read successfully. That query returned only **two 200 requests**, no error
levels or runtime timing/resource fields. It cannot establish production error
rate, peak concurrency, CPU throttling, cold-start frequency, timeout rate,
memory headroom or usage costs. Those dashboard metrics remain unverified.

Monitor: public 5xx/429/p95, auth denials, transaction contention/retries,
captured-but-unbookable payments, pending/unknown refund locks, old pending/
sending email events, webhook failures, notification delivery failures and
upload 413s. Alert destinations and retention ownership must be configured by
the operator. [Vercel Observability](https://vercel.com/docs/observability),
[runtime logs](https://vercel.com/docs/logs/runtime).

## Measurements — not a capacity benchmark

The reproducible script is `scripts/profile-production-readiness.mjs`. Each
phase measured six routes at 390/1440 px, three cold browser contexts each
(36 samples/phase). Local production build, software-rendered unthrottled
Chromium, external origins blocked, synthetic directory data, anonymous
protected shells. Other validation processes shared the host; timing changes
must **not** be attributed to code optimizations. Raw generated results are in
ignored `test-results/readiness/baseline.json` and `after.json`.

| Route / viewport | Median LCP before → after | JS gzip before → after | CLS before → after |
| --- | --- | --- | --- |
| Home / 390 | 1,016 → 432 ms | 270,018 → 270,018 B | .004406 → .004406 |
| Search Center / 390 | 1,312 → 700 ms | 262,597 → 262,597 B | .004406 → .004406 |
| Online consultation discovery / 390 | 724 → 572 ms | 245,212 → 245,212 B | .004406 → .004406 |
| Consultant booking anonymous shell / 390 | 1,264 → 1,376 ms | 485,695 → 485,695 B | 0 → 0 |
| Search Center / 1440 | 764 → 1,608 ms | 262,597 → 262,597 B | .000699 → .000699 |

Both phases had zero observed runtime errors/viewport overflow in their sample
windows. The mixed increases/decreases, unchanged bundles and shared-host load
do not support a frontend speedup/regression claim. This is not Lighthouse,
field INP, signed-in performance or real-device performance.

Separate controlled Search tests on the preceding audit build measured the
following (before the final portrait-upload helper, which does not change Search):

- Injected 250 ms image latency: first cover visible in **353 ms at 390 px** and
  **343 ms at 1440 px**; six covers requested, zero non-cover gallery downloads.
- Four-times CPU-throttled search run: results ready 1,833 ms; median scripted
  input interaction 191 ms; CLS .001043; one API request; zero detail prefetches;
  12 total image requests after scrolling; frame p95 33 ms. Software-rendered
  lab figures, not a promise of device frame rate or production latency.
- A short local public/API probe logged a 129 ms list handler, 146 ms centre
  detail, 96 ms packages and 567 ms consultant list; selective database stage
  for that consultant request was 560 ms. These are single samples, not p95.
  Startup/library loading and network conditions matter. No measured CPU
  saturation/OOM evidence justifies a CPU upgrade.

Deterministic improvements: recipient reads now have explicit upper bounds,
directory field masks omit operational payloads, invalid dates stop before
writes, owner WhatsApp is absent from public detail JSON, and framework branding
is removed from local HTML. No percentage cost/latency improvement is claimed.

## Reproducible load testing

See `tests/load/README.md`, `public-discovery.js`,
`authenticated-bookings.js`, `guard.mjs` and `fixtures.example.json`.

Prepared levels: **10, 50, 100, 500 and 1,000 VUs**, one separately reviewed
run at a time. Public listing/search/filter/detail/package traffic is separate
from authenticated slots, centre create/retry/cancel, consultation Test-order
hold/retry/abandon and seeded consultation reschedule/cancel workflows.

The harness checks an exact non-production HTTPS host, a non-production Firebase
project, sandbox acknowledgements, fresh per-VU staging tokens and explicit
mutation permission. These are safeguards, **not server attestation**: the
operator must inspect the deployed staging environment. No fixture can prove
that the server isn't secretly connected to production Firebase.

The owner confirmed there is currently only production, not isolated staging.
No load test was run there. Syntax and guard regressions passed.
**k6 itself was not installed/executed**;
all 10–1,000 VU p50/p95/p99, throughput, failure and cost results remain unmeasured.
The harness exports latency/errors and Server-Timing. Obtain actual Firestore
operations/index reads and Vercel CPU/memory from platform monitoring; do not
equate HTTP requests with database reads. Full real payment capture/webhooks/
refunds and delivery still need controlled provider Test-mode verification.
[k6 metrics](https://grafana.com/docs/k6/latest/using-k6/metrics/),
[k6 options](https://grafana.com/docs/k6/latest/using-k6/k6-options/reference/).

## Executed validation and remaining limits

- Earlier full local unit/security suite: **429/429 passed**; after the owner-phone
  projection fix, **21/21 affected tests passed**, including its new regression.
  Final full rerun after photo preparation: **432/433 passed**. The sole failure
  was a Node-only photo service fixture still expecting raw bytes and invoking
  browser decoding without a browser. Updated that fixture to inject preparation
  and assert prepared MIME/body plus revision protection; its **3/3 tests passed**
  on rerun. Thus all **433 distinct cases passed across the final runs**, not a
  claim of one clean 433-test invocation. No live payment/email dependencies.
- Desktop portal file: initial 74/76 passed; two stale test contracts corrected
  (consultant-first selection order, current security wording); both reruns passed.
  All 76 distinct desktop cases now pass across the runs; no forced clicks.
- Representative narrow phone/tablet/mobile WebKit portal flows: **48/48 passed**.
- Search/details, phone/tablet/desktop/mobile WebKit: **44/44 passed**.
- Shared confirmation suite: **11 passed, one desktop-only touch test skipped**
  by its existing touch-device condition. Toast lifecycle suite: **16/16 passed**.
- Controlled production Search performance suite: **3/3 passed**.
- Photo preparation: all three new cases passed both initially and in the full
  rerun, including real Chromium/WebKit large-file encoding and the upload
  service's MIME/revision contract.
- Production dependency audit: **zero known vulnerabilities**, no dependency
  upgrades. Registry advisory results do not guarantee absence of vulnerabilities.
- Final production build, ESLint (no warnings after naming the k6 entry
  functions), standalone typecheck and diff whitespace validation passed.
  The final build includes the owner-phone privacy and photo preparation fixes.
- Same-build HTTP smoke suite: **5/5 passed**, including configuration JSON/themed health, missing/invalid
  token denials and real bounded read-only public queries. First sandbox attempt
  failed via blocked outbound proxy; rerunning with authorized outbound access
  passed. No authentication checks were bypassed to make the tests pass.
- Firebase CLI metadata reads failed with expired authentication. Subsequent
  read-only REST checks using the existing application service account verified
  deployed Firestore rules match local source, all 33 local composite indexes
  match deployed READY indexes, and region is asia-south1. Native emulator suites
  were not run because Java 8 is unsupported by installed tooling. IAM, actual
  provider delivery, restore success and concurrent production-role access remain
  unverified. The three newly prepared field-index exemptions remain undeployed.
- No physical iOS/Android devices, full axe/screen-reader audit, Lighthouse score,
  authenticated live browser workflow, heavy load or actual provider money move
  was tested. Local fixture tests do not replace those checks.

## Cost, recovery and release operations

1. Configure Cloud Billing/Vercel alerts with an owner/on-call destination and
   review actual usage by service/region. Alerts-only budgets do not cap charges;
   do not assume a general Firestore kill switch exists. Never automatically
   disable payment callbacks on a billing alert. [Cloud Billing budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets).
2. Review edge abuse protection for public reads/reset/contact, plus per-user
   endpoint limits. Preserve legitimate NAT/shared-IP users and provider webhooks.
3. Firestore currently has no scheduled backups, PITR or deletion protection.
   Review enabling these protections with the owner, including their costs.
   Verify Storage/version retention policies,
   IAM/service-account least privilege, and a tested restore to a **different**
   database/project. Do not delete historical records/files or introduce TTL.
   [Firestore PITR](https://firebase.google.com/docs/firestore/use-pitr),
   [Firestore best practices](https://firebase.google.com/docs/firestore/best-practices).
4. Keep a tested previous Vercel deployment and commit. Application rollback is
   not a financial-data rollback: never restore stale bookings/refunds over newly
   captured Razorpay payments. Reconcile journals/provider records before any
   data recovery. Preserve immutable request/refund keys and audit history.
5. Review the three new audit-map index exemptions and deploy only with explicit
   owner authorization. No Firestore rule changes are needed for these local
   fixes, and no rules/index/application deployment was performed in this audit.
6. After clearing the launch gates, run a monitored small rollout, then increase
   traffic based on measured staging/production p95/errors/cost—not visitor
   counts, an assumed CPU tier, or the fact the build passed.
