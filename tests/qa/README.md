# Business workbook automation

## Admin QA high-priority fixes

HOS-006 now also covers stale hospital edits: `hospital-contract-approval` checks
opened revisions, competing saves, legacy null revisions and safe retry after
refresh. `hospital-identity-security`, `hospital-gallery` and `portal-mutations`
retain validation, email/access, gallery and atomic-audit coverage. Portal UI
checks verify an open details form retains its revision after another form saves.

CBK-013 retains Manual required. `consultation-completion` verifies the exact
saved IST end boundary, legacy windows, invalid schedules, unauthorized requests
and idempotent completion. `consultation-bookings` covers payment, notification,
cancellation and reschedule preservation; completion tests advance a controlled
clock rather than permitting future completion. Portal UI checks keep completion
disabled for future appointments while cancellation/rescheduling stay available.
Fixtures are not proof of live permissions, payment or email delivery.

## Hospital package-check loading

HOS-007 uses `hospital-summary-batches` and `hospital-package-summary` unit tests
for bounded two-request concurrency, 100 loaded hospitals/five batches, cancellation,
partial failures, exact counts, Admin authorization and request limits. Portal-ui
`Hospital package checks` and `Admin hospital cards show` checks cover one shared
indicator, retained badges during refresh, failure/retry and responsive layout.
The timing comparison is simulated network latency, not production performance.

## Hospital display IDs

HOS-001 retains Manual required for live creation/access sign-off. Supporting
`admin-creation-emails` and `portal-mutations` unit checks cover atomic AH IDs,
concurrent creation, duplicate-email/role denials, rollback, legacy compatibility,
AH999/1000, forged IDs and immutable edits/status transitions. The portal-ui
`Hospital display ID` check covers read-only visibility on Admin list/details,
absence from Hospital profile and overflow on desktop, 320px Chromium and mobile
WebKit. Source checks guard against adding these codes to HTML/PDF contracts.
These are isolated fixtures, not proof of live transactions or native rules.

## Consultant list filters and ordering

CST-010 uses `tests/unit/consultant-list.test.mjs` and the existing inactive-last
suite for bounded cursor phases, numeric employee order (including AS999/AS1000),
status/service combinations, indexed prefix search contracts and denied queries.
The portal-ui `Consultant filters combine` test covers filter combinations,
status-change membership, Clear filters, empty states and mobile control sizing.
Existing duplicate-record and Add/Edit/photo checks remain in the same suite.
Run on desktop, phone-320 and webkit-phone. No live cloud/provider actions occur.

Deploy the three new consultant composite indexes before relying on the new
queries. Local fixtures verify their declarations, not live index readiness.
Default/service-filtered pagination uses employeeSequence ascending. Existing
name/ID prefix searches keep their indexed query order for bounded pagination;
loaded matches are presented in numeric employee order with inactive last.

## Hospital required fields and map saves

HOS-002/HOS-014 supporting checks use `portal-mutations`,
`admin-creation-emails` and `qa-candidates` unit suites. They cover blank,
whitespace and explicit null values, required contract particulars, unchanged
records/audits after rejection, valid map src extraction, Admin denial and
optional-phone/legacy compatibility. The portal-ui `Hospital map requires` test
checks the field error/focus, no invalid update call and corrected save on
desktop, phone-320 and webkit-phone. No production writes are used.

The guarded native emulator suite adds map/primary-phone/district clear denials
and unchanged legacy-null compatibility. It requires JDK 21+; it has not been
executed for this update with the currently installed Java 8. Deploy tightened
Firestore rules explicitly; local API mocks do not establish deployed rules.

## Hospital detail overview

HOS-007 retains manual device review. Supporting local layout checks live in
`tests/e2e/portal-ui.spec.ts` under `Hospital overview pairs`: two desktop columns,
stacked tablet/mobile, long text, no horizontal overflow, available upload action,
map editing and full-width hospital editing with Cancel. Run with the portal-ui
config on desktop, tablet-1024, phone-320 and webkit-phone. Existing Hospital email
approval checks also cover the request section below this grouped overview.
No live upload, database mutation or email delivery is performed by these fixtures.

## Admin inactivity warning

AUT-005 retains manual native-login/device sign-off. Supporting checks:

```powershell
node --test --test-isolation=none tests/unit/auth-idle-policy.test.mjs tests/unit/admin-mfa-login.test.mjs
node node_modules/@playwright/test/cli.js test --config=tests/config/playwright.portal-ui.config.ts session-idle.spec.ts --project=desktop --project=phone-320 --project=webkit-phone
```

These exercise the real idle hook/provider gate and shared warning dialog with
controlled clocks: Admin warning at 58 minutes, explicit continuation, 60-minute expiry,
late-tab denial, cleanup, sign-out and unchanged Hospital/Consumer policies.
Separate native-MFA service mocks check password/OTP gating, not real Firebase
sign-ins. Browser fixtures cover focus, responsive wrapping and scroll locking.

## Partner contract policy table

CON-008 now verifies the owner-requested removal of CP02/CPO2 rows and references
while preserving all three CP01 postnatal refund rows and excluding online
consultation policy. Focused check:

```powershell
node --test --test-isolation=none --test-name-pattern='CON-008|partner contract renders' tests/unit/qa-candidates.test.mjs tests/unit/partner-contract-company-details.test.mjs
```

CON-009 layout coverage lives in `tests/e2e/contract-layout.spec.ts`. It compares
the populated HTML body with the pre-typography-change baseline, checks every
paragraph and non-signature table cell/contact field in the PDF text, verifies
both five-page samples, equal preview columns/signing boxes and standard fonts,
and retains the shared invoice PDF's byte hash. Run with the portal-ui config on
desktop, phone-320 and webkit-phone. Real print/device review remains separate.
The preview also asserts matching party/contact value, label and heading font
sizes, consistent value line height and matching label weight/color. Existing
explicit line breaks remain intact; this styling does not change PDF content.

## Hospital identity and email approval

AUT-011 and HOS-003 retain critical manual sign-off. Local supporting checks:

```powershell
node --test --test-isolation=none tests/unit/hospital-identity-security.test.mjs tests/unit/hospital-invitation-email.test.mjs tests/unit/admin-creation-emails.test.mjs tests/unit/hospital-contract-approval.test.mjs tests/unit/portal-mutations.test.mjs
node node_modules/@playwright/test/cli.js test --config=tests/config/playwright.portal-ui.config.ts --grep 'Hospital email' --project=desktop --project=phone-320 --project=webkit-phone
```

Fixtures cover interrupted provisioning, reserved identity reuse, duplicate email
edits, conflicting roles, approval/rejection, Cancel without a request and mobile
dialog scroll locks. They do not prove actual Auth/SMTP delivery or deployed
permissions. Native email/claim denial cases are in the guarded local Firestore
emulator suite. Release application changes before the tightened email rules.

The same identity regressions now cover HOS-002/HOS-011: explicit commission,
pre-publication identity conflicts, final setup transaction revalidation and
truthful saved-but-incomplete Auth outcomes. The portal UI suite's
`Hospital creation requires an explicit commission` test checks inline validation
and explicitly entered zero at desktop/mobile sizes. Add that title to the grep
above when validating commission changes. These checks do not simulate a real
Firebase network outage or establish actual mailbox delivery.

## Consumer centre-booking privacy

Supporting checks for BKG-008 and SEC-002 (critical deployed-role sign-off stays
Manual required):

```powershell
node --test --test-isolation=none tests/unit/consumer-booking-privacy.test.mjs tests/unit/consumer-booking-details.test.mjs tests/unit/booking-flow.test.mjs tests/unit/portal-booking-details.test.mjs tests/unit/booking-cancellation-reasons.test.mjs
node node_modules/@playwright/test/cli.js test --config=tests/config/playwright.consumer-bookings.config.ts --project=desktop --project=webkit-phone
```

The local API fixtures deliberately return full database documents to verify the
explicit response allowlist, owner checks, cursor bounds, safe cancellation and
preserved financial snapshots. Browser fixtures exercise history, details and
actions, not a deployed API or native rules. Native Consumer get/query denials
and retained Admin/assigned-Hospital reads are specified in
`tests/emulator/bookings.rules.test.mjs`; run only on its guarded local demo
emulator with a supported JDK. Deployment order: release the safe API/client
before restricting native Consumer booking reads. No index change is required;
the existing consumerId/createdAt composite supports the bounded query.

The 38 former automation candidates are mapped by stable workbook Case ID in
`candidate-coverage.json`. Existing matching checks are reused; missing checks
were added to the local unit and browser fixtures. This is local regression
coverage, not a substitute for critical manual sign-off, real inbox delivery,
native deployed Firestore rules, physical devices or actual provider payments.

Run the focused suite from the project root after owner approval:

```powershell
node scripts/test-qa-candidates.mjs
```

The runner requires all unit files and linked desktop Chromium/mobile WebKit
checks to pass with no skipped/flaky cases. It writes ignored evidence under
`test-results/qa-candidate-run/`. No deployment server or production user is used.
Use `verified.json` only after a successful run; an old file is not evidence of a
new successful run. Record the app version and timestamp with each workbook
update. Do not place actual credentials, patient details or provider secrets in
fixtures or reports. Existing business tester results and critical manual cases
must be preserved when updating the local Git-ignored workbook.

## Public media checks

UXP-008 image-delivery expectations additionally cover content-hashed compressed
artwork, shared direct UI marks, responsive portal hospital thumbnails and stable
frames. `tests/unit/image-delivery.test.mjs` verifies source dimensions/metadata,
cache/variant policy and token-preserving variants. `scripts/audit-image-delivery.mjs`
captures actual local production image requests, bytes and responsive screenshots
with external requests blocked. Cold/warm samples are not production billing or
capacity proof. Physical-device/provider review remains required. See
`docs/IMAGE_DELIVERY_AUDIT_2026-11-11.md` for measured results and verification limits.

UXP-008 also has focused asset and media-lifecycle checks:

```powershell
node --test --test-isolation=none tests/unit/public-media-assets.test.mjs
node node_modules/@playwright/test/cli.js test --config=tests/config/playwright.public-media.config.ts
```

The browser fixture serves actual local MP4/WebP files through a temporary
loopback-only server, including byte-range responses and a 250 ms video-response
delay. It checks first-film staging, playback/rotation, offscreen pause, poster
fallback, responsive partner-image selection and the hero poster gate. Motion
and Next's image adapter are mocked; this does not measure a production LCP,
Vercel delivery, sustained low-bandwidth playback or physical iOS/Android.
