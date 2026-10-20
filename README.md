# Ayursarga

Ayursarga is a Next.js App Router application containing the existing public
Ayurvedic-care website and three route-separated application areas:

- `/` and `/centers`: public consumer discovery with inline Google sign-in
- `/app`: compatibility redirect to public centre discovery; protected Consumer routes are limited to profile completion and booking workflows
- `/hospital`: hospital profile, services, booking/treatment progress, and room occupancy management
- `/admin`: platform hospitals, Hospital package visibility, users, bookings, and commission visibility

The application uses TypeScript, React, Firebase Authentication, Cloud
Firestore, GSAP, Lenis, and Framer Motion. Public discovery and portal modules
remain route-separated; the public navigation loads only the shared Firebase
authentication state needed for inline Consumer Google sign-in and account display.

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

Playwright configuration files live in `tests/config/`, with shared paths in
`tests/config/paths.ts`. Tests remain in `tests/e2e/`, fixtures/helpers stay in
their existing test folders, and generated artifacts remain in the ignored
root `test-results/` folder. Run commands from the repository root:

```bash
npm run test:e2e:consumer-bookings
npm run test:e2e:centre-search
npm run test:e2e:portal-ui
```

Each suite has a `test:e2e:*` shortcut in `package.json`. To check discovery
without starting browsers or the application, append `-- --list`. Direct
Playwright commands must specify `--config=tests/config/<config-file>`.

Focused dialog regression checks: `npm run test:e2e:dialogs`. These render the
actual shared dialog components and production React in isolated browser
fixtures with the application CSS. No test routes, login bypasses or cloud writes
are added. The suite covers Admin/Hospital confirmations at multiple scroll
positions, touch scrolling, focus, viewport changes, busy states and nested
contract previews across mobile portrait/landscape, tablet and desktop sizes.

All confirmation dialogs use `PortalDialog`, backed by the shared `ModalLayer`
and reference-counted `documentScrollLock`. Public login and contract preview
reuse that layer. It portals directly to `body` so transformed page animation
containers cannot trap fixed positioning. Keep new modal surfaces on this shared
path so closing one cannot unlock another modal's background.

Toast regression checks: `npm run test:e2e:toasts`. These use the actual shared
toast renderer/message hooks, controlled request promises and a browser clock.
They cover expiry, idle/background renders, page remounts, repeated identical
actions, authentication errors, stale request failures and retries on mobile,
desktop and reduced-motion settings, without making cloud requests.

Toast messages retain their strings for inline validation but carry a separate
notification identity from `useRepeatableMessage`. Pass that identity to
`PortalToast`/`PortalFeedback`/`PortalLoadGuard`. Shared auth errors use their
source object and occurrence timestamp. The root `PortalToastViewport` owns
presentation; the shared notification store consumes each event once and removes
expired entries with timers. Never restart toast animations on parent renders
or use the message string alone to identify a new action.

Copy `.env.example` to `.env.local` and add the Firebase Web SDK configuration
before using application routes. Gmail environment variables are required only
for the existing public contact form.

## Structure

- `app/` contains the public website, route-specific portal layouts, application APIs, and health endpoints.
- `components/` contains the existing public experience and focused portal UI.
- `contexts/` and `hooks/` expose the shared authentication state.
- `services/` contains Firebase client, authentication, user, hospital, service,
  booking, audit, and Firestore data access.
- `features/` contains authentication contracts and typed Firestore models.
- `firestore.rules` and `firestore.indexes.json` define data isolation and queries.
- `scripts/` contains controlled privileged-user provisioning.

Admin manages platform consultants at `/admin/consultants`. Consultant records
use sequential display IDs (`AS001`, `AS002`, and so on), remain separate from
Firebase Authentication users, and support audited profile edits and
Active/Inactive status changes.

Hospital packages reuse the existing `services` collection. Each package uses
one of the supported 7, 10, 14, 21, 28, or 35-day durations and stores a
duplicate-free map of selected procedures to their included day counts.
Procedures may be reused across different packages. Internal room
occupancy uses one audited `hospitalCapacity/{hospitalId}` record and is not
exposed through the public Hospital document. Admin can view and update this
same capacity record from Hospital Details, while the assigned Hospital manages
it from its dashboard. Bookings keep appointment status
separate from `treatmentStatus` (`not_started`, `started`, `ongoing`, or
`completed`).

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
- Admin removal of a Consumer archives the Consumer profile and revokes active
  application access while retaining the authentication identity, bookings,
  and audit history.
- Consumer profile completion records versioned Customer Terms and Privacy
  Policy acceptance. Every booking separately records the applicable booking
  terms and policy acceptance version and timestamp.
- Firestore client rules deny document deletion for active application
  collections. Audit logs are Admin-readable and cannot be changed through the
  client SDK. As an explicit platform-owner exception, an active Admin may use
  the protected Admin portal action to permanently clear the audit log through
  the verified server endpoint.
- No Firestore TTL or other automatic record-deletion policy is configured.
- Firebase Console, project-owner, and service-account access is restricted to
  trusted platform administrators. Privileged Admin SDK work bypasses client
  rules and must preserve the same archive and audit guarantees, except for the
  narrowly scoped audit-log clearing endpoint described above.

### Role and privacy boundary

- Consumer, Hospital, and Admin routes and navigation remain separate. Every
  protected page uses the appropriate role guard; Firestore rules remain the
  data-access authority.
- The approved `info@ayursarga.com` password account may recover a missing
  Admin Firestore profile through the verified server-only bootstrap endpoint.
  The recovery is email-locked, idempotent, audited, and cannot overwrite an
  existing conflicting profile.
- Admin controls and management details, including commission management,
  contract workflow, signing/activation controls, audit data, and platform
  settings, must not be rendered in Consumer or Hospital interfaces.
- Consumer and Hospital user lists are segregated in the Admin portal. Admin
  accounts are managed separately.
- Consumers use Google Authentication only. After first sign-in they must add a
  phone number; an address is optional. These are contact data and are not verified
  through SMS. A booking snapshots the available details for its assigned Hospital,
  while Hospitals remain unable to browse Consumer profiles directly.
- Consumers discover centres on the public website. The public navigation has one
  Login action offering Consumer Google sign-in or Hospital Login; Admin Login is
  available only by direct URL. A signed-in Consumer sees their Google profile
  control in the public navigation. `/app` remains available only for protected
  profile-completion and booking workflows when required.
- The confirmed scope for this phase keeps the current Firestore collection
  structure. A duplicate public/private hospital collection is not required
  while Firebase project access is limited to trusted administrators. If a
  future requirement demands field-level hiding from an otherwise readable
  Firestore document, introduce a reviewed public/private document split;
  Firestore rules cannot mask individual fields within a permitted read.

### Hospital field ownership

- Hospital users may edit hospital name, official email, owner WhatsApp number,
  required primary hospital phone, optional secondary hospital phone,
  city/locality, Kerala district, state, complete address, and optional
  description for their assigned hospital.
- Admin and active Hospital users can upload or remove gallery images. Hospitals
  can manage only their own centre; Admin can manage any non-archived hospital.
- Only Admin controls centre location, commission,
  approval/status, public visibility, contract generation/signing details, the
  signed-contract URL, activation, and archive actions.
- The Hospital Profile must not expose centre location,
  commission, contract, audit, activation, visibility, or other
  Admin-management controls.

### Hospital image uploads (Blaze)

- In Firebase Console for `ayursarga-connect`, open Storage and create a bucket
  if it does not already exist. Choose its region deliberately.
- Set `FIREBASE_STORAGE_BUCKET` to its exact name (without `gs://`) in
  `.env.local` and the Vercel environment, then restart/redeploy the app.
  Existing buckets can end in `.appspot.com`; new buckets typically end in
  `.firebasestorage.app`. Do not guess the bucket name.
- The existing Firebase Admin service account needs object create/read access
  to that bucket. Deploy the restrictive Storage rules using
  `npx firebase deploy --only storage --project ayursarga-connect --non-interactive`.
  App deployment and Storage rule deployment are separate steps.
- Admin Hospital Details and Hospital Profile share an upload/gallery control.
  JPG, PNG and WebP inputs up to 15 MB are resized in the browser, then decoded,
  orientation-corrected, stripped of metadata, and converted on the server to
  1200 × 900 WebP, with 480 × 360 and 800 × 600 versions for responsive
  display. New uploaded image URLs end in `-1200.webp`; the shared image helper
  supplies their sibling versions through native `srcset`/`sizes`. Existing
  uploaded and external URLs continue to use their original image. The server
  bounds the upload to 3 MB and decoded input to
  25 million pixels. Images are uploaded one at a time to stay within hosting
  request limits. SVG, animated and unsupported images are rejected.
- The authenticated `/api/hospitals/{hospitalId}/images` route verifies active
  role and hospital ownership. The 10-image limit is checked transactionally.
  Successful gallery changes and their audit entries are committed atomically.
- Files use unique paths under `hospitals/{hospitalId}/images/` and cached,
  individual public download URLs. Firestore stores only those gallery URLs;
  existing external image links continue working. Storage SDK writes/listing
  are denied. Removal unlinks an image and preserves its stored file and audit
  history. Files left by a failed gallery update are retained rather than deleted.
- Public card and centre galleries share decoding/navigation logic. The visible
  image stays in place while the next selection loads and decodes; older rapid
  clicks cannot override a newer selection. Only the adjacent image is warmed
  after the current one loads, and this is skipped on supported data-saver or
  slow-connection settings. Fixed image dimensions reserve layout space. Mobile
  centre-gallery controls stay inside the main image with larger tap targets.
- Storage/bandwidth usage is billed under Blaze. Set billing alerts for the
  project and monitor Storage usage as image traffic grows.

### Hospital login lifecycle

- Activating a hospital provisions or reconnects its Firebase Authentication
  account using the official hospital email and sends a secure Firebase password
  setup link. No default password or password hash is stored in Firestore.
- Admin can resend the same secure setup/reset email from Hospital Details.
  Hospital users can also use Forgot password and can change their password from
  the authenticated Hospital portal after confirming their current password.
- The provisioning API uses the Firebase Admin SDK on the trusted server. Its
  runtime must have the server-only `FIREBASE_ADMIN_CLIENT_EMAIL` and
  `FIREBASE_ADMIN_PRIVATE_KEY` variables locally and on Vercel. Do not expose
  these through `NEXT_PUBLIC_*` variables or commit them.

See [AGENTS.md](AGENTS.md) for implementation guardrails that future coding
work must preserve.

## Deployment note

The contact form uses the Node.js `/api/contact` route. Do not replace the
current Node-capable deployment with a static-only Firebase Hosting deployment
unless that endpoint is deliberately moved to another approved service.

## API health checks

`GET /api/health` reports readiness for every current API route without reading
or writing Firestore records, sending email, or exposing credentials. It returns
HTTP `200` when all required server configuration is ready and HTTP `503` when
one or more API dependencies are unavailable.

Each API also supports its own lightweight `GET` readiness check:

- `/api/contact`
- `/api/admin/audits`
- `/api/admin/hospitals/{hospitalId}/login-setup`

The checks validate local server configuration and SDK initialization only.
They intentionally avoid billable database reads and external email delivery.

## Public API caching

Successful responses from the sanitized public hospital and package APIs use a
short cache window: 30 seconds in the browser and 60 seconds on Vercel's CDN,
with stale responses allowed briefly while the CDN refreshes them. Validation,
rate-limit, not-found, and server-error responses are never cached. Authenticated
Admin, Hospital, Consumer, booking, and profile APIs also remain `no-store`.

This reduces repeated Firestore reads during public browsing without exposing
private hospital fields or allowing personalized responses to enter a shared
cache. Public updates can take up to about one minute to appear after a save.

## Production monitoring and alerts

Use `GET /api/health` as the production availability probe. It reports only
safe readiness states for Firebase Admin and contact email configuration; it
does not read Firestore, send email, or reveal credentials. Server failures in
public discovery, contact submission, and booking creation are emitted as
structured JSON logs so they can be filtered by `event=api_error` and `route`
in Vercel logs.

Configure these alerts in the hosting consoles after deployment (they cannot be
enabled safely from repository code):

- In Vercel, monitor `/api/health` every 5 minutes and alert when it returns a
  non-200 response twice consecutively.
- In Vercel, enable alerts for elevated function errors and unusual function
  duration on `/api/public/*`, `/api/contact`, and `/api/consumer/bookings`.
- In Google Cloud Billing, set project budget notifications at 50%, 80%, and
  100% of the intended monthly limit. Spark projects with no billing account
  should instead review Firebase usage and quota dashboards regularly.
- In Google Cloud Monitoring, add Firestore read/write and quota alerts before
  upgrading from Spark or materially increasing traffic.
- Never include request bodies, identity tokens, contact details, or Firebase
  credentials in monitoring logs or alert notifications.

## Portal notifications

Admin and Hospital portals share one bounded in-app notification system. A
Hospital availability-block request notifies active Admin accounts; approval,
rejection, an Admin-created block, or removal notifies the connected active
Hospital account. The bell subscribes only to the signed-in user's latest 20
notifications, and notification documents cannot be created or deleted by the
client. Deploy both Firestore rules and indexes after notification changes:

```bash
npm run firebase:deploy:firestore
```
