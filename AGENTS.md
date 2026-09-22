# Ayursarga implementation guardrails

These instructions apply to the entire repository. Preserve them in future
implementation work unless the project owner explicitly changes a decision.

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
- Do not enable Firebase TTL. Do not introduce Cloud Functions or Storage unless
  a later phase explicitly authorizes them.

## Role-facing data and controls

- Never render Admin management controls or Admin-only management details in
  Consumer or Hospital components. This includes commission management,
  contract generation/signing/URLs, activation, public visibility, audit data,
  archive controls, and platform settings.
- The Hospital Profile may edit only hospital name, official email, owner
  WhatsApp number, required primary hospital phone, optional secondary hospital
  phone, city/locality, district, state, complete address, optional description, the default
  centre-guideline wording, additional centre rules, facilities, and
  centre-specific legal/policy information. Hospital image links and the
  validated Google Maps or OpenStreetMap location link are Admin-managed.
  Admin may paste a supported map iframe snippet, but application code must
  extract and store only its validated HTTPS `src` URL. Public centre details
  render that URL in a responsive map frame and retain an external maps link;
  never store or render arbitrary iframe HTML.
  Normalize supported Drive sharing links for display and keep gallery frames
  at a consistent 4:3 ratio. Firebase Storage and direct uploads remain disabled
  while the project uses the Spark plan.
- Admin alone controls hospital images, centre location, commission,
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
- The accepted current scope does not require mirrored public/private hospital
  collections because Firebase project access is controlled by trusted Admins.
  Do not introduce that migration casually. If future requirements demand
  field-level confidentiality from an SDK client that may read the document,
  document and review a public/private split first because Firestore cannot
  return only selected fields from an allowed document read.

## Hospital and booking workflow

- New hospitals start `pending` and private. Description and the secondary
  hospital phone are optional; required creation fields are hospital name,
  official email, owner WhatsApp number, primary hospital phone, city/locality,
  district, state, complete address, and commission percentage.
- Activation requires contract generation, signed-contract confirmation, and a
  valid URL and signing date for each of the two required contracts. Preserve
  created, both signed, and activated dates and audit each transition.
- Consumer booking creation snapshots service price and commission values for
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

- Reuse existing services, validation, helpers, and components. Avoid duplicate
  folders, parallel abstractions, and speculative dependencies.
- Do not hardcode Firebase Web SDK credentials in components. Keep client
  configuration centralized and environment-driven; initialize Firebase once.
- Preserve unrelated working-tree changes. Remove generated debug logs and
  `tsconfig.tsbuildinfo` after validation if they appear.
- For relevant changes run ESLint and `npm run typecheck`; use `npm run build`
  for routing, configuration, or production-sensitive changes.
- Firestore rule/index changes are not live until deployed to
  `ayursarga-connect`. Use a scoped, non-interactive Firebase deployment and
  report whether an index is still initializing.
