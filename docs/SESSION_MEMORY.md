# Session handoff

Updated: 23 October 2026 (Asia/Calcutta).

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
