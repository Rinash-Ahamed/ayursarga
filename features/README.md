# Future portal structure

This folder reserves feature boundaries without adding routes or changing the
current public site.

- `auth/contracts.ts` keeps authentication provider-neutral and role-aware.
- `portals/registry.ts` is the single source of truth for the future admin,
  hospital, and consumer route groups. Entries remain disabled until built.
- `consumer/platform.ts` isolates browser/native capabilities behind adapters,
  so discovery and booking code can be shared by the web PWA and a later
  Capacitor Android/iOS shell.

When implementation begins, create each portal in its own App Router route
group and keep its UI, data access, and authorization checks inside the matching
feature boundary. PWA manifests and service-worker registration should apply
only to the consumer route scope, not the admin or hospital portals.
