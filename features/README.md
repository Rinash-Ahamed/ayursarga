# Future portal structure

The existing root `app/` route and `components/` remain the public website.
Application code is added around those working files rather than moving or
duplicating them.

- `auth/contracts.ts` keeps authentication provider-neutral and role-aware.
- `../contexts/AuthContext.tsx` and `../hooks/useAuth.ts` provide one shared
  authentication state and action API for every portal.
- `../components/auth/RequireRole.tsx` is the reusable client-side portal guard;
  privileged server operations use `services/auth/server.ts` and signed custom
  claims instead.
- `portals/registry.ts` is the single source of truth for the future admin,
  hospital, and consumer route groups. Entries remain disabled until built.
- `consumer/platform.ts` isolates browser/native capabilities behind adapters,
  so discovery and booking code can be shared by the web PWA and a later
  Capacitor Android/iOS shell.
- `../app/app`, `../app/hospital`, and `../app/admin` contain colocated Next.js
  layout boundaries for their future route segments. Their foundation pages
  redirect to the public site, so no unfinished application UI is exposed.
- `../services` separates browser Firebase APIs from privileged server Admin
  APIs. Firebase initializes lazily and is not included in the current public
  page bundle.
- Consumer registration is self-service. Admin and hospital accounts must be
  provisioned in a trusted server environment because privileged roles are
  represented by signed Firebase custom claims.
- `../config/routes.ts` owns route paths; `../config/firebase.ts` validates the
  browser configuration only when an application feature requests Firebase.

When implementation begins, add pages beneath the reserved route segments and
keep each portal's UI, data access, and authorization checks inside the matching
feature boundary. PWA manifests and service-worker registration should apply
only to the consumer route scope, not the admin or hospital portals.
