# Ayursarga implementation guardrails

These instructions apply to the entire repository. Preserve them in future
implementation work unless the project owner explicitly changes a decision.

## Product and design preservation

- Preserve the existing public website's pages, content, layout, palette,
  typography, animations, spacing, brand identity, and working behavior.
- Keep `/`, `/app`, `/hospital`, and `/admin` as separate route and code
  boundaries. Do not load portal modules into the public route unnecessarily.
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
- Public registration always creates a Consumer. Hospital and Admin accounts
  are created only through a controlled privileged process.
- Protect every portal page with its matching `RequireRole`. Unauthorized users
  must be redirected to their correct portal; unauthenticated users go to the
  relevant login page.
- Retain the 15-minute inactivity sign-out for authenticated portal sessions.
- Do not replace login navigation with a remembered user/profile button on the
  public website.

## Data preservation and audit

- Never add `deleteDoc`, permanent-delete helpers, cascading deletion, TTL, or
  automatic data-removal behavior for operational or historical records.
- Use audited archive/restore transitions. Preserve document IDs and the
  standard `created*`, `updated*`, `archived*`, and `lastAuditId` metadata.
- Firestore rules must keep permanent client deletion denied. Audit logs remain
  append-only, immutable through normal application access, and readable only
  by active Admin users.
- Critical creates, updates, archive/restore operations, status changes,
  contract actions, and booking changes must write their audit record in the
  same atomic batch.
- Firebase Console and service-account access are trusted-Admin-only. Admin SDK
  code bypasses Firestore rules, so any future privileged script must implement
  the same preservation and audit policy explicitly.
- Do not enable Firebase TTL. Do not introduce Cloud Functions or Storage unless
  a later phase explicitly authorizes them.

## Role-facing data and controls

- Never render Admin management controls or Admin-only management details in
  Consumer or Hospital components. This includes commission management,
  contract generation/signing/URLs, activation, public visibility, audit data,
  archive controls, and platform settings.
- The Hospital Profile may edit only hospital name, official email, phone,
  city/locality, state, complete address, and optional description.
- Admin alone controls hospital commission, Pending/Active state, contract
  workflow, signed-contract URL, visibility, activation, and archive/restore.
- The Admin Users page keeps Consumer and Hospital accounts in separate
  role-filtered views. Admin accounts are not mixed into either list.
- The accepted current scope does not require mirrored public/private hospital
  collections because Firebase project access is controlled by trusted Admins.
  Do not introduce that migration casually. If future requirements demand
  field-level confidentiality from an SDK client that may read the document,
  document and review a public/private split first because Firestore cannot
  return only selected fields from an allowed document read.

## Hospital and booking workflow

- New hospitals start `pending` and private. Description is optional; required
  creation fields are hospital name, official email, phone, city/locality,
  state, complete address, and commission percentage.
- Activation requires contract generation, signed-contract confirmation, and a
  valid signed-contract URL. Preserve created, signed, and activated dates and
  audit each transition.
- Consumer booking creation snapshots service price and commission values for
  historical consistency. Booking state changes must follow the transitions in
  `firestore.rules`.
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
