# Ayursarga application foundation

## Route boundaries

The public site remains at `/`. The consumer, hospital, and admin modules use
their own layouts and are compiled as separate Next.js route segments.

| Area | Routes |
| --- | --- |
| Consumer | `/app`, `/app/hospitals/[hospitalId]`, `/app/bookings/new`, `/app/bookings`, `/app/profile`, `/app/complete-profile` |
| Consumer auth | `/app/login` and `/app/register` use Google; the legacy forgot-password URL redirects to login |
| Hospital | `/hospital`, `/hospital/profile`, `/hospital/services`, `/hospital/bookings` |
| Hospital auth | `/hospital/login`, `/hospital/forgot-password` |
| Admin | `/admin`, `/admin/hospitals`, `/admin/hospitals/[hospitalId]`, `/admin/users`, `/admin/bookings`, `/admin/audits` |
| Admin auth | `/admin/login`, `/admin/forgot-password` |

`AuthContext` loads and caches one user profile per authenticated session.
`RequireRole` and `GuestOnly` provide navigation-level
guards while `firestore.rules` remains the security authority.
Authenticated portal sessions are signed out after 15 minutes without keyboard,
pointer, touch, or scroll activity. Returning to a backgrounded tab also checks
the elapsed idle time before allowing the session to continue.

## Current Firestore model

The active application uses these collections:

- `users`: identity, role, status, and optional hospital assignment.
- `hospitals`: public profile, activation/visibility, and agreed commission.
- `services`: hospital-owned service details and current price.
- `hospitalCapacity`: one internal, audited room-occupancy record per Hospital.
- `bookings`: preferred appointment request, Hospital response, price,
  commission, Consumer contact snapshots, treatment progress, and completion.
- `auditLogs`: Admin-readable records linked atomically to critical application
  writes. Client updates and deletes are denied; an active Admin can explicitly
  clear the collection through the protected server endpoint.

Typed boundaries are also reserved for `hospitalStaff`, `doctors`,
`availability`, `payments`, `notifications`, and `systemSettings`. They remain
denied until their application workflows are implemented. Consumer profiles
remain in `users` to avoid duplicating identity data.

Bookings follow `requested`, `confirmed`, `reschedule_requested`, `rejected`,
`cancelled`, or `completed`. The booking stores the service price and commission
percentage at creation so later configuration changes do not alter history.
It also snapshots the Consumer's name, Google email, phone, and optional address
so the assigned Hospital can contact that Consumer without receiving general
access to the `users` collection.
Treatment progress is tracked separately as `not_started`, `started`,
`ongoing`, or `completed`.

All potentially growing list views use cursor pagination with bounded page
sizes and a shared `usePaginatedList` hook. Successful updates patch the loaded
page in memory instead of immediately reading the same documents again.
Dashboard totals use Firestore count aggregation rather than downloading whole
collections. The application uses one-time reads; no Firestore realtime
listener is used beyond Firebase Auth's single authentication-state listener.

Admin, Hospital, and Consumer routes have lightweight route-level loading and
error boundaries. Initial client-side data reads use the shared portal load
guard so slow requests retain clear loading feedback. An initial-load failure
shows the three-second error toast and returns to the previous page; failures
after content is available keep that content visible so pagination or action
errors do not discard the user's current work.

The Admin audit view shows only the newest 20 records per page using cursor
pagination. It renders a compact activity summary and resolves the current
page's actor names with one bounded document-ID query; internal record IDs,
device metadata, and raw before/after payloads are not exposed in the UI.

Firebase App, Authentication, and Firestore initialization are separated. The
public route defers its authentication check until the browser is idle, and
Firestore is loaded only when an authenticated profile or application feature
actually needs it. User profiles are request-deduplicated and cached once per
session in `AuthContext`.

Server APIs share one no-store JSON response helper, and authenticated client
requests share one token/error-handling utility. Contact mail transport is
isolated from its route handler and reused by the route health check. The public
`GET /api/health` endpoint reports configuration readiness for all APIs, while
each API route exposes a matching lightweight `GET` check. Health checks do not
send mail or perform Firestore reads or writes.

## Hospital onboarding

Admin-created hospitals always begin as private `pending` records. Current
mandatory fields are hospital name, official email, phone, complete address,
city/locality, state, and commission percentage. Description is optional. The
same validation rules are shared by the Admin creation form,
hospital profile form, and service boundary.

The Admin hospital-details route records contract generation, signed-contract
confirmation, and activation as distinct audited actions. Activation is
available only after the contract state is `signed` and Admin supplies the
signed-contract URL; it writes `contractUrl` and `activatedAt` and makes the hospital public atomically. `createdAt`, `contractSignedAt`, and
`activatedAt` are displayed in the details view. The current contract HTML is a
clearly marked development template and is isolated in
`features/hospitals/contractTemplate.ts` for replacement with approved text.

## Security boundary

- Public reads require an active, public hospital; public service reads also
  require an active service owned by that hospital.
- Consumers authenticate with Google and can edit only their own name, phone,
  and address. Phone is mandatory after first sign-in, while address is optional;
  neither field is SMS-verified. Consumers create bookings only for themselves, view
  their own bookings, and cancel eligible statuses.
- Hospital users require a protected hospital profile assignment.
  They can edit permitted profile fields, manage only their services, and move
  only their bookings through allowed workflow transitions. Commission and
  tenant identifiers are immutable to them.
- Admin users require an active protected profile and can manage platform data.
- Client-side permanent deletes are denied. Supported changes require a linked
  append-only audit record, while archived records remain stored. The sole
  permanent-deletion exception is the owner-approved Admin audit-log clearing
  endpoint; it does not apply to operational collections.
- Everything else is denied.

## Deliberately deferred

Contracts, leads, hospital staff workflows, doctor workflows, appointment availability
slots, payment processing, invoices, settlements, automatic commission
collection, refunds, written reviews, notification delivery, chat, medical records,
reports, Cloud
Functions, Firebase Storage, native Capacitor integrations, and advanced PWA
caching are not part of this version.

The consumer-only PWA boundary is documented in
`features/consumer/pwa/README.md`. It registers no service worker and caches no
authentication, profile, booking, or personal data. Platform adapters will be
introduced only when the PWA or Capacitor phase uses them.
