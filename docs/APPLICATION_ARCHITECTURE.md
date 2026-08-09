# Ayursarga application foundation

## Route boundaries

The public site remains at `/`. The consumer, hospital, and admin modules use
their own layouts and are compiled as separate Next.js route segments.

| Area | Routes |
| --- | --- |
| Consumer | `/app`, `/app/hospitals/[hospitalId]`, `/app/bookings/new`, `/app/bookings`, `/app/profile` |
| Consumer auth | `/app/login`, `/app/register`, `/app/forgot-password` |
| Hospital | `/hospital`, `/hospital/profile`, `/hospital/services`, `/hospital/bookings` |
| Hospital auth | `/hospital/login`, `/hospital/forgot-password` |
| Admin | `/admin`, `/admin/hospitals`, `/admin/users`, `/admin/bookings` |
| Admin auth | `/admin/login`, `/admin/forgot-password` |

`AuthContext` loads and caches one user profile per authenticated session.
`RequireRole`, `RequireAuthenticated`, and `GuestOnly` provide navigation-level
guards while `firestore.rules` remains the security authority.

## Current Firestore model

The active application uses these collections:

- `users`: identity, role, status, and optional hospital assignment.
- `hospitals`: public profile, activation/visibility, and agreed commission.
- `services`: hospital-owned service details and current price.
- `bookings`: preferred appointment request, hospital response, price and
  commission snapshots, and completion state.
- `auditLogs`: immutable, admin-readable records linked atomically to critical
  application writes.

Typed boundaries are also reserved for `hospitalStaff`, `doctors`,
`availability`, `payments`, `notifications`, and `systemSettings`. They remain
denied until their application workflows are implemented. Consumer profiles
remain in `users` to avoid duplicating identity data.

Bookings follow `requested`, `confirmed`, `reschedule_requested`, `rejected`,
`cancelled`, or `completed`. The booking stores the service price and commission
percentage at creation so later configuration changes do not alter history.

All list services use limits and cursor-ready pagination. The application uses
one-time reads; no Firestore realtime listener is used beyond Firebase Auth's
single authentication-state listener.

## Security boundary

- Public reads require an active, public hospital; public service reads also
  require an active service owned by that hospital.
- Consumers can edit only their own name and phone, create bookings only for
  themselves, view their own bookings, and cancel eligible statuses.
- Hospital users require a protected hospital profile assignment.
  They can edit permitted profile fields, manage only their services, and move
  only their bookings through allowed workflow transitions. Commission and
  tenant identifiers are immutable to them.
- Admin users require an active protected profile and can manage platform data.
- Client-side permanent deletes are denied. Supported changes require a linked
  append-only audit record, while archived records remain stored.
- Everything else is denied.

## Deliberately deferred

Contracts, leads, hospital staff workflows, doctor workflows, availability
slots, payment processing, invoices, settlements, automatic commission
collection, refunds, reviews, notification delivery, chat, medical records,
reports, audit-log UI, Cloud
Functions, Firebase Storage, native Capacitor integrations, and advanced PWA
caching are not part of this version.

The consumer-only PWA boundary is documented in
`features/consumer/pwa/README.md`. It registers no service worker and caches no
authentication, profile, booking, or personal data. Platform adapters will be
introduced only when the PWA or Capacitor phase uses them.
