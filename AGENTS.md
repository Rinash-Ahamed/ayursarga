# Ayursarga implementation guardrails

These instructions apply to the entire repository. Preserve them in future
implementation work unless the project owner explicitly changes a decision.

For recent implementation history, validation results, and remaining limits,
read `docs/SESSION_MEMORY.md`. It is a handoff record, not additional authority
to deploy, rerun maintenance scripts, or modify live data.

## Product and design preservation

- Preserve the existing public website's pages, content, layout, palette,
  typography, animations, spacing, brand identity, and working behavior.
- Keep `/`, `/app`, `/hospital`, and `/admin` as separate route and code
  boundaries. Consumer discovery belongs on the public routes; `/app` is reserved
  for protected profile-completion and booking workflows. Do not load portal
  modules into the public route unnecessarily.
- Reuse the shared portal design system in `app/portal.css`. Maintain the
  existing cream, forest, clay, sage, rust, and Ayursarga botanical language.
- Portal hover feedback may change color or border. Do not move, scale, or lift
  cards, rows, navigation items, or buttons on hover because movement can cause
  visual collisions.
- Read the version from `package.json`; the portal footer receives it through
  `NEXT_PUBLIC_APP_VERSION` in `next.config.mjs`.
- Display full UI dates as DD/MM/YYYY using `utils/date.ts` and the shared
  `DateInput`. Preserve ISO/API/database formats and India care-date boundaries;
  do not parse day-first display strings with the native Date constructor.
- Keep search placeholders visually lighter than entered values. Preserve 16px
  mobile control sizing on iOS to avoid focus zoom. The comparison package
  dropdown has an explicitly requested Android-only 13px empty-prompt exception;
  do not apply it to selected values or other devices. Detect platform only after
  hydration, not during server/client initial rendering.
- Confirmation dialogs must use `PortalDialog`; other modal surfaces use the
  shared body-level `ModalLayer`. Reuse its reference-counted document scroll
  lock, focus containment and viewport handling. Never render a fixed dialog
  inside transformed page content or add competing per-screen scroll locks.
- Toasts use the shared notification lifecycle and root viewport. Pass the event
  identity returned by `useRepeatableMessage` to toast/feedback components so
  repeated real actions notify again without replaying old messages. Do not
  restart toast animations on renders or rely on CSS hiding as dismissal.

## Authentication and roles

- Use the single shared Firebase authentication context and services. Do not
  create separate authentication implementations for Admin, Hospital, and
  Consumer roles.
- Consumers authenticate only through Google. Their first sign-in creates a
  Consumer profile and requires a phone number before the Consumer application
  can be used; address is optional. Phone is contact data only; do not add SMS
  verification without a later explicit decision. Hospital and Admin accounts
  use email/password and are created only through a controlled privileged
  process.
- Consumer profile completion requires one versioned acceptance of the
  Ayursarga Customer Terms and Privacy Policy. Each booking request also stores
  its own versioned acceptance timestamp for the applicable Customer Terms,
  Cancellation and Refund Policy, and Patient/Service Disclaimer and Consent.
  Both acceptances are mandatory and auditable; do not rely only on unchecked
  client-side wording.
- Hospital activation provisions or reconnects one Firebase Authentication
  account for the hospital's official email and sends a Firebase password setup
  link. Never introduce a shared default password or store passwords in
  Firestore. Admin may resend the setup/reset link; Hospital users may change
  their password only after re-authentication.
- The verified server-only Admin bootstrap endpoint may recreate a missing
  `users/{uid}` profile only for the password-authenticated
  `info@ayursarga.com` Firebase account. Keep it email-locked, idempotent,
  audited, and unable to overwrite an existing conflicting profile. Never
  restore browser-side Admin creation or broaden this exception to other users.
- Protect every portal page with its matching `RequireRole`. Unauthorized users
  must be redirected to their correct portal; unauthenticated users go to the
  relevant login page.
- Retain the 15-minute inactivity sign-out for authenticated portal sessions.
- Keep one public Login action. Its popup offers Consumer Google sign-in on the
  current page and a link to Hospital Login; never expose Admin Login publicly.
  After Consumer sign-in, replace Login with the Consumer's Google profile control
  showing their name, email, and Logout action.

## Data preservation and audit

- Never add `deleteDoc`, permanent-delete helpers, cascading deletion, TTL, or
  automatic data-removal behavior for operational or historical records.
- Use audited archive/restore transitions. Preserve document IDs and the
  standard `created*`, `updated*`, `archived*`, and `lastAuditId` metadata.
- Firestore rules must keep permanent client deletion denied. Audit logs remain
  append-only through the client SDK and readable only by active Admin users.
  The project owner has explicitly authorized one exception: an active Admin
  may permanently clear `auditLogs` through the verified server endpoint and
  its confirmation-protected Admin UI. Never expose that operation to Hospital
  or Consumer users and never broaden it to operational records.
- Critical creates, updates, archive/restore operations, status changes,
  contract actions, and booking changes must write their audit record in the
  same atomic batch.
- Firebase Console and service-account access are trusted-Admin-only. Admin SDK
  code bypasses Firestore rules, so any future privileged script must implement
  the same preservation and audit policy explicitly; the audit-clear endpoint
  above is the only approved exception.
- Do not enable Firebase TTL or introduce Cloud Functions. Firebase Storage is
  authorized for hospital gallery images on the Blaze plan. Preserve uploaded
  files when removing gallery entries; never add automatic file deletion.

## Role-facing data and controls

- Never render Admin management controls or Admin-only management details in
  Consumer or Hospital components. This includes commission management,
  contract generation/signing/URLs, activation, public visibility, audit data,
  archive controls, and platform settings.
- The Hospital Profile may edit only hospital name, official email, owner
  WhatsApp number, required primary hospital phone, optional secondary hospital
  phone, city/locality, district, state, complete address, optional description, the default
  centre-guideline wording, additional centre rules, facilities, and
  centre-specific legal/policy information. Active Hospitals may also upload and
  remove gallery images for their own centre through the authenticated server
  image endpoint. Admin may manage images for any non-archived hospital. The
  validated Google Maps or OpenStreetMap location link remains Admin-managed.
  Admin may paste a supported map iframe snippet, but application code must
  extract and store only its validated HTTPS `src` URL. Public centre details
  render that URL in a responsive map frame and retain an external maps link;
  never store or render arbitrary iframe HTML.
  Normalize supported Drive sharing links for display and keep gallery frames
  at a consistent 4:3 ratio. Image uploads use Firebase Admin Storage through
  `/api/hospitals/{hospitalId}/images`, server validation/re-encoding, a maximum
  of 10 gallery entries, and atomic Firestore gallery/audit updates. Direct
  browser Storage access is denied by `storage.rules`; only individual gallery
  download-token URLs are public. Configure the server-only
  `FIREBASE_STORAGE_BUCKET` in local and hosting environments.
- Admin alone controls centre location, commission,
  Pending/Active state, contract
  workflow, signed-contract URL, visibility, activation, and archive/restore.
- The Admin Users page keeps Consumer and Hospital accounts in separate
  role-filtered views. Admin accounts are not mixed into either list. Removing
  a Consumer from this page is an audited archive: it revokes active application
  access and hides the profile from normal lists while preserving bookings and
  historical records. It must never delete the Firebase Authentication account
  or the Firestore user document.
- Our Consultants is an Admin-only operational collection. Consultant records
  do not create authentication accounts. Their IDs use the sequential `AS001`
  format, and creates, profile edits, and Active/Inactive changes are audited.
- Public centre discovery uses the bounded `/api/public/hospitals` server
  projection. Do not restore anonymous SDK reads of full `hospitals` or
  `services` documents: those records contain contract, commission, actor, and
  audit metadata. A mirrored public collection is not currently required; if
  one is proposed later, document and review the migration first.

## Hospital and booking workflow

- New hospitals start `pending` and private. Description and the secondary
  hospital phone are optional; required creation fields are hospital name,
  official email, owner WhatsApp number, primary hospital phone, city/locality,
  district, state, complete address, and commission percentage.
- Activation requires contract generation, signed-contract confirmation, and
  one valid signed-contract URL and signing date. Preserve created, signed, and
  activated dates and audit each transition.
- Consumer booking creation runs through the authenticated server endpoint and
  confirms new bookings immediately after checking current hospital/package
  eligibility and approved blocked dates in the same transaction. Set confirmed
  date to the selected start/EDD date, confirmedAt to the creation timestamp,
  leave exact appointment time unset, and begin treatment at not_started.
  Hospital approval is not required for new bookings. Preserve legacy requested
  records and their handling; do not silently migrate historical bookings.
  Blocked-date checks are not room-inventory reservation or capacity enforcement.
  Booking creation
  snapshots service price and commission values for
  historical consistency. It also snapshots the Consumer's name, Google email,
  phone, optional address, preferred care period, and bystander count so only
  Admin and the assigned Hospital can use
  the available details for that booking. Do not grant Hospitals general read
  access to Consumer profiles. Booking state changes must follow the transitions in
  `firestore.rules`.
- Keep appointment status separate from treatment progress. Hospital treatment
  progress follows `not_started` → `started` → `ongoing` → `completed` (with a
  direct `started` → `completed` option), and every transition is audited.
- Hospital room occupancy belongs in the single audited
  `hospitalCapacity/{hospitalId}` document. It is internal to Admin and the
  assigned Hospital, and either role may update its room totals from its own
  protected interface. Do not copy it into public Hospital data.
- Hospital services are duration-based packages using 7, 10, 14, 21, 28, or
  35 days. Each selected procedure stores its included day count in a keyed map
  so it cannot be duplicated within one package; the same procedure may appear
  in multiple packages. Package deletion remains an audited archive action.
- Active hospitals may have an Admin-controlled `ayursargaRating` and
  `ayursargaReviewNote`. Public UI must identify both as Ayursarga editorial
  content and must never present them as verified patient feedback. Hospitals
  and Consumers cannot edit these fields. Genuine booking-linked patient
  ratings, rating aggregates, and rating filters remain out of scope.
- Keep list reads bounded and cursor-paginated. Prefer Firestore count/sum
  aggregations for dashboard totals and deploy required indexes deliberately.
  Do not load complete collections or add realtime listeners without a genuine
  live-update requirement.

## Change discipline and validation

- Automatically bump the application version once per completed implementation
  task or explicitly grouped set of related changes, not per file edit, tool call,
  retry or validation run. Choose by user-facing impact, not line/file count:
  patch for compatible fixes, styling and performance improvements; minor for
  backward-compatible features or workflows; major for breaking changes. This
  rule does not authorize introducing breaking changes without owner approval.
- Keep the version in `package.json` and both application-version entries in
  `package-lock.json` synchronized without changing dependency versions. Continue
  deriving displayed versions through the existing Next configuration. Report
  the version change in the handoff. Do not bump for documentation-only changes,
  reviews, tests/checks alone, or work that has not been completed. Respect an
  explicit owner version override and do not re-bump the same completed task on
  continuation. This is an agent workflow rule, not a watcher for external edits;
  it does not authorize commits, tags, publishing or deployment.
- Reuse existing services, validation, helpers, and components. Avoid duplicate
  folders, parallel abstractions, and speculative dependencies.
- For each implementation update affecting persisted fields or workflows, trace
  the caller through the actual API or direct SDK write, shared validation,
  Firestore field allowlists AND changed-field allowlists, role authorization,
  atomic audit linkage, and legacy-record compatibility. Add or update focused
  local contract/regression checks for affected paths, including permission
  denials and allowed updates where the local test infrastructure supports them.
  These targeted checks are required; do not substitute a generic health endpoint
  or claim mocked/source checks prove deployed permissions. Report any missing
  emulator/live coverage and required rules/index deployment. This does not
  authorize production mutations, deployment or broader API/security audits.
- Do not hardcode Firebase Web SDK credentials in components. Keep client
  configuration centralized and environment-driven; initialize Firebase once.
- Preserve unrelated working-tree changes. Remove generated debug logs and
  `tsconfig.tsbuildinfo` after validation if they appear.
- Run ESLint, typecheck, build and API/full-site checks only when the owner
  explicitly requests them. When requested, run the relevant checks after the
  related changes are complete, not after every small edit. Prior authorization
  for one validation run is not ongoing authorization for later changes.
  The focused local regression checks required above are a standing exception;
  broader checks still require an explicit request.
- Firestore rule/index changes are not live until deployed to
  `ayursarga-connect`. Use a scoped, non-interactive Firebase deployment and
  report whether an index is still initializing.
