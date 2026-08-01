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

Only these collections exist in the first version:

- `users`: identity, role, status, and optional hospital assignment.
- `hospitals`: public profile, activation/visibility, and agreed commission.
- `services`: hospital-owned service details and current price.
- `bookings`: preferred appointment request, hospital response, price and
  commission snapshots, and completion state.

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
- Hospital users require a matching signed custom claim and profile assignment.
  They can edit permitted profile fields, manage only their services, and move
  only their bookings through allowed workflow transitions. Commission and
  tenant identifiers are immutable to them.
- Admin users require a matching signed custom claim and active profile and can
  manage all four current collections.
- Everything else is denied.

## Deliberately deferred

Contracts, leads, multiple hospital staff roles, doctors, availability slots,
payments, invoices, settlements, automatic commission collection, refunds,
reviews, notifications, chat, medical records, reports, audit logs, Cloud
Functions, Firebase Storage, native Capacitor integrations, and advanced PWA
caching are not part of this version.

The consumer-only PWA boundary is documented in
`features/consumer/pwa/README.md`. It registers no service worker and caches no
authentication, profile, booking, or personal data. Platform adapters will be
introduced only when the PWA or Capacitor phase uses them.
