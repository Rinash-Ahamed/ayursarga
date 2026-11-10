# Business workbook automation

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
