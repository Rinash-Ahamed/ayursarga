# Application feature boundaries

The existing root `app/` route and public components remain the Ayursarga
marketing website. Application code is added alongside those files without
moving or duplicating the public implementation.

- `auth/` contains provider-neutral roles, profile parsing, redirects, and
  friendly authentication errors.
- `firestore/models.ts` defines active records plus reserved, denied-by-default
  collection contracts for future hospital staff, clinical, payment,
  notification, audit, and settings modules.
- `consumer/pwa/` documents the consumer-only PWA boundary. Capacitor and PWA
  installation are not configured yet; adapters will be added when used.
- `../app/app`, `../app/hospital`, and `../app/admin` are independent Next.js
  route/layout boundaries. Route splitting prevents portal modules from being
  included in unrelated pages.
- `../services/` contains focused Auth, user, hospital, service, booking,
  audit, Firebase client, and Firestore data-access modules.

Consumer registration is self-service and always assigns the consumer role.
The initial `info@ayursarga.com` Authentication account receives its protected
admin profile automatically on first admin login. All other admin and hospital
profiles must be created through a controlled process; users cannot assign or
change their own role.
