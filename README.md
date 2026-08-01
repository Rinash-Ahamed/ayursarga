# Ayursarga

Ayursarga is a Next.js App Router application containing the existing public
Ayurvedic-care website and three route-separated application areas:

- `/app` — consumer hospital discovery and booking requests
- `/hospital` — hospital profile, services, and booking management
- `/admin` — platform hospitals, users, bookings, and commission visibility

The application uses TypeScript, React, Firebase Authentication, Cloud
Firestore, GSAP, Lenis, and Framer Motion. The public website and portal modules
are split by route so Firebase and portal code are not loaded by public visitors.

## Development

```bash
npm install
npm run dev
```

Validation commands:

```bash
npm run lint
npm run typecheck
npm run build
npm run firebase:test:auth
npm run firebase:test:rules
```

Copy `.env.example` to `.env.local` and add the Firebase Web SDK configuration
before using application routes. Gmail environment variables are required only
for the existing public contact form.

## Structure

- `app/` contains the public website, route-specific portal layouts, and contact API.
- `components/` contains the existing public experience and focused portal UI.
- `contexts/` and `hooks/` expose the shared authentication state.
- `services/` contains Firebase client, authentication, user, hospital, service,
  booking, and Firestore data access.
- `features/` contains authentication contracts and the four current Firestore models.
- `firestore.rules` and `firestore.indexes.json` define data isolation and queries.
- `scripts/` contains emulator verification and controlled privileged-user provisioning.

See [Firebase setup](docs/FIREBASE.md) and
[application architecture](docs/APPLICATION_ARCHITECTURE.md) for configuration,
security, collection schemas, route boundaries, and deliberately deferred work.

## Deployment note

The contact form uses the Node.js `/api/contact` route. Do not replace the
current Node-capable deployment with a static-only Firebase Hosting deployment
unless that endpoint is deliberately moved to another approved service.
