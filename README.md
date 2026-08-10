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
```

Copy `.env.example` to `.env.local` and add the Firebase Web SDK configuration
before using application routes. Gmail environment variables are required only
for the existing public contact form.

## Structure

- `app/` contains the public website, route-specific portal layouts, and contact API.
- `components/` contains the existing public experience and focused portal UI.
- `contexts/` and `hooks/` expose the shared authentication state.
- `services/` contains Firebase client, authentication, user, hospital, service,
  booking, audit, and Firestore data access.
- `features/` contains authentication contracts and typed Firestore models.
- `firestore.rules` and `firestore.indexes.json` define data isolation and queries.
- `scripts/` contains controlled privileged-user provisioning.

See [Firebase setup](docs/FIREBASE.md) and
[application architecture](docs/APPLICATION_ARCHITECTURE.md) for configuration,
security, collection schemas, route boundaries, and deliberately deferred work.
The preservation and audit design is documented in
[Firestore data architecture](docs/FIRESTORE_DATA_ARCHITECTURE.md).

## Confirmed operating decisions

### Data preservation

- Application code must never permanently delete operational Firestore data.
  Users, hospitals, services, bookings, and their history use archive/soft-delete
  metadata and remain available for audit and restoration.
- Firestore client rules deny document deletion for active application
  collections. Audit logs are append-only and Admin-readable.
- No Firestore TTL or other automatic record-deletion policy is configured.
- Firebase Console, project-owner, and service-account access is restricted to
  trusted platform administrators. Privileged Admin SDK work bypasses client
  rules and must preserve the same archive and audit guarantees.

### Role and privacy boundary

- Consumer, Hospital, and Admin routes and navigation remain separate. Every
  protected page uses the appropriate role guard; Firestore rules remain the
  data-access authority.
- Admin controls and management details—including commission management,
  contract workflow, signing/activation controls, audit data, and platform
  settings—must not be rendered in Consumer or Hospital interfaces.
- Consumer and Hospital user lists are segregated in the Admin portal. Admin
  accounts are managed separately.
- The confirmed scope for this phase keeps the current Firestore collection
  structure. A duplicate public/private hospital collection is not required
  while Firebase project access is limited to trusted administrators. If a
  future requirement demands field-level hiding from an otherwise readable
  Firestore document, introduce a reviewed public/private document split;
  Firestore rules cannot mask individual fields within a permitted read.

### Hospital field ownership

- Hospital users may edit hospital name, official email, phone, city/locality,
  state, complete address, and optional description for their assigned hospital.
- Only Admin controls commission, approval/status, public visibility, contract
  generation/signing details, the signed-contract URL, activation, and archive
  actions.
- The Hospital Profile must not expose Image URL, commission, contract, audit,
  activation, visibility, or other Admin-management controls.

### Hospital login lifecycle

- Activating a hospital provisions or reconnects its Firebase Authentication
  account using the official hospital email and sends a secure Firebase password
  setup link. No default password or password hash is stored in Firestore.
- Admin can resend the same secure setup/reset email from Hospital Details.
  Hospital users can also use Forgot password and can change their password from
  the authenticated Hospital portal after confirming their current password.
- The provisioning API uses the Firebase Admin SDK on the trusted server. Its
  runtime must have Application Default Credentials; do not expose service
  account credentials through `NEXT_PUBLIC_*` variables or commit them.

See [AGENTS.md](AGENTS.md) for implementation guardrails that future coding
work must preserve.

## Deployment note

The contact form uses the Node.js `/api/contact` route. Do not replace the
current Node-capable deployment with a static-only Firebase Hosting deployment
unless that endpoint is deliberately moved to another approved service.
