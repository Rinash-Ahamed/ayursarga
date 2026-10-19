# Session handoff

Updated: 20 October 2026 (Asia/Calcutta).

This file records completed work and verification limits. `AGENTS.md` remains
the implementation authority; these notes do not authorize deployments or data
maintenance. Preserve unrelated working-tree changes; the workspace contains
substantial uncommitted work across multiple tasks.

## Hospital gallery uploads

- Firebase Storage uploads are authorized on Blaze for Admin and the assigned
  active Hospital. The shared `HospitalImageManager` uses
  `/api/hospitals/[hospitalId]/images`.
- Server checks authorization, validates/re-encodes images with Sharp, creates
  480/800/1200-pixel 4:3 WebP variants, and atomically updates the gallery and
  audit record. Maximum: 10 gallery entries. Gallery removal retains files.
- Configure server-only `FIREBASE_STORAGE_BUCKET`; never expose Admin credentials.
  Direct browser Storage operations are denied by `storage.rules`.
- Consumer galleries decode the next image before displaying it, use responsive
  variants, and limit neighbor preloading on slow/data-saving connections.
- Removed the obsolete HTTPS image-entry form/component and unused styles.
  Uploads remain; Admin map editing is separate. URL rendering/validation helpers
  remain necessary for saved upload download URLs and supported legacy data.
- At the owner's explicit request, cleared 9 image references across 2 hospital
  galleries in `ayursarga-connect`. Verification found no remaining gallery
  references. Previous links were preserved in atomic audits; no Storage files
  were deleted. `scripts/clear-hospital-galleries.mjs` is read-only by default;
  **do not rerun with `--apply` without fresh explicit authorization**.
- Upload rules and endpoint changes were not deployed in this session. Real
  authenticated uploads and physical Android/iOS rendering remain unverified.

## Shared dialogs and notifications

- `ModalLayer` renders at body level so transformed parents cannot capture
  fixed dialogs. It handles visual viewport changes, focus containment and
  restoration, Escape/backdrop behavior, and nested modal layers.
- `utils/documentScrollLock.ts` provides reference-counted scroll locking and
  restoration, including fixed-body handling for iOS. SmoothScroll respects
  the shared lock. Do not add competing per-screen locks.
- Confirmations use `PortalDialog`; contract previews and public login use the
  same modal infrastructure.
- Toast recurrence was traced to restarting animation on parent renders and
  retained message state without stable event identity.
- `useRepeatableMessage` returns the value, setter, and notification event.
  Forward that event to feedback/toast components. `PortalToastViewport` is the
  persistent root renderer; `utils/toastNotifications.ts` owns lifetime,
  consumption, cleanup, and suspended-tab expiry. Normal/error lifetimes are
  6/8 seconds. New real actions can repeat a message; stale events cannot replay.

## Portal performance changes

- Admin hospital saves previously cleared/remounted the details page and
  refetched its hospital, package, and room panels before success feedback.
- Common hospital edits, map changes, contract particulars, editorial assessments,
  and supported actions now merge server-confirmed changed fields locally.
  Activation still reconciles server state; setup emails still await completion.
- Hospital room updates and booking/treatment changes use committed mutation
  results rather than unnecessary follow-up reads. Filtered bookings are removed
  locally when their new status no longer matches the current filter.
- Consultant status updates and unfiltered edits patch local records; creation
  and search-sensitive edits retain reconciliation where needed.
- Independent Hospital/service, Hospital/booking, and Hospital/capacity reads use
  Firestore `getAll`. Image uploads reuse the initial gallery count, while the
  final transaction still enforces the gallery limit.
- `services/api/mutation.ts` encodes server Timestamp values in committed deltas;
  `authorizedMutationRequest` restores client Timestamp objects. It rejects
  incomplete mutation responses rather than claiming success.
- `utils/inFlightRequests.ts` shares overlapping identical authenticated JSON
  mutations per user. It does not cache completed outcomes or automatically retry
  writes. Binary uploads and caller-abortable requests remain independent.
- Updated server writes use update-time/create preconditions where applicable
  to reject concurrent conflicts. Atomic audits, role checks, token revocation
  checks, and server validation remain in place. No sensitive-data cache added.

### Measurements and validation

- Six alternating read-only Firestore samples: median sequential two-document
  reads approximately 295 ms; batched reads approximately 152 ms. Network varied.
  Reproduce with `node scripts/profile-portal-reads.mjs` only when a live read-only
  probe is in scope. It logs timings, not document data or credentials.
- Production-React browser fixture with simulated 150 ms writes/200 ms reads:
  room-save median approximately 363 ms before versus 157 ms after; post-save
  reads reduced from 1 to 0. These are controlled UI-chain measurements, **not
  deployed authenticated API or cold-start measurements**.
- Completed: ESLint, typecheck, production build; 8 unit/API regression tests;
  4 desktop/tablet performance tests; 24 toast tests; 23 dialog checks, with one
  desktop-only touch check skipped. Two mobile dialog checks were rerun and
  passed after parallel suites collided on trace artifacts.
- Playwright fixture configurations now have separate artifact directories.
  The fixtures do not mutate live cloud data. Relevant commands:
  - `node --test --test-isolation=none tests/unit/portal-mutations.test.mjs`
  - `npx.cmd playwright test --config=playwright.performance.config.ts`
  - `npx.cmd playwright test --config=playwright.dialogs.config.ts`
  - `npx.cmd playwright test --config=playwright.toasts.config.ts`
- Windows PowerShell script execution restrictions require `npm.cmd`/`npx.cmd`
  here. Chromium may require approved execution outside the process sandbox.
- No rules/index deployment or live mutations were performed for performance
  testing. Deployed authenticated latency, cold starts, and real-device behavior
  still require measurement. Do not claim all application workflows were tested
  end-to-end against production.

## Latest small changes

- Contract and approval timeline: completed steps display white SVG ticks in
  existing emerald circles; incomplete steps retain numbers. Scoped label colors
  so label rules cannot override white marker icons. No workflow/layout change.
- Expanded `.gitignore` for local secrets/settings, build/deployment caches,
  emulator exports, test/coverage/performance artifacts, logs, and scratch files.
  `.env.example`, source, public assets, tests, shared `.agents/skills`, Firebase
  rules/configuration, and lockfiles remain trackable. Verified ignore rules;
  no tracked files were untracked and no user files were deleted.
- The timeline and ignore-rule edits received diff/targeted checks only; the
  broader build/lint results above predate those small changes. Do not run new
  lint/build/API checks for a documentation-only handoff.

## Pending deployment and safety reminders

- No deployment was requested for the latest changes. Do not deploy implicitly.
- Do not replay gallery clearing or any live test mutation as a validation step.
- Keep operational/history data and uploaded files; gallery removal is unlinking,
  not permanent file deletion. Follow the audit/preservation policy in `AGENTS.md`.
- No credentials or `.env.local` contents belong in notes, logs, or GitHub.
