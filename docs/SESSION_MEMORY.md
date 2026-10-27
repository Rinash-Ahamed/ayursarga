# Session handoff

Updated: 27 October 2026 (Asia/Calcutta).

## Owner-requested build and lint validation (27 October 2026)

- On v4.19.2, npm run lint passed without warnings/errors. npm run build passed:
  optimized compilation, Next TypeScript validation and all 71 static pages.
  No implementation or dependency changes, version bump or deployment.
- Started this newly built production application on temporary localhost port
  3197. /api/health?deep=true with Accept: application/json returned HTTP 200,
  status ok, mode deep-configuration; firebase-admin, contact-email, auth-email,
  firebase-client and hospital-images all reported ready. /health?deep=true
  returned HTTP 200 with the themed card, expanded checks, success heading and
  stylesheet links present. Stopped the temporary server afterward.
- These checks verify configuration and server-rendered health HTML, not SMTP
  delivery, database connectivity, deployed permissions, all APIs or live booking
  workflows. No emails, record reads/mutations or Firebase deployment performed.

## Booking placement date and time (27 October 2026)

- v4.19.2 fixes date-only formatting that hid the saved booking creation time.
  Shared formatBookingPlacedAt uses utils/date.ts to display DD/MM/YYYY and
  12-hour time with explicit IST. Both flows use the same formatter: hospital
  package cards in Consumer/Admin/Hospital and online consultation cards in
  Consumer/Admin. Appointment schedules and care dates remain separate.
- Both creation endpoints already store createdAt in their audited transaction;
  existing authenticated reads preserve Timestamp values. No new persisted field,
  API call, permission, rules change, migration or appointment time is introduced.
  Missing timestamps show Not recorded; legacy date-only strings retain their
  date with time not recorded, never an invented midnight or device-local time.
- Focused checks passed: 12/12 booking-date/date-format unit contracts (including
  UTC-midnight boundaries, four device timezones, Timestamp/ISO inputs, legacy
  values and unchanged API date serialization); 3/3 hospital-booking browser cases
  covering all three roles; 3/3 online-consultation browser cases covering Admin
  and Consumer, rescheduling and role controls. Browser projects covered desktop,
  narrow phone and WebKit phone with local fixtures, not real devices/live data.
  git diff --check passed. Build, lint, typecheck, broad API checks, deployment and
  live mutations were not requested or performed.

## Ayu visibility and deferred dialog (27 October 2026)

- v4.19.1 removes the guide action-link arrow and underline without changing
  destinations or other legal/email link styling. Public-design and web-quality
  skills kept the existing layout and accessible focus indicators intact.
- AYU_ONLINE=true enables Ayu; false, missing or any other value hides it.
  next.config.mjs exposes only the compiled public boolean, shared by SSR/client.
  The local flag is true and .env.example documents it. Restart local dev after
  changes; hosting needs the flag configured and a rebuild/redeploy. No deployment
  was performed. This is not a runtime toggle or Firestore setting.
- The whole dialog, ModalLayer, guide, phone control and email transport now load
  on first open, rather than importing the modal shell in the initial view. Only
  the small launcher and existing 16,524-byte WebP are needed while enabled/idle.
  Disabled Ayu renders nothing and requests no mascot or dialog. No idle API
  polling, preload of the panel or background listeners were added. A chunk error
  is isolated with a dismissible contact fallback, leaving the site usable.
- Focused local checks: 8/8 unit/API-contract tests, 35/35 Ayu browser cases over
  seven Chromium/WebKit viewport projects, 1/1 navigation hydration check and
  3/3 Consumer booking integration cases and 3/3 Admin/Hospital role integration
  cases passed. These include arrow/underline
  removal, the disabled flag, deferred loader invocation, chunk failure isolation,
  scroll/focus restoration, form errors and duplicate-submit protection. Fixtures
  use mocked transport, not real email delivery or deployed API validation.
- No production build, lint, typecheck, deployment or production performance
  benchmark was requested/run. Deferred loading reduces initial work, but no
  claim of zero bundle overhead or measured production timing improvement.

## Ayu consumer guide (27 October 2026)

- v4.19.0 adds Ayu with the owner's tagline, Your little buddy for natural
  wellness. Used the public-design skill to preserve the current site layout,
  palette, typography and other controls. The supplied public/Ayu.png remains
  unchanged; a transparent 256x252 WebP display derivative is 16,524 bytes versus
  the 1,130,732-byte original. No new image generation, paid service or dependency.
- A compact Ask Ayu launcher appears through public Nav and standard Consumer
  PortalShell only, not Hospital/Admin interfaces or the focused profile-completion
  layout. It does not auto-open or play sounds. The larger guide/form panel is
  dynamically imported only when opened. Body-level ModalLayer handles viewport,
  focus containment and reference-counted scroll locking; the launcher explicitly
  focuses before opening to fix Safari's pointer-button focus-return behavior.
- This is a curated website guide, not a generative AI/live agent/medical adviser.
  Six bounded topics cover Ayursarga, search/comparison, hospital booking, online
  consultations, booking history and policies, with existing route links and no
  speculative pricing, clinical advice or access to private booking/profile data.
- Questions use the existing /api/contact route and SMTP transport. Required name,
  email, 10-digit phone and question are entered explicitly; no medical reports,
  chat transcript, stored wellness profile or authenticated PII is auto-attached.
  Ayu identifies its source using the existing guidanceProfile field. Destination
  remains server-configured CONTACT_TO_EMAIL/default info@ayursarga.com; reply-to
  uses validated visitor email. No new API, persisted fields, rules or Auth roles.
- Shared contactClient transport is reused by the existing Contact form: explicit
  JSON ok acknowledgement, 20-second timeout, no automatic retries, and uncertain
  delivery feedback. Both forms guard immediate duplicate submission. Ayu keeps
  user input on failure, blocks closing/other topic changes during submission,
  shows success only after API acknowledgement and clears panel state on close.
  Existing Contact page appearance/fields are preserved. Contact email copy now
  accurately describes a general enquiry rather than inventing a consultation.
- Six focused local API/transport/asset tests passed: real contact validation,
  whitelist and configured recipient, HTML escaping, honeypot/rate limits,
  malformed/oversized input, unavailable/failed SMTP, acknowledgement and no-retry
  behavior. All email transport is mocked, never live delivery.
- 28 distinct browser cases passed: 21 Ayu guidance/form tests over all seven
  phone/landscape/tablet/desktop Chromium/WebKit projects; 3 Consumer booking
  integration cases; 3 Admin/Hospital absence/detail cases; 1 public-nav hydration
  regression. Tested scroll/focus restoration, viewport bounds, repeated open/
  close, 16px controls, duplicate submits, busy Escape protection, errors/retries
  and no stale success after reopening. Inspected the narrow-screen screenshot.
  Added a shared faithful lazy-component fixture for next/dynamic and the
  npm run test:e2e:ayu command. No build, lint, live emails, mutations or deployment
  was performed for this implementation; real-device checks remain unverified.

## Future scalability upgrades: recorded plan (27 October 2026)

- Owner requested this plan be saved for future upgrades, not implemented now.
  Keep Next.js API routes plus Firebase as the existing backend. Do not rewrite
  into a separate backend merely because bookings increase; extract workloads
  only when measured demand or independent operational requirements justify it.
- First establish isolated, synthetic booking load tests: simultaneous hospital
  and consultation bookings, duplicate submissions, retries/lost responses,
  cancellations and concurrent changes. Verify response-time percentiles,
  throughput, failures, transaction contention, duplicate prevention, audit/data
  consistency and notification behavior. Do not run load tests against production
  or claim a safe concurrent-user/booking capacity without measured evidence.
- Next evaluate durable notification processing, especially hospital booking
  emails currently sent best-effort after the response. Reuse audited event/outbox
  conventions from consultation emails. Queue only after a committed booking,
  keep consumer/consultant outcomes independent, suppress stale events, and never
  blindly resend after uncertain SMTP acceptance. Durable worker/queue selection
  and deployment need separate approval; no Cloud Functions, paid integration,
  automatic retry policy or new infrastructure is authorized by this note.
- Replace process-local in-memory rate limits with shared enforcement before
  relying on limits across multiple server instances. Review trusted-proxy/IP
  handling and privacy; retain server-side role/ownership validation and existing
  idempotency. Choose any shared backing service with explicit cost approval.
- Verify actual application-host API region versus Firestore, runtime/instance
  limits, bounded indexed queries, latency/error monitoring and billing alerts.
  Optimize measured bottlenecks while preserving data and existing workflows.
  Firebase rule deployments do not deploy the Next.js application/API code.
- Capacity enforcement is a separate product decision: current booking checks
  validate hospital/package eligibility and approved blocked dates, not room
  inventory reservations. If confirmation must guarantee a room, obtain owner
  approval before implementing atomic capacity reservations, overlap rules and
  cancellation releases. Never silently introduce this behavior or claim the
  existing system prevents inventory overbooking.
- Owner explicitly chose dependency-security remediation as a separate
  release-blocking task, rather than mixing upgrades into the earlier audit.
  Complete compatible upgrades and their focused regression/build/security
  validation before release; the prior findings were not fixed by image or UI
  improvements. Existing emulator/live coverage limitations remain documented.
- Suggested sequence: isolated booking load-test baseline -> measured fixes ->
  durable notifications/shared rate limiting -> repeat load/regression checks.
  No code changes, dependency upgrades, tests, deployments or live mutations were
  authorized or executed by this memory-only task; app version stays 4.18.5.

## Treatment progress timeline (27 October 2026)

- v4.18.5 fixes the mismatch between Hospital's Start/Complete workflow and the
  Consumer's old started/ongoing/completed timeline. Shared display mapping now
  shows Yet to be started -> Ongoing -> Completed. Stored started and legacy
  ongoing both highlight Ongoing; not_started highlights the first stage;
  completed booking/treatment status highlights Completed. No data migration.
- Consumer treatment text and Admin/Hospital summary detail use the same mapping.
  Hospital action badges remain Treatment Started/Treatment completed; no Mark
  ongoing or Hospital Reschedule action was restored. Internal treatment statuses,
  server transitions, ownership checks, audits and Firestore rules are unchanged.
- Timeline marks its current step accessibly, has one active dot, and keeps three
  equal-width columns with top-aligned dots when the longer first label wraps on
  narrow screens. This is a display fix, not a new realtime subscription; consumers
  still see updates when their existing booking loader retrieves current data.
- 14 focused unit/API-fixture checks passed, including mapping, legacy fallback,
  actual Hospital route transition/role/ownership checks and audited completion.
  All 14 distinct auto-confirmation and cross-portal treatment browser cases
  passed over seven phone/landscape/tablet/desktop Chromium/WebKit projects.
  Seven additional reruns passed with the final dot-alignment assertion. The
  browser fixture now preserves the mocked start/completion between portal views.
  Updated an old auto-confirmation test to expect Booked on instead of the date
  label removed in v4.18.4. No build, lint, live mutations or deployment was run.

## Booking placement dates versus care schedules (27 October 2026)

- v4.18.4 fixes the screenshot's duplicate hospital-booking date: Consumer,
  Hospital and Admin summaries now show Booked on from createdAt, never from
  confirmedDate or confirmedAt. Shared bookingDateFacts uses DD/MM/YYYY and
  India-day formatting. Missing legacy creation dates show Not recorded.
- The existing requested care dates remain visible. Duplicate auto-confirmed
  care dates are omitted; different care schedules, explicit appointment times
  and historical reschedule proposals remain as Scheduled care date or Proposed
  care date. Appointment/treatment statuses and booking actions are unchanged.
- Consumer/Admin online consultation history also shows Booked on separately
  from Scheduled appointment (the actual consultation date/time). Consumer help
  wording distinguishes placement from care dates. Reviewed email schedule
  sources; they correctly use appointment dates and were not changed.
- 10 focused date/details unit/API-fixture checks and 9 browser cases passed
  across desktop Chromium, mobile Chromium and mobile WebKit. Covered India
  midnight boundaries, Firestore timestamps, missing creation dates, preserved
  legacy/proposed schedules, role-facing summaries and consultation rescheduling.
  No persisted fields, database records, APIs, rules or email logic were changed;
  no build, lint, live mutations or deployment were run for this UI-only request.

## Online consultation cancellation wording (27 October 2026)

- v4.18.3 replaces only the Cancellation & Refund Policy's old Online
  Consultation Cancellation heading/paragraph with the owner's new heading and
  three exact paragraphs: 100% refund at least 48 hours before consultation;
  no refund inside 48 hours except approved exceptional circumstances or legal
  requirements; eligible refunds through the original payment method. Other
  policy sections, metadata, documents and page styling are unchanged.
- BOOKING_TERMS_VERSION advances to 2026-10-27 so new server-created hospital
  and online consultation booking consents identify the updated combined terms.
  Profile-completion Privacy/Customer Terms versions remain unchanged. Existing
  records are not migrated. Both creation routes already snapshot this shared
  constant; client writes remain denied and rules retain existing consent
  immutability. No rules, cancellation eligibility, payments or automatic refund
  processing were changed or deployed.
- 43 focused local legal, hospital-booking and consultation-booking regressions
  passed with synthetic Firebase/email fixtures, including consent validation,
  role/ownership denials, audit/notification atomicity and legacy/retry behavior.
  Added JSON/BOM and exact-replacement-copy regression checks. No build, lint,
  live mutations, emails or deployment were run for this copy-update request.

## Firebase rules redeployment (27 October 2026)

- Owner reauthenticated and explicitly requested redeployment. Scoped,
  non-interactive deployment to ayursarga-connect completed with exit code 0:
  Firestore rules, Firestore indexes and Storage rules only. Both rulesets
  compiled; Firestore rules were uploaded/released, and unchanged Storage rules
  were released. Deployment's index listing showed 17 READY indexes; no index
  creation or initialization was reported.
- No Hosting/application deployment, data cleanup, Auth-account deletion, image
  removal, build or lint was performed in this deployment task. The earlier
  permanent-cleanup discussion did not execute any deletion. Prior emulator
  coverage limitations and separate dependency-remediation blockers remain;
  deployed-rule compilation is not a substitute for workflow permission tests.

## Search Centre image loading (27 October 2026)

- v4.18.2 is a compatible public image-performance fix, using the public-design
  and web-quality skills. No API, permissions, stored images, gallery dimensions,
  card layout or dependency versions were changed by this task.
- Search keeps its 320px IntersectionObserver warm-up, but mounted images load
  eagerly rather than passing through a second native lazy-loading gate. Only
  actually visible first-row candidates receive high fetch priority. Search no
  longer downloads adjacent gallery photos speculatively; manual navigation still
  decodes before replacing the current image. The shared hook coalesces in-flight
  decodes for repeated taps/preloads, without caching completed errors or creating
  a parallel HTTP cache. Initial covers no longer wait for the 380ms slide/fade;
  explicit next/previous navigation retains both directional animations.
- Responsive derivative failures retry the existing original once. Exhausted
  galleries retain the branded, reserved 4:3 frame. Existing responsive WebP
  variants and immutable caching were already appropriately sized: a bounded,
  read-only live sample returned HTTP 200 for 480x360 (18,216 bytes), 800x600
  (32,318 bytes), and 1200x900 (57,764 bytes), all with year-long immutable cache
  headers. Real production-page checks selected 480px sources at 390px/DPR2 and
  1440px/DPR1. No regeneration or further quality reduction was needed.
- Production lab comparison, three runs per viewport with synthetic hospital
  data and controlled 250ms image responses: median cover reveal after releasing
  the image gate improved 917 to 418ms at 390px, and 925 to 403ms at 1440px.
  Requests in this controlled view dropped from six covers plus six unrequested
  gallery photos to six covers only. These are lab reveal timings, not field LCP,
  actual mobile bandwidth measurements or guaranteed real-device performance.
- Validation: 13 focused unit/API/bundle-boundary checks passed. All 77 distinct
  Search/details browser cases passed across seven Chromium/WebKit phone,
  landscape, tablet and desktop projects, including responsive sources, decode
  coalescing, missing derivatives, actual 404 exhaustion, filtering, comparison,
  sold-out handling and package/booking links. Initial landscape/tablet failures
  came from a fixture whose gallery was inside the intentional warm-up margin;
  the fixture now explicitly puts it beyond that margin, and all seven corrected
  off-screen cases plus seven 404/visibility cases passed on rerun.
- Six after-change slow-response production cases passed. The existing 4x-CPU
  production scrolling/input profile also passed: CLS 0.001043, one public API
  call, zero detail prefetches, two initial image requests and twelve after
  scrolling, median test input response 144ms. Actual public images loaded on
  mobile/desktop without runtime errors or horizontal overflow; all three
  desktop cover images and normal-motion forward/backward galleries were checked.
- Final full ESLint passed with zero warnings/errors. Production build passed,
  including TypeScript and 71 generated pages. The same
  fresh production build returned healthy HTTP 200 essential/deep health JSON
  (3/3 and 5/5 configuration checks), and themed health pages rendered in desktop
  Chromium/mobile WebKit without overflow or runtime errors. Health is not a live
  Firestore permission, SMTP-delivery or all-API check. Real iOS/Android hardware
  remains untested. This task does not resolve or deploy the previous section's
  independent dependency-security and Java/emulator/Firestore-rule blockers.
  The temporary production server was stopped; generated next-env routing types
  were restored to the pre-existing development import. No deployment occurred.

## Package/gallery workflow release audit (27 October 2026)

- v4.18.1 follows the API/security/web-quality skills and fixes confirmed gaps:
  stable per-form Hospital draft request IDs now deduplicate concurrent and
  lost-response saves through an audited transaction; submission retries can
  recognize their originating audit via submittedFromAuditId; missing active
  notification recipients fail with actionable 409 feedback before any write.
  Corrected the shared notification writer's incompatible Firestore generic
  overload type using a minimal structural set signature, without suppressions.
- Public package projection adds an opaque SHA-256 content version computed
  only from canonical public fields, not audits, actors, commissions or draft
  content. Consumer booking forwards expectedPackageVersion and checks it in
  the current eligibility transaction. A reapproved price/procedure/note change
  requires the Consumer to review again; saved-booking retries still return the
  original result/snapshot. Legacy callers without the optional version remain
  compatible. No new persisted quote/version fields or client permission grants.
- Public HTTP reads now explicitly use no-store, and the public package endpoint
  no longer serves stale short-cache responses after approval/deactivation.
  In-flight deduplication, parallel bounded reads and pagination remain. Gallery
  images retain responsive derivatives and immutable year-long caching/quality.
- Full baseline: 154 unit/API cases passed. Final full suite: 161/161 passed,
  covering the complete approval/edit/reapproval/booking lifecycle, original
  price snapshots, races/retries, malformed payloads, role and ownership denials,
  real shared authorization with fake Firebase token/profile adapters, missing
  recipients, public privacy/version stability, image minimum and existing
  booking/treatment/consultation/email/consent regressions. Cloud dependencies
  in these tests are synthetic; they do not prove deployed rules or SMTP delivery.
- Browser results: 40/40 affected portal cases across all eight configured
  sizes/engines, 30 distinct Consumer cases across phone/desktop/WebKit phone,
  27/27 Search/details cases and 33/33 comparison cases. One Consumer WebKit
  multi-screen case exceeded its unchanged 30s total timeout during the parallel
  build/suite run (29/30 initially); its isolated unchanged-timeout rerun passed
  in 4.5s. Fixed a stale test that expected Hospital Reschedule, contrary to the
  existing removal decision; no Hospital action was restored. Browser tests use
  real components and synthetic APIs, not authenticated live cloud workflows or
  physical iOS/Android devices. 130 distinct affected cases passed in total.
- Final complete ESLint passed (no errors/warnings). Standalone typecheck passed
  after the writer type fix. Production build passed, including TypeScript and
  all 71 generated pages, with package/lock versions synchronized at 4.18.1.
  Fresh production server on 127.0.0.1:3107 served this build's health checks:
  /api/health 200 configuration (3/3 ready), /api/health?deep=true 200
  deep-configuration (5/5 ready), /health?deep=true rendered on Chromium 1440px
  and WebKit 390px with five service cards, no overflow or runtime errors.
  Configuration health did not generate links, contact SMTP or query Firestore.
- Actual production HTTP checks: eight affected mutation endpoints correctly
  returned uncached 401 without tokens. Separately authorized bounded read-only
  public API checks returned 200: hospital list pageSize=1 (1 record, 1259ms),
  its public package list (6 records, 202ms, no-store). Package responses had
  opaque versions and no draft/review/audit/commission fields. These are single
  samples, not latency percentiles. No authenticated cloud writes or emails.
- Three fresh production Search lab runs with controlled public data/media and
  4x CPU throttling passed: results-ready 3464/2146/2564ms (median 2564), input
  medians 179/287/148ms (median 179), CLS .00104 each, median long-task total
  830ms, one listing request, zero detail prefetches, four initial image requests
  and 24 after scrolling all results. No like-for-like before run, field INP,
  Lighthouse score or real-device speed improvement is claimed.
- RELEASE BLOCKERS: demo-only Firestore emulators:exec was attempted and exited
  before tests because installed Java is 8 and firebase-tools requires Java 21.
  Rule-engine tests remain unrun, although source/API denials passed. Changed
  rules have NOT been deployed. No new index is required by these changes.
- npm audit --omit=dev executed and reported 19 dependency advisories: 1 critical,
  10 high, 8 moderate (counts include transitive package propagation, not 19
  proven exploitable application paths). Installed Next.js is 16.2.11; maintainer
  advisories include the Windows-hosted RCE fixed in 16.3.3 and next/og RCE fixed
  in 16.3.6 (specific runtime/input conditions apply). Sharp/Firebase/Nodemailer
  and transitive packages also require remediation/applicability review. No
  automatic force fixes, Firebase downgrades or major upgrades were performed.
  Owner was asked asynchronously whether dependency remediation should be a
  separate release-blocking task or included; no reply received during audit.
  Primary references:
  https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36
  https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j
- Do NOT call this production-ready until dependency findings are resolved or
  explicitly reviewed, Java 21 rule tests pass, and rules/deployment plus staged
  authenticated smoke checks are completed. No live deployment, operational
  deletion, real upload/email or dependency version changes occurred. Temporary
  production server stopped; generated validation artifacts cleaned; restored
  next-env.d.ts's pre-existing dev type import to avoid unrelated generated diff.

## Hospital cover badge and publication image minimum (27 October 2026)

- v4.18.0 labels the first gallery photo Cover image in the shared Admin/Hospital
  image manager and read-only gallery. The badge follows array order, matching
  the first Search-card photo; removal naturally moves it to the next image.
  Uses the portal emerald/white palette and readable overlay, without new cover
  fields, sorting/reordering controls or public-card changes.
- Owner chose gradual uploads, with four photos required before going public,
  not a four-file initial upload. Shared MIN_PUBLIC_HOSPITAL_IMAGES and
  hasMinimumHospitalImages count four distinct valid normalized HTTPS sources.
  Admin activation/reactivation UI and server endpoint enforce the minimum;
  the activation write now has an update-time precondition to reject stale
  gallery checks. Hospital image removal checks the current transaction's gallery
  for both roles; Admin general image updates enforce the same public minimum.
  Public galleries at/below four disable removal and explain uploading a
  replacement first. Private galleries still support single/gradual uploads and
  removal. Existing public legacy centres below four are not hidden/migrated;
  they may top up, cannot remove more photos, and need four on reactivation.
- Firestore Hospital update rules guard publication plus image/imageUrls
  changed-field bypasses, while allowing unrelated updates to existing live
  legacy centres below four. Existing role restrictions, audit linkage, image
  upload processing, max-ten cap, Storage preservation and bookings unchanged.
- Focused local checks: 25 unit/API/source cases passed (six gallery/minimum
  cases plus existing portal mutations and booking regressions). Six distinct
  browser cases passed on Chromium 320px/desktop and WebKit phone: cover badges
  in both portals, badge reassignment, removal disabled at four, gradual-upload
  availability, activation disabled at three, and existing destructive dialogs.
  Initial browser fixture incorrectly tried an archived Hospital Details route
  which intentionally redirects; removed this unreachable test scenario and
  reran all three new cases successfully. Reviewed gallery screenshots with
  stubbed external image failures; no real-device/CDN delivery claims.
- Added demo-only emulator cases for denied below-minimum publication/removal,
  allowed four-photo publication and unchanged legacy-live profile updates.
  Emulator unreachable at 127.0.0.1:8080; these rule-engine cases were not run.
  Rules need deployment; no build/lint/typecheck, deployment, real Storage writes,
  live data changes, file deletion or email sending requested/performed.

## Hospital package publication approval (27 October 2026)

- v4.17.0 adds private Hospital drafts, explicit Submit for approval, and Admin
  individual/bulk approval in each hospital's Packages and services section.
  Bulk selection is bounded to 20 packages from that hospital; the shared
  confirmation dialog supports Cancel without a request. Admin can return an
  individual request with required feedback. Both submission and review queue
  addressed bell notifications atomically with their package audit/write.
- Top-level service content remains the approved version; draftPackage holds
  proposed edits. New packages start inactive with reviewStatus=draft and
  publishedAt=null. Hospital edits reset reviewStatus to draft without changing
  public content or booked price snapshots; pending/revision changes invalidate
  stale Admin approval. Approval transaction validates every selected current
  revision before any writes, publishes all or none, and handles retries without
  duplicate audits/notifications (returning canonical saved data on retries).
- Hospital cannot activate unpublished packages. Public package and service
  discovery plus Consumer booking eligibility reject unapproved new records;
  public projections never return draft/review metadata. Approved content stays
  visible during review unless independently deactivated/archived. Legacy
  records without review metadata retain existing publication eligibility;
  no records/packages were removed or migrated. Existing Hospital package
  bookings remain immediately confirmed and snapshot approved price/content.
- Firestore service reads retain active Admin/assigned Hospital isolation.
  Direct client service create/update/delete are now denied, replacing old
  create/changed-field write allowlists that could bypass approval; existing
  mutations already use authenticated server APIs. Removed the three now-unused
  service-only rule validators. No new indexes or anonymous SDK reads.
- Focused validation: 34 unit/API/source/dependency regressions passed,
  including role/ownership denials, stale and cross-hospital bulk failures,
  failed commits, concurrent/idempotent reviews, public projection privacy,
  approved pricing while pending, and unchanged booking/treatment flows.
  Final 14 review/public API subset rerun passed after retry-response coverage.
  Seven distinct browser cases passed: the new review workflow on 320px phone,
  tablet, desktop and WebKit phone, plus existing create/edit layout cases on
  phone/desktop/WebKit. Verified submission, single/bulk approval, feedback,
  disabled unpublished activation, scroll lock and no horizontal overflow.
  Reviewed isolated Hospital/Admin package screenshots; all API/UI tests used
  local synthetic data, not production mutations or physical devices.
- Added demo-only emulator tests for allowed scoped reads and denied direct
  writes, including audited bypass attempts. Firestore emulator was unreachable
  on 127.0.0.1:8080, so emulator/deployed-rule coverage remains unverified.
  Rules MUST be deployed with this feature to close old direct-write bypasses;
  no deployment, build, lint, typecheck or live data changes were requested/run.

## Search comparison disclosure (27 October 2026)

- v4.16.4 makes Compare care options collapsed by default on every fresh Search
  page mount. A keyboard-accessible Expand/Collapse comparison button exposes
  aria-expanded/aria-controls and retains the existing public theme, following
  the public design skill. Selections, package duration and comparison results
  remain mounted and are preserved when collapsed/reopened; no extra requests
  are made by toggling. Hidden suggestions stop viewport positioning listeners,
  and collapsing cancels any queued comparison-result scroll.
- No API, persisted data, permissions, booking or loaded result changes.
- Focused browser validation: 14 comparison cases and 14 Search integration
  cases passed across Chromium mobile/landscape/tablet/desktop and WebKit
  mobile/tablet/desktop configurations. Verified initial collapse, Enter/Space,
  preserved selections/results, no refetch on toggling, hidden suggestions,
  no horizontal overflow, and existing filtering/gallery/loading behavior.
  Reviewed collapsed narrow-mobile and desktop screenshots. These are local
  component fixtures with synthetic APIs, not physical-device/live API tests.
- No build, lint, typecheck, deployment or live writes requested/run.

## Public discovery quick performance fixes (27 October 2026)

- v4.16.3 implements only the two approved quick fixes from the audit:
  public discovery no longer reconstructs Firestore Timestamp objects, and
  centre details reserve loading space with a responsive skeleton.
- publicHospitalService decodes unchanged API ISO blocked-range instants into
  plain Date values. Its PublicHospitalDocument type is used by Search, Compare,
  centre details and the existing Consumer booking selection. Operational
  HospitalDocument/Timestamp storage is unchanged. Shared availability helpers
  accept either Date or SDK Timestamp using the same inclusive India care dates;
  their SDK import is type-only. No API/rule/index/cache/write/auth changes.
- A focused emitted-import graph regression verifies Search/Compare/Details
  cannot reach the Firestore SDK at runtime. The previous audit observed a
  ~158 KiB gzip Firestore chunk in the old production discovery bundle; no new
  build was authorized, so actual new bundle size/LCP gains are not yet measured.
- Following the public design skill, the skeleton reuses existing header, nav,
  gallery, context, package-grid and location-card geometry/palette. Static
  placeholders are aria-hidden and noninteractive, with a screen-reader loading
  announcement. No shimmer, artificial delay, new requests or loaded-page
  redesign. Footer remains below the viewport while loading instead of appearing
  briefly near the top. Existing errors and return-to-search behavior remain.
- Validation: all 20 focused public request/date/availability, dependency, API
  projection/denial and Hospital-booking regressions passed. All 50 distinct
  targeted browser cases passed across the relevant Chromium/WebKit phone,
  landscape, tablet and desktop projects (35 centre/search cases, 12 Consumer
  booking cases, 3 comparison cases). Chromium loading-transition fixtures
  assert CLS below .01; WebKit checks layout/recovery, not field CLS. Reviewed
  desktop/mobile loading screenshots. Two initial WebKit error cases exposed a
  test-only race releasing a held mock before React installed its effect; the
  harness now waits for that callback, and all four WebKit loading/error reruns
  passed without changing production behavior.
- No build/lint/typecheck, full-site performance run, deployed-permission or
  physical-device test, live mutation/email or deployment. Existing SSR/email
  performance recommendations were not implemented. No version bump beyond
  the single grouped patch to 4.16.3; package/lock versions synchronized.

## First new notification visual alert (27 October 2026)

- v4.16.2 fixes a missed first-arrival bell pulse in both shared portals.
  The alert tracker waits for an authoritative server baseline, but the bounded
  Firestore notification query did not request metadata-only snapshots. When
  cached/server items matched (including an empty inbox), that transition could
  be omitted; the first actual new item was then silently treated as history.
  Added includeMetadataChanges to the existing query subscription only.
- No additional query/listener, write, API, rule, authorization or notification
  model change. Initial history remains silent; only new unread items pulse.
  Viewing acknowledges attention without changing unread counts; read/clear
  behavior, stale-listener cleanup and absence of sounds remain unchanged.
  Reduced-motion devices retain the static highlight instead of animation.
- Focused reproduction failed before the fix and all 3 notification unit tests
  passed afterward, covering empty/existing cache baselines, metadata transition,
  first arrival, acknowledgement, no replay and inbox cutoff/listener cleanup.
  All 3 focused browser cases passed (desktop, 320px Chromium phone, WebKit phone),
  each checking both Admin/Hospital: actual animated opacity, count animation,
  view acknowledgement, later arrivals, accurate counts and reduced motion.
  An overly specific 2px-outline test initially rejected the valid shared 3px
  keyboard-focus outline; corrected the assertion, not production styling.
- No live notification mutation, real-device test, build/lint or deployment.
  Application release and reload are needed to use this fix; no Firebase rule/
  index deployment required. Version synchronized in package.json/package-lock.

## Owner-requested build and lint validation (25 October 2026)

- ESLint initially caught a redundant synchronous availability state reset in
  ConsultationBookings' fetch effect. Removed it: the dialog open handler
  already initializes all three values. No rule suppression or workflow change.
  Final ESLint passed with zero errors/warnings. Production build rerun after
  that correction succeeded, including TypeScript and all 71 generated pages.
- Four focused desktop/WebKit-phone browser regressions passed for current
  availability, nested calendars, scroll locking and rescheduling after the
  effect correction. No authenticated live workflow/API test or real email.
- Started a fresh next start server for this build on loopback port 3217.
  /api/health and /api/health?deep=true with application/json returned 200/ok
  in configuration/deep-configuration modes (3/5 dependencies ready).
  /health?deep=true returned 200 with expected themed content and rendered at
  390px/1440px with five service cards, no runtime errors or horizontal overflow.
  These are configuration-only checks, not delivery/connectivity/permission
  proof. Temporary server stopped; generated Next route-type import restored.
- Version remains 4.16.1; no separate validation-only bump. No deployment.
  Pending availability rules/application release and SMTP latency limits remain.

## Obsolete pending consultation emails suppressed (25 October 2026)

- v4.16.1 fixes the high-priority stale pending-email retry finding. The shared
  delivery claim now reads the current consultation in the same transaction
  before SMTP. Its status and lastAuditId must match the originating appointment
  revision; archived/missing appointments and changed revisions are not sent.
  New events snapshot bookingAuditId for both recipients; existing pending
  events use their unchanged original lastAuditId. No historical backfill.
- Obsolete pending confirmation/reschedule/cancellation events become terminal
  superseded records, with timestamp/reason and atomic audit. Repeated retries
  do not add audits, send email, or create false delivery-failure bell alerts.
  Feedback explicitly says the outdated email was not sent. Consumer and
  consultant claims remain independent; accepted/failed/sending/unknown records
  are never restarted. Hospital booking email implementation is unchanged.
- Validation: all 44 focused consultation lifecycle/API/email/hospital-booking
  tests passed with isolated cloud/SMTP fixtures. Tests cover the exact lost
  creation-response -> Admin cancellation -> original POST retry reproduction,
  legacy and new pending events, Consumer cancellation, completion, archival/
  missing records, old reschedule retries after a later return to the same date,
  database failure before claim, valid delivery, duplicates and independent
  recipient failures. No live database mutation or real email was performed.
- This closes the obsolete *pending* event finding, not the separate awaited
  SMTP-latency finding. The transactional claim is the dispatch boundary:
  cancellation after a successful send claim cannot atomically recall SMTP
  already in flight/accepted. No exactly-once inbox-delivery guarantee.
- Server-only event records remain denied to every client role, so no new
  rules/index change is required for this fix. Earlier availability rule changes
  still need their own validation/deployment. No build/lint/typecheck, browser
  run or deployment for this task; the application must be released for this
  guard to take effect. Version synchronized in package.json/package-lock.

## Enforced consultant booking dates (25 October 2026)

- v4.16.0 enforces existing preferredDays plus optional availableDates (up to
  31 ISO care dates). Both restrictions must match when configured; both empty/
  missing preserves legacy unrestricted future dates. Past/ended windows still
  cannot be booked. Changing availability does not migrate/cancel appointments.
- Admin consultant create/edit validation, form parsing, model and both
  Firestore document/changed-field allowlists include availableDates. Existing
  API create and direct-SDK edit atomic audits are reused. Admin can add/remove
  dates, see saved dates and reopen them for editing; DD/MM/YYYY display remains.
- Public whitelist exposes only safe weekdays/dates, rejecting malformed
  configurations. A bounded exact-consultant lookup reuses that projection for
  Admin rescheduling; never returns contacts or raw operational documents.
  Consumer calendar disables unavailable dates and expired windows; typing,
  submitting and switching consultants cannot preserve an invalid selection.
  Optional lazy-loaded restricted calendar uses ModalLayer for focus, viewport
  handling and nested scroll locking; ordinary DateInput keeps its native picker.
- Creation and Admin rescheduling re-read current consultant availability in
  their existing transactions before any write/email. Committed request retries
  remain idempotent despite later availability edits. Hospital package bookings,
  appointment IDs/status lifecycle and existing records are unchanged.
- Validation: 55 focused unit/API/date/hospital-booking regressions passed;
  consultant-save suite rerun passed all 13 after additional API assertions.
  18 final Playwright cases passed across desktop, 320px Chromium phone and
  WebKit phone: restricted dates, nested calendar dialogs/scroll restoration,
  Admin save/reopen, legacy preferences, rescheduling, ordinary native date
  inputs and single Consumer submission/consent. Fake cloud/email fixtures;
  no live database writes, email or physical-device testing.
- Added emulator coverage for valid/invalid/duplicate/cleared/max-31 dates and
  denied Hospital/Consumer changes, not executed: only Java 8 is installed.
  Mock/source checks do not prove deployed rules or their expression budget.
  Rules must be validated/deployed before releasing Admin edits with the new
  field; no index change is needed. No deployment/build/lint/typecheck was run
  for this task. Earlier stale pending-email replay and awaited SMTP-latency
  audit findings remain separate and unfixed; this availability task does not
  claim to remedy them. Version synchronized in package.json and package-lock.

## Firebase deployment after reauthentication (25 October 2026)

- Owner requested redeployment after Firebase reauthentication. Scoped,
  non-interactive deployment to ayursarga-connect succeeded for firestore:rules
  and firestore:indexes. CLI compiled/released firestore.rules and reported
  successful index deployment. Read-only index listing verified all 17 deployed
  composite indexes READY, including consultant discovery and own-consumer
  consultation history indexes; none initializing. No forced index deletion.
- No Hosting, Storage, Functions or operational records were changed. Firebase
  Hosting still targets static out/ (absent), so it must not replace the
  Node-capable application hosting. UI/API version 4.15.1 needs a separate
  application release. Generated CLI debug log removed; no version bump.
- Earlier audit findings remain unfixed: obsolete pending confirmation emails
  can replay after cancellation (reproduced with isolated fixtures); SMTP
  currently delays consultation responses; configured preferred weekdays are
  advisory in practice and not enforced by booking validation. Deployment does
  not remedy these findings. Prior build/lint/typecheck, 77 focused tests and
  40 UI cases passed; fresh-build health was configuration-ready, not proof of
  live SMTP delivery or deployed authenticated permission flows.

## Hospital treatment controls and badges (25 October 2026)

- v4.15.1 removes Hospital booking Reschedule and Mark ongoing buttons.
  Start treatment changes the Hospital badge to Treatment Started and leaves
  only Complete treatment. Completion retains the shared confirmation dialog
  and displays Treatment completed, with no further treatment action.
- Existing direct started-to-completed API/service/rule transition is reused;
  its ownership, validation, concurrency precondition, timestamps and atomic
  audit are unchanged. Historical ongoing records can still complete, and
  reschedule_requested records remain readable/confirmable. No data migration,
  API restriction change or Firestore rule/index update. Admin/Consumer summary
  defaults are unchanged; Hospital opts into treatment-specific badge labels.
- Validation: 14 focused mutation/booking-details regressions passed, including
  audited direct completion and permission denials. 3 browser cases passed
  (desktop, 320px Chromium phone, WebKit phone) for start/completion badges,
  absent removed controls, cancelling/confirming completion, scroll restoration,
  overflow and unchanged Admin badge behavior. No build, lint, emulator, live
  writes or deployment.

## Consultant appointment emails, phase 1 only (25 October 2026)

- v4.15.0 emails the assigned consultant for new consultation bookings, Admin
  reschedules and Admin cancellations. Uses the shared branded booking template
  and SMTP, with consultant greeting, Consumer name, reference, service and India
  date/window or exact time. Reschedules include original/updated schedules.
  Consultant CTA is public Ayursarga contact, not a protected Consumer booking
  page or invented consultant dashboard. Private notes and unrelated contacts
  are excluded. Consumer cancellation/completion do not add consultant emails.
- The trusted operational consultant document supplies the current registered
  email inside the appointment transaction (existing read reused for creation/
  rescheduling; cancellation adds one read). Consumer and consultant event records
  are queued atomically but claimed/delivered independently in parallel. Each
  recipient has its own stable event ID and outcome, channel, timestamps and
  categorical failure reason. Retried actions do not resend accepted/failed/
  ambiguous emails; existing uncertainty/no-background-worker limits remain.
- Missing/invalid consultant email and SMTP failure create an audited Admin bell
  alert; Admin action responses also show consultant delivery independently from
  Consumer delivery. Booking success and Consumer mail do not depend on consultant
  mail. Consumer API responses never expose consultant contact information.
  Historical events are not backfilled. No WhatsApp integration, preferences,
  country-code fields, new Auth accounts or manual retry workflow introduced.
- Existing server-only consultationEmailEvents rules already deny every client
  read/write, covering these additional fields; no rule/index change or deployment
  needed for Admin SDK document access. Application changes are not deployed.
- Validation: 52 focused lifecycle/email/API/shared-mutation/Hospital booking
  regressions passed with isolated cloud/SMTP fixtures. Includes independent
  failures, missing contacts, current assigned address, no duplicate sends and
  original/updated schedule content. 9 focused desktop/320px Chromium/WebKit phone
  browser cases passed for rescheduling and separate consultant error feedback.
  No build, lint, typecheck, emulator or live SMTP run; no production mutations
  or deployment.

## Automatic online consultation confirmation and schedule emails (25 October 2026)

- v4.14.0: new consultationBookings are confirmed immediately for the chosen
  India care date/window; confirmedTime stays null rather than inventing an exact
  appointment. Admin Confirm/Reject actions are removed. Reschedule validates a
  future India date/exact time within the snapshotted and currently configured
  consultant window, retains confirmed status and preserves original snapshots.
  Legacy requested/rejected documents are not migrated. Requested records may
  be explicitly rescheduled or cancelled; completion still requires confirmed.
- Existing IDs, consent, charges, own-Consumer/Admin reads, Hospital isolation,
  audited transactions and bounded lists remain. Admin action IDs deduplicate
  retries; expected audit IDs reject stale UI edits. Repeated reschedules use
  distinct atomic bell events. Consumer and Admin copy/status/date displays agree.
  Hospital package booking routes and their immediate confirmation are untouched.
- Shared bookingEmail branding/SMTP now supports original/updated schedule and
  cancellation emails (including a window when no exact time was assigned).
  Server-only consultationEmailEvents snapshots are queued in the same
  appointment/audit transaction. After commit, one durable claim precedes SMTP.
  Recorded outcomes prevent retries from sending another email. Pending events
  can resume through the original request retry; there is no background worker.
  SMTP acceptance is not inbox-delivery proof. Crashes or an uncertain SMTP/
  outcome-write result may leave a sending/unknown event; it is deliberately not
  auto-resent. Admin sees explicit failure/uncertainty feedback and is directed
  to contact the Consumer rather than being told delivery succeeded.
- Delivery state changes are audited. Explicit Firestore rules deny every
  client role access to email-event records (already default-denied); existing
  consultation client-write denial and role-scoped reads stay unchanged.
  No new index is required; server document access uses the verified Admin SDK,
  not client permissions. Application and explicit rule changes have not been
  deployed. AGENTS workflow guidance is
  updated to match the owner's new confirmation decision.
- Validation: 48 focused unit/API/transaction/email/shared-mutation/Hospital
  booking regressions passed with fake cloud dependencies. 16 browser cases
  passed across desktop, 320px Chromium phone, WebKit phone, tablet and landscape,
  covering booking consent, rescheduling/cancel-before-save, invalid times,
  double-submit prevention, scroll restoration, filters and visible email errors.
  Initial browser assertions used capitalized status text (the existing formatter
  is lowercase); corrected tests only. Lost-response coverage also required fake
  auto IDs to continue after seeded records; the fixture now avoids those clashes.
  Emulator denial cases added, not executed; no deployed-permission, physical
  device or live SMTP claim. No build, lint, typecheck or deployment performed.

## Stress Management choices (25 October 2026)

- v4.13.3 replaces Yoga & relaxation therapies, Pranayama & meditation and
  Body therapies with Wellness Retreats and Spa & Rejuvenation. Exactly three
  single-select choices remain, including Psychologist consultation.
- Only Psychologist opens online consultation. Both retreat/spa options retain
  preferred date/district and centre/package discovery. Following the public
  design skill, existing layout, styling and other wellness categories remain
  unchanged. No API, rules or booking persistence changes.
- All 12 focused Wellness Path regression tests passed, covering exact choices,
  single selection, online routing, centre routing and other existing paths.
  No build, lint, device-browser validation or deployment performed.

## Silent portal notification alerts (25 October 2026)

- v4.13.2 removes the shared Web Audio chime/helper and gesture-priming
  listeners. Admin and Hospital share a subtle 2.4-second bell/count opacity
  pulse only for newly observed unread records after the initial server baseline.
  Viewing the inbox acknowledges attention without changing read status/counts;
  arrivals while it is open are already viewed. Later snapshots do not replay
  acknowledged alerts. Reading/removing all pending alert records also stops it.
- Reduced-motion users receive a static gold outline instead of animation.
  Notification subscription, count, API actions, authorization and persistence
  remain unchanged. No build, lint, deployment or live notification mutations.
- Validation: 2 focused inbox/tracker tests and all 3 browser cases passed
  (desktop, 320px Chromium phone, WebKit phone), exercising both portals,
  new/replayed arrivals, viewing, arrivals while open, unread counts and reduced
  motion. Initial browser run correctly suppressed animation under the harness's
  default reduced-motion setting; test now explicitly switches motion modes.

## Inline optional field labels (25 October 2026)

- v4.13.1 groups field text and `(Optional)` into a single label-heading span
  in consultant, shared hospital, package and Admin invoice forms. Previously,
  the label's grid placed its separate small element on another row. Shared
  styling keeps the marker inline without changing controls, validation, field
  associations or responsive input sizing. Consumer notes labels and the
  availability legend were already inline and remain unchanged.
- Added a focused browser regression across these four forms, checking marker
  alignment and horizontal overflow; all 3 desktop, 320px phone and WebKit phone
  cases passed. Initial run reached the closed invoice form; fixed the test to
  open that form before asserting, with no production behavior change.
  No API, persisted-field or rules changes; no build, lint or deployment.

## Admin Hospital commission invoices (24 October 2026)

- v4.13.0: owner selected Hospital commission invoices. Added Admin-only
  `/admin/billing` and sidebar navigation, bounded hospital search, manual
  commission/description, invoice/due dates, chosen GST treatment/rate, place of
  supply, optional SAC and notes/payment instructions. No tax rate or bank details
  are invented. Existing Hospital/Consumer navigation and booking data unchanged.
- Preview precedes Generate invoice. The Admin-only `/api/admin/invoices`
  recalculates exact paise totals, snapshots issuer/hospital billing details,
  reserves an annual `AS/YYYY/00001` number and creates the invoice/audit/counter
  in one transaction. Stable request IDs return the same issued invoice after
  retries; changed payload reuse is rejected. Issued records are immutable in
  this first release; it does not add paid status, invoice email, booking-linked
  reconciliation, cancellation/credit notes, or automatic commission collection.
- Bounded invoice list and read endpoint require active Admin authorization.
  New Firestore invoice rule allows Admin reads only and denies all client writes
  and deletion. API writes use verified Admin SDK access; UI uses that API rather
  than relying on client invoice reads. Rule change has not been deployed; no
  composite index is needed. Admin audit views identify invoice numbers/area.
- The existing contract preview and native PDF renderer now accept optional
  document branding, preserving their contract defaults. Invoices use Ayursarga
  emerald/gold, issuer GSTIN 32ABGCA7749G1ZL, DD/MM/YYYY dates and dated PDF names.
  Fixed native PDF line-break whitespace so party/address text does not join.
- Validation: 5 invoice unit/API/source-rule tests and 1 contract-template
  regression passed. Invoice preview/issue/download passed on desktop, phone-320
  and WebKit phone; verified downloaded PDF signature, GSTIN and total. Initial
  parallel Chromium runs timed out during a workspace stall; both passed on a
  sequential rerun without increased timeouts. Added emulator role/read/write
  denial cases, not executed (local Java 8/no running emulator). No deployed-rule
  permission claim, live invoice creation, email, deployment, build or lint run.

## Consumer booking confirmation emails (23 October 2026)

- Version 4.12.0 adds branded HTML/plain-text Consumer confirmation emails for
  new immediately confirmed Hospital bookings, legacy/rescheduled bookings when
  Hospital confirms, and online consultations when Admin confirms. Requested
  consultations, cancellations and treatment progress do not send confirmation.
- Recipient comes from the committed booking's Consumer email snapshot, never
  request-controlled recipient fields. Templates include reference, provider,
  service/package, DD/MM/YYYY care date, exact time only when set (IST), price,
  relevant bystanders and a canonical APP_SITE_URL My Bookings link. Private
  notes, commission and unrelated management data are excluded. Email does not
  imply payment receipt or invent an exact Hospital appointment time.
- Shared server-only SMTP runs via Next `after()` after a successful commit;
  normal duplicate/retried requests don't reschedule delivery. Existing booking
  validation, atomic audits/bell notifications and response contracts are intact.
  SMTP/scheduling errors are logged generically and do not undo confirmation.
  This is best-effort post-response delivery, with no durable outbox or automatic
  resend. A process failure/lost commit acknowledgement can leave a confirmed
  booking without email; don't claim exactly-once or guaranteed inbox delivery.
- No new persisted fields/collections, indexes or Firestore rules changes.
  Focused regression passed 34 tests across templates/deferred SMTP, booking
  transactions/retries, consultation transitions and Hospital mutation handling.
  Tests use isolated SDK/SMTP mocks. No live email/database mutation, build/lint,
  production after-hook test or deployment was performed for this update.

This file records completed work and verification limits. `AGENTS.md` remains
the implementation authority; these notes do not authorize deployments or data
maintenance. Preserve unrelated working-tree changes; the workspace contains
substantial uncommitted work across multiple tasks.

## Consultant preferred weekdays (23 October 2026)

- Follow-up v4.11.1: weekday choices now use seven equal desktop columns with
  centered labels spanning the full row; wrap to four/three columns for smaller
  viewports. Consultant save/reopen tests passed on phone-320, landscape, desktop
  and WebKit phone after the spacing adjustment.
- Owner authorized deployment after reauthentication. Firebase CLI compiled and
  released current `firestore.rules` to `ayursarga-connect` successfully on
  23 October 2026 using `--only firestore:rules --non-interactive`. No indexes,
  Storage rules, application hosting or operational records were changed. The
  generated Firebase CLI debug log was removed. Live authenticated saving has
  not been tested; alignment requires an application release to reach hosting.

- Version 4.11.0: Admin Our Consultants now includes optional Mon–Sun checkboxes
  above Morning/Noon/Evening. Multiple days are stored in canonical Monday-first
  `preferredDays` arrays; saved days display on the consultant card and populate
  edit forms. Missing legacy values remain empty/Days not specified. These are
  Admin availability preferences, not new Consumer date restrictions; public
  consultant projection and existing booking eligibility remain unchanged.
- Traced create through the Admin-only API/shared validation/atomic audit and
  edit through the shared validated direct SDK/audit batch. Updated both rule
  document/changed-field allowlists, day membership/uniqueness checks and legacy
  defaults. No new read permission, index, or automatic data migration.
- Validation: 26 focused consultant/consultation API-service-unit/source-contract
  checks passed; 4 edit/save/reopen browser regressions passed on narrow phone,
  landscape, desktop and WebKit phone. Emulator cases also cover valid weekday
  edits, clearing, invalid/duplicate values and denied Hospital/Consumer writes,
  but were not executed (only Java 8 found; no local Firestore emulator running).
  Mock/source checks do not establish deployed permissions. Firestore rules must
  be deployed before production direct consultant edits can save preferredDays.
  No deployment, build/lint, live database write or physical-device test.

## Booking filter summary placement (22 October 2026)

- Moved the shared booking/consultation result badge inside each filter card as
  its final summary row. It no longer floats between the filter panel and first
  result card. Desktop aligns it right; narrow mobile aligns it left.
- Applied to Admin Hospital Bookings, Hospital Bookings and Admin Online
  Consultations without changing filtering or data behavior. Version advanced
  from 4.8.1 to 4.8.2.

## Portal result-count presentation (22 October 2026)

- Replaced loose `Showing1online consultation`-style text with the shared
  `PortalResultCount` component. Counts now render as a compact bordered badge
  with explicit spacing, accessible status labelling and a separated more-results
  indicator.
- Applied consistently to Admin Hospital Bookings, Hospital Bookings and Admin
  Online Consultations. Data, filtering and pagination behavior are unchanged.
  Version advanced from 4.8.0 to 4.8.1.

## Version 4.8.0 validation (22 October 2026)

- Owner-requested ESLint, TypeScript, production build and API checks completed.
  ESLint and `tsc --noEmit` passed; Next 16.2.11 production build generated all
  68 routes successfully.
- Full local API/unit contract suite passed 96/96. A stale Wellness Path unit
  harness was updated to recognize Next `Link` elements introduced by route
  prefetching; production behavior was not reverted.
- The same production build passed 4/4 read-only HTTP smoke groups: essential
  and deep health JSON, themed deep-health page and redirect, 11 unauthorized
  mutation denials, bounded public consultant projection, and Search Center
  public list/details/packages. Deep health reported five configured
  dependencies ready. No authenticated mutation, email, deployment or live data
  change was performed. The temporary port-3187 server was stopped.

## Admin online-consultation booking experience (22 October 2026)

- Admin Online Consultations now uses the same compact operational booking-card
  hierarchy as Admin Hospital Bookings: booking reference, service/provider,
  structured facts, status, charge and separated action area.
- Added Admin-only search across booking reference, service, consultant and
  Consumer contact fields, plus status and preferred-month filters, clear action,
  result count and contextual no-match state. Filters operate on the current
  bounded page and say so explicitly; pagination, update APIs and dialogs are
  unchanged. Version advanced from 4.7.5 to 4.8.0 for this feature.

## Fresh online-consultant availability (22 October 2026)

- The public consultant endpoint was already `no-store`; local measurements were
  395 ms cold and 119–159 ms warm. The stale experience came from an already-open
  Consumer consultation page not requesting the list again after Admin changes.
- Consumer consultant selection now refreshes when the page becomes visible,
  regains focus or returns from browser page cache, with a short duplicate-event
  guard. Its empty state also offers Check availability again.
- Wellness Path consultation links now use Next navigation so their protected
  route can be prefetched without changing the flow. No Hospital booking or
  consultation authorization behavior changed. Version advanced to 4.7.5.

## Booking detail action alignment (22 October 2026)

- Admin booking details now keep Online consultations and View all bookings in
  one dedicated navigation row. Hospital booking details use the same separated
  navigation treatment for View all bookings.
- Removed the redundant Showing 1 booking result count from both role-specific
  detail views while retaining result counts on their list pages. Booking data,
  APIs and actions are unchanged. Version advanced from 4.7.3 to 4.7.4.

## Admin and Hospital portal state consistency (22 October 2026)

- Completed the follow-up state-content pass across Admin and Hospital operational
  lists after the Consumer portal alignment work. Existing forms, filters,
  actions, APIs and workflow behavior remain unchanged.
- Admin Hospitals, Consultants, Users, Bookings, Availability, Audit Logs,
  Hospital Details and package sections now provide contextual empty-state
  headings instead of the generic fallback.
- Hospital Services, Bookings and Availability use the same contextual pattern,
  including distinct headings for empty records and filtered searches.
- Added responsive fixture coverage for all primary Admin and Hospital list empty
  states. Application version advanced from 4.7.2 to 4.7.3 for this UI polish.

## Consumer portal state and introduction consistency (22 October 2026)

- Extended the consultation-request alignment pattern to Consumer online
  consultation history: guidance now precedes aligned actions, and loading,
  unavailable and failed states use the same themed state card and meaningful
  wording. The unavailable detail case is distinguished from an empty history.
- The shared PortalFeedback accepts a contextual empty heading; Consumer My
  bookings now says `No hospital bookings yet` and explains exactly what will
  appear. Other role screens retain their existing default heading and behavior.
  Patch version 4.7.1 to 4.7.2 synchronized in the package files.

## Consumer consultation empty-state alignment (22 October 2026)

- Reorganized the protected consultation-request screen into a dedicated intro,
  aligned navigation and mutually exclusive loading/error/empty/available states.
  When no professional is assigned, the unusable consultant/date/consent form is
  no longer rendered; a concise themed notice explains availability and links to
  Contact Ayursarga. Existing consultant selection and booking submission remain
  unchanged when records are available. Patch version 4.7.0 to 4.7.1 synchronized.

## Admin and Hospital notification chime (22 October 2026)

- The shared non-Consumer portal bell now plays a restrained, asset-free Web
  Audio chime when a genuinely new unread notification arrives after the first
  authoritative Firestore snapshot. Initial/cached records, read-state changes,
  listener reconnections and previously seen records remain silent.
- Audio is primed only after the first normal pointer or keyboard interaction to
  comply with iOS/Safari/Chrome autoplay rules. The visual bell/count remains the
  primary signal when audio has not been permitted or supported. No notification
  delivery, Firestore schema, permission or API behavior changed. Minor version
  4.6.5 to 4.7.0 synchronized in the package files.

## Online professional title casing (22 October 2026)

- Standardized the Wellness Path online-professional card titles to `Yoga
  Instructor`, `Lactation Consultant`, and `Women's Wellness Consultant`.
  Service IDs, routes and booking behavior are unchanged. The focused Wellness
  Path regression suite covers the provider label. Patch version 4.6.4 to 4.6.5
  synchronized in the package files.

## Wellness Path CTA clarity (22 October 2026)

- Strengthened the public Wellness Path `Book an appointment` links from small,
  translucent controls to brighter solid-gold primary actions with larger forest
  text. Applied the same clarity treatment to `Prepare my request` and related
  step actions, with clear cream hover/focus feedback and no positional hover
  movement. Routes and booking behavior are unchanged. Patch version 4.6.3 to
  4.6.4 synchronized.

## Wellness Path calendar-icon clarity (22 October 2026)

- Scoped the shared DateInput presentation inside Wellness Path labels so its
  unboxed calendar icon is aligned directly to the 50px input field and uses a
  clearer cream-gold stroke with restrained hover and focus states.
  Shared date behavior and date controls outside the public Wellness Path were
  unchanged. Patch version 4.6.2 to 4.6.3 synchronized in the package files.

## Wellness-card LCP loading hint (22 October 2026)

- Removed the forced lazy-loading behavior from the first visible Wellness Path
  card row. Its first three images, including postnatal care, now load eagerly;
  later cards remain lazy so below-the-fold media does not compete for the
  initial connection. No layout, image quality, content, or interaction changed.
- Added a focused source contract and ran the Wellness Path unit suite: 11/11
  passed. Broader lint/build checks were not requested. Patch version 4.6.1 to
  4.6.2 synchronized in the package files.

## Booking preservation, deployment and final validation (22 October 2026)

- Owner requested regression verification, scoped Firestore deployment, build,
  lint and affected API checks. Compared the Search Center booking form/service,
  creation/reference endpoints, Hospital mutation endpoint and original booking
  rules against Git: no business-logic changes. Hospital bookings still confirm
  immediately; online consultations remain a separate requested workflow.
- Found one lint error introduced in the public women's consultant label. Escaped
  its apostrophe with &apos;, preserving the rendered text. No booking/security
  workaround or suppressed lint rule. Patch version 4.6.0 to 4.6.1 synchronized.
- Deployed only firestore:rules,firestore:indexes to ayursarga-connect using a
  non-interactive CLI command; compilation and release succeeded. Independently
  fetched the active rules release and compared its source exactly to the local
  file: match true. Read-only Google API verification confirmed both new indexes
  READY: consultants(status, consultationServices array, employeeSequence) and
  consultationBookings(consumerId, createdAt). No hosting or Storage deploy.
- Final production build v4.6.1 passed compilation, built-in TypeScript checks,
  generation of all 68 pages and optimization. Full ESLint passed with zero
  warnings/errors after the markup correction and addition of regression tests.
- Seventy-three focused unit/actual-route-with-fake-cloud checks passed across
  original and online booking creation, validation, ownership, historical data,
  snapshot prices, consent, idempotency, atomic failure, notifications, treatment,
  public search/projections, comparison, sold-out periods and health contracts.
- Added tests/emulator/bookings.rules.test.mjs with a hard-coded demo project and
  loopback-only host. Seven real Firestore emulator tests passed: scoped reads,
  permanent-delete/direct-create denial, audited Consumer cancellation, unchanged
  price protection, started-care cancellation denial, audited treatment/legacy
  confirmation, consultation isolation, valid Admin consultant assignment edits
  and denied invalid/cross-role edits. Fixtures include exact previous/updated
  audit snapshots and matching server timestamps, like the actual shared batch.
  Initial incomplete test audit fixtures were corrected; application/rules were
  not weakened to make tests pass. Default Java is 8; used installed PyCharm JBR
  25 for the cached Firestore emulator. Emulator shut down after its suite.
- Browser fixtures: 40 original Consumer/Admin/Hospital booking tests passed at
  phone, tablet, desktop and WebKit phone; 21 Search Center/details tests passed
  at phone, desktop and WebKit phone; 9 consultation/consultant tests passed at
  narrow phone, desktop and WebKit phone. Covered actual components, date prefill,
  consent, sold-out/available care, automatic confirmation, legacy records,
  package links, notification clear, navigation, lazy images and responsive grids.
- Added tests/integration/booking-api.smoke.test.mjs, restricted to loopback and
  no authenticated writes. Against a fresh production Next server on port 3187,
  all four groups passed: essential/deep JSON and themed expanded health (HTTP
  200; 3/5 configured dependencies; correct HTML redirect), eleven missing/invalid
  token denials (401), public consultant validation/indexed read (400/200), and
  real public hospital list/detail/packages plus /centers (200). Public responses
  excluded checked private management fields. Two active public centres checked;
  zero eligible online consultants returned, so Admin assignment/charge/windows
  configuration is still required before online providers appear. Health remains
  configuration-only, not SMTP delivery or a substitute for these API/rules tests.
- No authenticated production test bookings/status changes, live profile edits,
  emails or database maintenance performed. Successful mutations were exercised
  in local fixtures/emulator, not a fully signed-in production browser journey.
  App code is built locally, not deployed by this task. Public HTTP smoke tests
  read existing data only. Both new Firestore indexes and rules ARE deployed.
- Stopped only the temporary production server; restored the build-generated
  next-env.d.ts route import to its pre-check value and removed the generated
  emulator debug log. Existing dev server and unrelated changes preserved.

## Wellness Path bookings and consultant assignments (22 October 2026)

- Owner approved connecting online Wellness Path services to Admin-managed Our
  Consultants using explicit service assignments, charges and custom preferred
  windows. Added seven service IDs: prenatal doctor, dietitian and yoga,
  lactation, women's wellness, cosmetologist and psychologist. Admin creates and
  edits assigned services through existing audited consultant forms/services;
  both Firestore document and changed-field allowlists include the validated
  list. Legacy records default to no assignments and remain unavailable publicly
  until Admin configures services, a non-null charge and preferred windows.
- Public Wellness Path CTAs now open protected online booking for their selected
  service. Removed disabled booking placeholders, hardcoded women's doctor names
  and invented exact times. Existing in-person preferences instead continue to
  public centre/package selection with the selected date and district search.
  Hospital packages are not falsely filtered by unsupported care categories.
  Public design skill preserved existing card/CTA styling and scroll behavior;
  no portal modules were imported into public WellnessGuide.
- Added bounded sanitized GET /api/public/consultants (12 + lookahead, numeric
  cursor). Whitelist includes professional name/designation/qualification,
  experience, charge and preferred windows only; operational contact/address,
  emergency and audit fields are excluded. Raw consultant reads stay Admin-only.
- Added separate consultationBookings records, authenticated Consumer creation
  and Admin/Consumer status endpoints. Consumer creation requires current profile
  and booking consents, snapshots actual charge/provider/contacts/window and
  reserves a canonical booking reference. Stable request IDs make simultaneous
  retries/lost responses idempotent. Changed charges or window timings require
  refresh/review rather than silently changing the Consumer's chosen terms.
- Online requests begin requested: preferred windows do not reserve exact
  appointment times. Admin coordinates and confirms a date/time inside the
  snapshotted window, can reject/cancel, then mark confirmed appointments complete.
  Consumers may cancel only their own requested/confirmed consultations; Hospital
  users have no access. Repeated status retries do not duplicate audits/bells.
  Hospital package bookings remain immediately confirmed, with existing treatment
  progress unchanged. No payments, meeting links or consultant Auth accounts added.
- Creation/status changes, audit entries and addressed bell notifications commit
  in the same transaction. Admin receives new requests and Consumer cancellations;
  Consumers receive Admin status changes. Shared confirmation dialog, scroll lock,
  same-tick submission guards, event-identity toasts, DD/MM/YYYY DateInput and
  bounded pagination reused. Added online history under both booking areas and
  readable audit labels/filter; price and consent snapshots remain immutable.
- Local verification: 43 focused unit/real-route-with-in-memory-cloud-fixture
  checks passed, including existing immediate-confirmation hospital booking
  regressions, authorization denials, assignment validation, atomic commit
  failures, retry protection, privacy projection and rules/index source contracts.
  Fifteen focused browser-fixture checks passed across Chromium 320px phone,
  landscape, tablet, desktop and WebKit phone. Covered form consent/duplicate
  submission, custom windows, consultant edit persistence, confirmation/cancel,
  body scroll lock, consumer control isolation and compact readable radio cards.
  Screenshot review found/fixed inherited 100%-width radio styling; assertions now
  check card height and text/control width, not only horizontal overflow.
- These fixtures do NOT prove deployed Firestore permissions or actual production
  requests. No emulator/live booking mutations, lint, typecheck, build, broad API
  checks or deployment were run. Required before live use: deploy app plus
  firestore.rules and firestore.indexes.json to ayursarga-connect; wait for the
  new consultant service/sequence and Consumer consultation-history indexes to
  finish initializing; then configure consultant assignments/charges/windows.
  No database migration, historical changes or live notifications performed.
- Minor version 4.5.1 to 4.6.0 synchronized in package and both lockfile entries.
  AGENTS.md records the new projection, consent/permission and request semantics.

## Health coverage and post-build validation rule (21 October 2026)

- Confirmed deep=true was previously ignored: the page/API only checked Firebase
  Admin and contact mail. Added one shared configuration-only health report for
  the JSON endpoint and themed page. Essential mode adds branded auth-email
  readiness (Firebase Admin, SMTP configuration, validated canonical return URL).
  Expanded mode adds Firebase Web SDK and hospital Storage bucket configuration.
- /api/health?deep=true returns deep-configuration mode, five statuses and no
  secrets. JSON responses remain no-store and 200/503 based on readiness. Browser
  HTML redirects retain deep=true. Page labels explicitly distinguish Configured
  from live connectivity/delivery; no database reads, mail sending, link generation
  or arbitrary API probes are performed. Health is not full API/rules validation.
- Hospital login-setup readiness also checks auth email URL configuration. README
  corrected earlier claims that a health route tests every API.
- AGENTS.md now requires read-only JSON + themed expanded health verification
  after each successful owner-requested build, against that fresh production
  build, not a stale/dev server. No automatic build/deployment or live mutations
  are authorized by this rule. Report unavailable checks/dependencies honestly.
- Seventeen focused mocked health/email unit/API tests passed. Live local dev
  requests: essential JSON HTTP 200 (3 configured checks), expanded JSON HTTP 200
  (5 configured checks), expanded page HTTP 200 with new sections/disclaimer,
  HTML redirect HTTP 307 preserving /health?deep=true. No credentials displayed.
  This was development-server HTTP validation, not production-build testing or
  SMTP/Firebase connectivity verification. No lint, typecheck, build or deployment
  run. Patch version 4.5.0 to 4.5.1 synchronized; .env.example www URL preserved.

## Branded invitations and password-reset email (21 October 2026)

- Owner approved replacing app-triggered Firebase template emails because the
  project's Firebase template editor is restricted. Added shared responsive
  emerald/cream/gold HTML and plain-text authentication templates for Hospital
  invitations/setup/resend and Admin/Hospital password resets. No dependency on
  that template editor or Dynamic Links. Firebase Admin generates reset links;
  Firebase's default hosted action page still verifies codes and sets passwords.
  Manual Firebase Console emails and Google Consumer sign-in are unchanged.
- Extracted the existing pooled Gmail SMTP transport into server-only
  services/email/emailService.ts. Contact email recipients, reply-to, subject
  and existing template are preserved, with a regression check. SMTP rejection
  is an error; SMTP acceptance is not guaranteed inbox delivery.
- Admin-only login-setup endpoint retains audited provisioning/reconnection and
  now sends its invitation server-side after commit. Prechecks email readiness
  and canonical URL; rate-limits resends. Client requires emailSent confirmation,
  never sends through browser Firebase or receives the action link. Email
  delivery failure preserves provisioned records and reports an explicit retry.
- New public POST /api/auth/password-reset validates bounded JSON/email, checks
  cross-site/origin signals, and uses the existing per-instance limiter for
  request fingerprint, hashed recipient and global delivery limits. Not a
  distributed anti-abuse guarantee; no new shared rate-limit infrastructure.
  Sends only to matching active Admin/Hospital profiles and enabled Auth users.
  Unknown/ineligible accounts and operational delivery failures get the same
  generic acknowledgement to avoid exposing account existence. Configuration
  errors are reported independently. Logs never include raw errors/reset codes.
- Shared auth service now calls that endpoint; forgot-password form prevents
  same-tick duplicate submission and uses generic inbox/spam acknowledgement.
  Auth action URLs are neither returned nor persisted. No new Firestore writes
  or rules changes; existing server-only Admin role checks remain in force.
- Configuration: existing GMAIL_USER and GMAIL_APP_PASSWORD required on hosting;
  server-only APP_SITE_URL defaults to https://ayursarga.com. Authorize the
  canonical domain in Firebase Auth. Do not derive destinations from requests.
  Local/hosting env files were not read or changed. .env.example and README
  document configuration, delivery limits and migration behavior.
- Version 4.4.1 to 4.5.0 synchronized. Twelve focused mocked unit/API/service
  tests and six Playwright checks passed (Chromium 320px phone/desktop and
  WebKit phone), including two email templates, reset forms, authorization,
  invalid input, SMTP rejection, atomic provisioning, generic failures and
  token-safe output/logs. Visually inspected the 320px invitation screenshot.
  Browser rendering is not Gmail/Outlook/Apple Mail inbox validation. No real
  emails, live Firebase calls/mutations, lint/typecheck/build or deployment run.
  Hosting redeploy and an explicitly authorized controlled delivery test remain.

## Admin Users internal-ID cleanup (21 October 2026)

- Removed the redundant Hospital [database ID] suffix from Admin user cards.
  Existing account name heading, email, phone and status remain. The underlying
  hospitalId association is unchanged; no extra lookup/request was introduced.
- Two focused phone/desktop browser-fixture checks passed, including preserved
  status and absence of Consumer removal controls in the Hospital account view.
  No lint/typecheck/build, deployment, API changes or live mutations performed.
- Patch version 4.4.0 to 4.4.1 synchronized. Consultant Charge rules were
  subsequently deployed with explicit authorization as noted below.

## Consultant Charge (21 October 2026)

- Owner requested a scoped firestore:rules deployment on 21 October. The CLI
  failed because saved Firebase credentials expired; no rules were released.
  Owner subsequently reauthenticated and explicitly requested the retry.
  Firebase successfully compiled and released firestore.rules to ayursarga-connect
  on 21 October 2026. No hosting, indexes, Storage rules or operational data
  changed. Generated debug logs were removed. No version bump for deployment.
- Admin consultant create/edit forms include optional Consultant Charge (INR).
  Shared validation parses blank/missing values to null, preserves deliberate
  zero, and rejects negative/non-numeric/unsafe amounts or more than two decimal
  places. Cards display formatted INR or Not specified; edits prepopulate it.
  Older records remain supported without a backfill or invented zero charge.
- The existing creation API and audited client edit service both reuse this
  validation; no duplicate endpoint added. Both Firestore full-document and
  changed-field allowlists now include consultantCharge, with optional numeric
  validation. Role restrictions, status-only transitions and audit linkage stay.
- Ten focused unit/API/source-contract tests and three browser checks passed
  (Chromium 320px phone, desktop, WebKit phone fixtures). Covered actual creation
  handler with mocked Admin auth/transaction, audited edit payloads, invalid and
  blank/zero charges, legacy edit/reopen, field errors and stored display values.
  Source-contract checks do not prove deployed-rule behavior; no emulator/live
  Firebase save or physical-device checks performed. No lint/typecheck/build run.
- Updated Firestore rules are now deployed, including Consultant Charge field
  and changed-field permissions. Authenticated live saves still require browser
  verification; application hosting was not deployed in this operation.
- Minor version 4.3.0 to 4.4.0 synchronized; no dependency changes. Earlier
  immediate-booking work and unrelated next-env.d.ts change were preserved.

## Immediate confirmation for new bookings (21 October 2026)

- Owner changed the booking policy: new Consumer bookings are confirmed on
  successful placement, without Hospital approval. The authenticated server
  transaction still checks active/public centre, active owned package, approved
  blocked dates, pricing, bystanders and mandatory versioned consent. Now writes
  confirmed status, confirmedDate equal to start/EDD date, confirmedAt equal to
  creation timestamp, null exact time, and not_started treatment. Creation, audit,
  canonical reference and Admin/Hospital notifications remain one atomic commit.
- Reused strict shared India care-date parsing so invalid calendar dates cannot
  roll over into automatically confirmed bookings. Request idempotency remains;
  retrying existing historical requested bookings never upgrades their status.
- Updated booking form, consumer history/help and public Why Ayursarga approval
  wording. Hospital dashboard counts confirmed bookings rather than new requests.
  Existing confirmed-state actions already allow starting treatment/rescheduling;
  kept legacy request actions, cancellation and later treatment transitions.
- No room inventory reservation or per-day capacity ledger was added. Current
  availability is approved date blocking, not guaranteed room-level capacity;
  room occupancy remains separately managed. Legal documents were not rewritten.
- Twenty-six distinct focused API/unit checks passed across booking-flow,
  portal-mutations, date-format and sold-out tests;
  final booking-flow/portal-mutation run passed all 17 after two added regressions.
  Twelve browser checks passed on Chromium phone/desktop and WebKit phone fixtures,
  covering all three roles, immediate confirmation, consent and legacy actions.
  The final Help/Why text edits were source-reviewed after those browser runs.
- No emulator/live API/physical-device validation, lint, typecheck, build or
  deployment run. No Firestore rules/index/schema change required: server-only
  creation remains denied to browser SDK clients, cancellation/treatment rules
  already accept confirmed bookings. App hosting must be redeployed to publish.
- Minor version 4.2.5 to 4.3.0 synchronized. AGENTS.md records this workflow.

## Booking date label expansion (20 October 2026)

- Changed the booking label to Preferred start date / Expected Delivery Date and
  updated the matching browser-test locator. Date behavior is unchanged.
- Patch version 4.2.5 synchronized in both package files. No validation commands
  or deployment run for this wording-only change; checks below predate it.

## Requested validation at 4.2.4 (20 October 2026)

- On the owner's subsequent request, ESLint completed with zero warnings/errors,
  npm run typecheck passed, and the production build completed successfully,
  including generation of all 62 static pages. No source fixes were needed.
- Removed generated tsconfig.tsbuildinfo after validation. No API checks,
  deployment or live mutations were performed; no validation-only version bump.
  These results supersede the earlier no-build/lint notes for preceding changes.

## Consumer booking care preferences (20 October 2026)

- Removed the preferred end-date control, its state and validation from the new
  booking form. Label is now Preferred start date / EDD; the existing search
  startDate context prepopulates it, otherwise the consumer selects a date.
  Legacy URL end dates are ignored by this form; new requests send null for the
  optional preferredEndDate. Historical records and API schema remain unchanged.
- Book Appointment stays disabled until booking confirmation is checked, and
  becomes disabled again when unchecked. Existing unavailable/sold-out/loading
  and busy guards, submit validation, and server-side versioned consent remain.
- Reviewed caller/service/consumer booking API: null end dates are supported,
  date-only requests use existing India care-date validation; no Firestore rule
  change or deployment required for these UI changes.
- 12 focused booking-flow/date unit tests and 9 booking browser regressions
  passed across Chromium phone/desktop and WebKit phone fixtures. Tests cover
  empty-date validation, prefill, end-field removal, consent toggling, submission
  and sold-out dates. No physical-device/live API checks, lint, typecheck, build
  or deployment run. Version 4.2.3 to 4.2.4 synchronized in both package files.

## Consultant detail alignment (20 October 2026)

- Follow-up compactness request: reduced consultant-only card padding to 18px,
  card gap to 10px, detail margins/gaps, label spacing and name size to 20px.
  Details now use three equal columns on wider screens, two at <=1000px;
  availability/address remain full-width, with available slots wrapping inline.
  No fields or actions removed; edit forms and backend behavior preserved.
  Version 4.2.3 synchronized. Source inspection only; no new browser, lint,
  build, API checks or deployment. Supersedes the two-column desktop choice below.
- Replaced the auto-fit consultant detail grid with two predictable minmax(0,1fr)
  columns. Availability and address now span the full row rather than two of an
  arbitrary number of columns; detail values explicitly reset browser dd margins.
  Existing phone spacing, fields, actions and backend behavior are unchanged.
- Patch version 4.2.1 to 4.2.2, synchronized in both package files. Source review
  only; no new browser checks, lint, build, API checks or deployment performed.

## Consultant update permission fix (20 October 2026)

- Found a confirmed rules mismatch: hasValidConsultantFields accepted designation,
  preferredTimeSlots and preferredSlotTimings, but the consultants update action's
  affectedKeys allowlist omitted all three. Even updating legacy records could
  fail because shared validation supplies these optional fields on save.
- Added only those three keys to the profile-update allowlist. Admin-only access,
  validation, immutable identity/creation metadata, linked atomic audits, separate
  status transitions and denied deletion are unchanged. The existing save path
  uses the client Firestore SDK, not the consultant creation API.
- Owner subsequently authorized redeployment after authentication. Firebase
  successfully compiled and released the corrected rules to ayursarga-connect
  on 20 October 2026. Deployment was scoped to firestore:rules only; no indexes,
  Storage rules, hosting or operational records were changed. Authenticated
  consultant save behavior still requires verification in the owner's browser.
- Six focused consultant tests passed, including a new source-contract check
  comparing all validated profile keys with the update allowlist. This is not
  emulator coverage or proof of deployed authorization. No live save, build,
  lint or production mutation was run during implementation. Rules deployment
  was completed separately with the owner's authorization as recorded above.
- AGENTS.md now requires affected API/SDK authorization, schema and audit review
  plus focused local regression checks for persistence/workflow updates. This
  targeted-check exception does not authorize broad checks or live operations.
- Patch version bumped from 4.2.0 to 4.2.1 in package.json and package-lock.json.

## Automatic versioning decision (20 October 2026)

- Owner approved agent-managed semantic version bumps for future completed
  implementation tasks: patch for compatible fixes/polish/performance, minor for
  compatible features, major for approved breaking changes. Bump once per task or
  explicitly grouped change set and keep package.json/package-lock.json in sync.
- Documentation-only changes, reviews and validation alone do not bump versions.
  No watcher, Git automation or deployment was introduced. This rule addition
  does not retroactively bump earlier changes. No validation commands were run.

## Search prompt typography (20 October 2026, after build validation)

- Centre/location and Start date / expected delivery date placeholders are now
  13px, normal-weight sage text, scoped to the public search fields. Entered
  values, labels, input dimensions and date behavior are unchanged.
- Package to compare uses 13px desktop text, normal-weight sage for its empty
  prompt, and stronger forest text for a selected package. Mobile controls retain
  16px sizing by default to avoid iOS focus zoom.
- At the owner's request, only Android's empty comparison package prompt is
  reduced to 13px under the existing mobile/coarse-pointer media rule. The select
  is marked through a ref in a mount effect using the Android user-agent token;
  server and initial client markup remain identical. Selected values, iOS/iPadOS
  and desktop behavior are unchanged. No shared platform abstraction was added.
- These subsequent typography changes received source inspection only, not new
  lint, build, typecheck, browser tests or real-device validation. The successful
  checks below predate them. No deployment or cloud writes were performed.
- AGENTS.md now records date-format preservation, the mobile sizing exception,
  and the owner's explicit-request-only validation preference.

## Cleanup and requested build validation (20 October 2026)

- On the owner's explicit request, ran ESLint, typecheck and the production
  build against the current worktree. All passed; final ESLint has zero warnings.
- Fixed three DateInput hook-dependency warnings without changing its behavior.
  Removed a redundant contract-date wrapper, a booking date-format alias, and
  an ineffective grid declaration on flex-based public package cards.
- Reviewed source references; no additional source files were confirmed unused.
  Retained authentication services, idle-session handling, tests and moved configs.
- All 15 focused date-format, booking-flow and sold-out availability regression
  tests passed. No live API checks, deployment or cloud data changes were made.
- Removed generated tsconfig.tsbuildinfo after validation. Unrelated existing
  changes, including public imagery, were preserved.

## Hospital gallery uploads

- Firebase Storage uploads are authorized on Blaze for Admin and the assigned
  active Hospital. The shared `HospitalImageManager` uses
  `/api/hospitals/[hospitalId]/images`.
- Server checks authorization, validates/re-encodes images with Sharp, creates
  480/800/1200-pixel 4:3 WebP variants, and atomically updates the gallery and
  audit record. Maximum: 10 gallery entries. Gallery removal retains files.
- Configure server-only `FIREBASE_STORAGE_BUCKET`; never expose Admin credentials.
  Direct browser Storage operations are denied by `storage.rules`.
- Consumer galleries decode the next image before displaying it, use responsive
  variants, and limit neighbor preloading on slow/data-saving connections.
- Removed the obsolete HTTPS image-entry form/component and unused styles.
  Uploads remain; Admin map editing is separate. URL rendering/validation helpers
  remain necessary for saved upload download URLs and supported legacy data.
- At the owner's explicit request, cleared 9 image references across 2 hospital
  galleries in `ayursarga-connect`. Verification found no remaining gallery
  references. Previous links were preserved in atomic audits; no Storage files
  were deleted. `scripts/clear-hospital-galleries.mjs` is read-only by default;
  **do not rerun with `--apply` without fresh explicit authorization**.
- Upload rules and endpoint changes were not deployed in this session. Real
  authenticated uploads and physical Android/iOS rendering remain unverified.

## Shared dialogs and notifications

- `ModalLayer` renders at body level so transformed parents cannot capture
  fixed dialogs. It handles visual viewport changes, focus containment and
  restoration, Escape/backdrop behavior, and nested modal layers.
- `utils/documentScrollLock.ts` provides reference-counted scroll locking and
  restoration, including fixed-body handling for iOS. SmoothScroll respects
  the shared lock. Do not add competing per-screen locks.
- Confirmations use `PortalDialog`; contract previews and public login use the
  same modal infrastructure.
- Toast recurrence was traced to restarting animation on parent renders and
  retained message state without stable event identity.
- `useRepeatableMessage` returns the value, setter, and notification event.
  Forward that event to feedback/toast components. `PortalToastViewport` is the
  persistent root renderer; `utils/toastNotifications.ts` owns lifetime,
  consumption, cleanup, and suspended-tab expiry. Normal/error lifetimes are
  6/8 seconds. New real actions can repeat a message; stale events cannot replay.

## Portal performance changes

- Admin hospital saves previously cleared/remounted the details page and
  refetched its hospital, package, and room panels before success feedback.
- Common hospital edits, map changes, contract particulars, editorial assessments,
  and supported actions now merge server-confirmed changed fields locally.
  Activation still reconciles server state; setup emails still await completion.
- Hospital room updates and booking/treatment changes use committed mutation
  results rather than unnecessary follow-up reads. Filtered bookings are removed
  locally when their new status no longer matches the current filter.
- Consultant status updates and unfiltered edits patch local records; creation
  and search-sensitive edits retain reconciliation where needed.
- Independent Hospital/service, Hospital/booking, and Hospital/capacity reads use
  Firestore `getAll`. Image uploads reuse the initial gallery count, while the
  final transaction still enforces the gallery limit.
- `services/api/mutation.ts` encodes server Timestamp values in committed deltas;
  `authorizedMutationRequest` restores client Timestamp objects. It rejects
  incomplete mutation responses rather than claiming success.
- `utils/inFlightRequests.ts` shares overlapping identical authenticated JSON
  mutations per user. It does not cache completed outcomes or automatically retry
  writes. Binary uploads and caller-abortable requests remain independent.
- Updated server writes use update-time/create preconditions where applicable
  to reject concurrent conflicts. Atomic audits, role checks, token revocation
  checks, and server validation remain in place. No sensitive-data cache added.

### Measurements and validation

- Six alternating read-only Firestore samples: median sequential two-document
  reads approximately 295 ms; batched reads approximately 152 ms. Network varied.
  Reproduce with `node scripts/profile-portal-reads.mjs` only when a live read-only
  probe is in scope. It logs timings, not document data or credentials.
- Production-React browser fixture with simulated 150 ms writes/200 ms reads:
  room-save median approximately 363 ms before versus 157 ms after; post-save
  reads reduced from 1 to 0. These are controlled UI-chain measurements, **not
  deployed authenticated API or cold-start measurements**.
- Completed: ESLint, typecheck, production build; 8 unit/API regression tests;
  4 desktop/tablet performance tests; 24 toast tests; 23 dialog checks, with one
  desktop-only touch check skipped. Two mobile dialog checks were rerun and
  passed after parallel suites collided on trace artifacts.
- Playwright fixture configurations now have separate artifact directories.
  The fixtures do not mutate live cloud data. Relevant commands:
  - `node --test --test-isolation=none tests/unit/portal-mutations.test.mjs`
  - `npm.cmd run test:e2e:performance`
  - `npm.cmd run test:e2e:dialogs`
  - `npm.cmd run test:e2e:toasts`
- Windows PowerShell script execution restrictions require `npm.cmd`/`npx.cmd`
  here. Chromium may require approved execution outside the process sandbox.
- No rules/index deployment or live mutations were performed for performance
  testing. Deployed authenticated latency, cold starts, and real-device behavior
  still require measurement. Do not claim all application workflows were tested
  end-to-end against production.

## Latest small changes

- App-managed full dates now display as zero-padded DD/MM/YYYY through
  `utils/date.ts`. Includes strict date-only/DD/MM parsing, India-timezone
  display and calendar boundaries, timestamps/date-time labels, booking detail
  cards, availability ranges/dialogs, audit rows, notifications, guidance/contact
  summaries, health-page timestamp and populated contract dates. Existing
  generated notification messages normalize legacy date labels on display only.
  User-authored free text and protected legal copy are not rewritten. Month-only
  filters/time-only consultant preferences remain semantically unchanged.
- Shared `components/forms/DateInput.tsx` is used for all former full-date
  inputs: fixed-format text with numeric-keyboard slash insertion, strict
  validation, a retained native calendar, and named ISO form values. Supports
  controlled/uncontrolled fields, clearing, min/max, disabled state, resets,
  contract expiry's programmatic input update and accessible labels. Safari
  input/change commits are published immediately and deduplicated. Native OS
  calendar language/layout remains device-controlled; app field display is fixed.
- Booking clients serialize the intended India calendar date without reversing
  day/month or shifting at UTC midnight. API date formats/schema, timestamp
  storage, historical records and contract filenames remain unchanged. No live
  data migration, Firebase rules change, deployment, build or lint was performed.
- Validation: typecheck and 26 focused unit tests passed, including strict/leap
  dates, midnight/overseas timezones, ISO booking payloads, booking/audit/
  notification atomicity and guidance flows. Browser checks covered DD/MM typing,
  native selection and reset, search/centre date context and booking links,
  blocked dates, consent submission, availability confirmations and role-specific
  booking cards. Final responsive scan of 18 Admin/Hospital screens each on
  Chromium phone/desktop and WebKit phone found zero overflow. Early test failures
  exposed and led to fixes for accessible-name contamination and Safari native
  input-before-change behavior; affected checks then passed. No physical-device
  test or live endpoint check was performed.

- Centre details Available Packages now uses two compact columns on mobile,
  tablets and desktop. Cards stack their content and keep 44px booking actions
  aligned at the bottom, with wrapping procedure rows and unchanged emerald/white
  styling. Long descriptions are summarized to three lines only when View more
  can reveal the complete text and procedures. Packages without expandable
  procedures keep their full descriptions. Gallery/media and booking links,
  prices, package order and sold-out guards are unchanged.
- Validation: typecheck, 14 initial responsive package-grid/sold-out checks and
  7 final compact-summary/expansion checks passed on Chromium phone, landscape,
  portrait/landscape tablets, desktop and WebKit phone/tablet fixtures. Reviewed
  the 320px package screenshot. No physical-device test, lint/build, deployment,
  backend changes or live mutations. The existing centre-search test config now
  includes the new isolated centre-details fixture/spec.

- Compare Care Options now loads public details for only its two selected centres
  in parallel with packages, with shared cancellation/version guards. Uses actual
  facility data, existing normalization/icons and an empty-state message. Displays
  six facilities initially with a disclosure for the remainder. Does not expand
  the lightweight hospital search projection or refetch when switching durations.
- Comparison details links are full-width emerald View Centre Details buttons.
  Comparison retains two columns on narrow mobile, portrait/landscape, tablets
  and desktop with compact wrapping, responsive images, aligned button bottoms,
  44px touch targets and focus states. Public design/selection logic preserved.
- Validation: typecheck and 20 focused browser checks passed (12 initial
  comparison regressions, 6 final layout/request-count checks and 2 full search
  integration checks). Chromium widths 320/390/768/844/1440 and WebKit phone
  fixtures were covered; physical iOS/Android remain untested. No lint/build,
  cloud writes or deployment. A final CSS list-padding reset received diff review.

- Stress Management now asks “What kind of wellness experience are you looking
  for?” and is single-select. Psychologist consultation reuses the same single
  online-provider card and inactive booking placeholder as Prenatal/Rejuvenation,
  without district/date fields. Non-consultation choices retain their guidance
  flow. The shared online-consultation branch avoids duplicate provider markup.
  Eight focused flow tests and typecheck passed; other categories' behavior is
  covered by regressions. No lint/build/deployment or real-device testing.

- Rejuvenation options are now single-select: Detox & Panchakarma and
  Cosmetologist consultation. Removed Private stay and separate detox/Panchakarma
  choices; its question is Explore Your Wellness Options. Cosmetologist uses
  the shared responsive online-provider card (same inactive booking placeholder
  as Prenatal), without location/date fields. Detox keeps the guidance flow;
  other categories' selection behavior and the main section heading are unchanged.
  Eight focused guidance/provider tests and typecheck passed. No build/lint,
  deployment, live writes or real-device testing was performed.

- Removed Budget Preference from every Wellness Path, including its state,
  request summaries and contact handoff. Guidance profiles no longer require
  budget; older session preferences remain readable but their budget is ignored
  in summaries. Other fields and navigation remain unchanged. Typecheck and five
  focused guidance/prenatal tests passed; no lint/build or deployment.

- Prenatal Wellness Path step two now filters provider cards by the selected
  service: Pregnancy yoga -> Yoga instructor, Dietary advice -> Dietitian,
  Doctor consultation -> Doctor. Reuses the existing responsive single-provider
  layout. Back/Continue/path navigation and disabled booking placeholders are
  unchanged. Three focused render regression tests and typecheck passed; no
  lint/build or live mutations. No new real-device test was performed.

- Approved availability blocks no longer remove matching centres from public
  search. Search/cards, comparison and centre details derive a Sold Out state
  from approved date ranges, using selected care dates or today in India when
  none is selected. Overlap includes the block's start/end calendar dates.
  Unaffected dates stay bookable; cancelling a block clears the derived status
  on the next fresh load. No new persisted flag or live listener was introduced.
- Search cards navigate only through the View centre details button; removed the
  full-card link overlay. Galleries remain interactive. Details and booking forms
  disable actual booking buttons for blocked dates; server-side block validation,
  approval/cancellation transactions, visibility and auditing are unchanged.
- Public hospital list/detail projections now return no-store responses to avoid
  stale approved/revoked ranges on fresh loads. Service/image caching remains.
  Comparison uses current search dates/links even after its selection is made.
- Validation: 3 availability unit tests, typecheck, 10 search responsive fixtures
  and 5 blocked-booking fixtures passed across Chromium phone/landscape/tablet/
  desktop and WebKit phone. No build/lint, live mutations or deployment.

- Consumer profile Save/Save and continue is disabled until a required consent
  checkbox is selected. Existing current-version consent is still accepted;
  mandatory validation remains in place. Typecheck passed; no build/lint.
- Admin and Hospital bookings now reuse `PortalBookingSummary` and consumer-card
  styling with labeled centre/package/customer/contact/date/bystander details,
  notes and status. Only Admin renders estimated commission. Hospital actions
  and financial snapshots are unchanged. Internal hospital/package IDs are not
  used as card labels when descriptive names are missing.
- `withPortalBookingDetails` uses the existing bounded, deduplicated ID reader
  in parallel for missing legacy hospital/package labels, with Hospital-scoped
  service queries and package-ownership checks. Consumer flows remain on their
  existing ownership-checked endpoint. No persisted booking rewrite or new API.
- Booking-card validation: typecheck, 3 unit tests, and 10 focused Playwright
  tests passed on phone/landscape/tablet/desktop Chromium and WebKit phone
  fixtures. No build/lint, cloud writes, or deployment; physical devices were
  not tested.

- Contract and approval timeline: completed steps display white SVG ticks in
  existing emerald circles; incomplete steps retain numbers. Scoped label colors
  so label rules cannot override white marker icons. No workflow/layout change.
- Expanded `.gitignore` for local secrets/settings, build/deployment caches,
  emulator exports, test/coverage/performance artifacts, logs, and scratch files.
  `.env.example`, source, public assets, tests, shared `.agents/skills`, Firebase
  rules/configuration, and lockfiles remain trackable. Verified ignore rules;
  no tracked files were untracked and no user files were deleted.
- The timeline and ignore-rule edits received diff/targeted checks only; the
  broader build/lint results above predate those small changes. Do not run new
  lint/build/API checks for a documentation-only handoff.

## Pending deployment and safety reminders

- v4.10.2: Admin/Hospital reset forms now show an immediate local sending state,
  full-contrast disabled submit button with spinner, aria-busy and a persistent
  wait message explaining that confirmation may take seconds. Hospital email is
  read-only during submission. Pending state clears on success/failure; the
  existing final confirmation, errors and duplicate-submit guard are preserved.
  Spinner respects reduced motion. No API or email delivery behavior changed.
  Existing reset regression passed on desktop/WebKit phone for both roles;
  no build/lint or live email request was run for this UI adjustment.

- v4.10.1: reviewed reset account isolation and email workflow latency. Hospital
  request metadata cannot override the server-derived recipient/role; Firebase
  generates codes for the selected account's email. URL role/kind only control
  page copy and fixed return links, not the account updated by Firebase.
- Shared concurrent verification for identical codes now uses one in-flight
  request, removed on success/failure. Isolated before/after measurement of two
  simultaneous checks: 2 Firebase SDK calls before, 1 after. No completed result
  or reset code is persisted/cached. Different codes and later retries stay fresh.
  SMTP pooling already exists; no speculative server latency gains claimed.
  Sixteen focused reset/invitation/account-isolation/service tests passed.
  No live reset/email or production latency test, build/lint, or deployment.

- Owner-requested v4.10.0 validation completed: lint initially found a direct
  effect state update in PasswordActionForm; moved role/invitation updates into
  the verification completion callback. Rerun lint passed without warnings;
  fresh production build passed TypeScript and generated 69 pages. Desktop and
  WebKit-phone reset/invitation regressions passed again after the correction.
  That exact build's temporary production server returned HTTP 200 for deep
  health JSON (deep-configuration, all 5 dependencies ready), themed deep health
  page and `/auth/reset-password` (branded checking state, no-referrer metadata).
  Temporary server stopped. Configuration health does not prove live delivery.

- Added `/auth/reset-password` for branded Admin/Hospital resets and Hospital
  invitations. Shared sendAuthEmail extracts the Firebase-generated reset code
  and builds the email button/text URL from canonical APP_SITE_URL. Role/kind
  and the single-use code are in a browser fragment, never HTTP query logs.
  No Firebase template-editor change is required. Existing emailed Firebase
  action links remain valid; new custom links require deploying this page.
- The shared Firebase Auth client verifies and confirms reset codes; the page
  validates matching strong passwords, guards duplicate submits, handles invalid,
  expired/used links, clears the fragment after success and links to the selected
  role's fixed login path. Role/kind affect presentation/navigation only. No Auth
  profile/Firestore writes, auto-login, custom tokens or new permissions added.
- Validation: 14 focused reset/invitation API/service tests passed and 2 browser
  regressions passed (desktop, WebKit phone), each covering Admin reset, Hospital
  reset, Hospital invitation and an invalid link. Browser tests use isolated
  Firebase mocks; no live code was consumed and no email sent. Build/lint were
  not requested for this task. Version 4.10.0.

- Fixed reset confirmation loss in both Admin and Hospital pages: GuestOnly
  previously replaced its children whenever AuthContext.processing set isLoading
  during the request, unmounting ForgotPasswordForm and discarding its sent state.
  It now shows the initial fallback for status=loading or a same-role session,
  keeping guest forms mounted during operations. Redirect checks remain guarded.
  Reset fixtures now include the actual GuestOnly boundary and shared processing
  notifications; both role flows passed desktop and WebKit-phone regression
  tests with persistent confirmation and single submission. Earlier isolated
  form tests did not exercise this parent lifecycle. Version 4.9.2. No new
  build/lint or live email request was run for this fix.

- Reviewed Hospital login/reset alongside Admin: Hospital reset retains the
  official-email input and persistent generic acknowledgement. Shared login now
  guards duplicate submissions synchronously and displays persistent inline
  credential errors; shared reset also retains inline API errors beside its
  submit button. Four focused desktop/WebKit-phone tests passed for both roles,
  covering reset acknowledgement, duplicate login requests, inline errors and
  retry availability. No live authentication/email test or build/lint run.
  Version 4.9.1.

- Admin Forgot Password no longer asks for an email address. It always submits
  the shared approved Admin address (`info@ayursarga.com`), which is also reused
  by the Admin bootstrap guard. The reset API now refuses delivery for any other
  Admin address while preserving the same generic public response for account
  enumeration protection. Hospital reset remains email-based. Successful reset
  requests render a persistent in-page acknowledgement rather than relying on a
  temporary toast. Validation: 9 focused auth-email/API tests and 8 responsive
  portal UI projects passed, including WebKit phone. No live email was sent and
  SMTP inbox delivery was not tested. Version 4.9.0.

- The Ayursarga company GSTIN in generated and previewed partner contracts is
  now the confirmed `32ABGCA7749G1ZL`; the former company placeholder was
  removed. Partner Centre GSTINs remain hospital-specific particulars. A focused
  contract-rendering regression confirms the company value is present and the
  placeholder is absent. Version 4.8.4.

- Admin audit-clear confirmation now gives the shared `PasswordField` complete
  dialog-level sizing and positioning instead of falling back to browser-default
  input layout. The password remains masked by default, the reveal control is
  centered and keyboard focused, and cancelling/reopening clears the value and
  restores the masked state. Clear-audit authorization and deletion behavior are
  unchanged. Focused dialog regression passed on all 8 portal UI projects,
  including narrow phones, tablets, desktop and WebKit phone. Version 4.8.3.

- Admin availability approvals/rejections now use `PortalDialog` with explicit
  Confirm/Cancel, emerald/red semantics, a synchronous duplicate-submit guard,
  busy dismissal protection, and inline failure feedback. Cancel makes no call.
- Consultants now support optional designation, multiple preferred slot keys
  (`morning`, `noon`, `evening`), and editable per-consultant start/end times in
  `preferredSlotTimings`. Defaults are 09:00–12:00, 12:00–15:00, 15:00–18:00;
  old records remain supported. Shared validation handles form/API/service data;
  existing atomic audited create/update paths are unchanged.
- Consultant rule allowlists/validation were extended for these optional fields.
  On 20 October 2026, the owner authorized deployment: Firebase compiled and
  released `firestore.rules` successfully to `ayursarga-connect` using the scoped
  `--only firestore:rules --non-interactive` command. No indexes, Storage rules,
  application hosting, or operational records were changed by this deployment.
- Validation: typecheck, 5 consultant unit tests, and 10 focused Playwright tests
  passed across Chromium phone/landscape/tablet/desktop and WebKit phone fixtures.
  Build/lint were deliberately not run. Physical iOS/Android remain unverified.

- No deployment was requested for the latest changes. Do not deploy implicitly.
- Do not replay gallery clearing or any live test mutation as a validation step.
- Keep operational/history data and uploaded files; gallery removal is unlinking,
  not permanent file deletion. Follow the audit/preservation policy in `AGENTS.md`.
- No credentials or `.env.local` contents belong in notes, logs, or GitHub.
