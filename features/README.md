# Application feature boundaries

The existing root `app/` route and public components remain the Ayursarga
marketing website. Application code is added alongside those files without
moving or duplicating the public implementation.

- `auth/` contains provider-neutral roles, profile parsing, redirects, and
  friendly authentication errors.
- `firestore/models.ts` defines only the four current collections: users,
  hospitals, services, and bookings.
- `consumer/pwa/` documents the consumer-only PWA boundary. Capacitor and PWA
  installation are not configured yet; adapters will be added when used.
- `../app/app`, `../app/hospital`, and `../app/admin` are independent Next.js
  route/layout boundaries. Route splitting prevents portal modules from being
  included in unrelated pages.
- `../services/` contains only the focused Auth, user, hospital, service,
  booking, Firebase client, and Firestore data-access modules currently used.

Consumer registration is self-service and always assigns the consumer role.
Admin and hospital users must be provisioned through the controlled Admin SDK
script because their signed Firebase custom claims cannot be safely assigned
by browser code.
