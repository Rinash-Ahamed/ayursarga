# Session handoff

Updated: 21 October 2026 (Asia/Calcutta).

This file records completed work and verification limits. `AGENTS.md` remains
the implementation authority; these notes do not authorize deployments or data
maintenance. Preserve unrelated working-tree changes; the workspace contains
substantial uncommitted work across multiple tasks.

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
