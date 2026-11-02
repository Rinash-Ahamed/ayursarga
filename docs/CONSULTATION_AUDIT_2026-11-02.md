# Consultation audit — 2 November 2026

Version: **4.35.0** (from 4.34.0). No deployment, live payment, email sending,
authenticated production mutation, rules change or index change performed.

## Changes and findings

- Removed the consumer Previous checkout panel, Resume/Ignore/status controls,
  session-storage reminder and listeners, and the reminder-based Pay blocker.
  Removed the unused reminder hook. Old stored hints are inert; no payment or
  historical records were deleted. Price remains on the consultant card, not Pay.
- Preserved current-form stable request IDs, single submission, authenticated
  payment verification, provider signatures, captured-payment checks, slot holds,
  financial review and atomic audits. Closing an unused checkout still releases
  its own hold only after the provider/server proves it was never attempted.
- Fixed a genuine availability bug: date-first search could offer consultants
  whose commission was missing or whose total fee was below Razorpay's INR 1
  checkout minimum. It now rejects those candidates before schedule reads using
  the shared pricing helper. The regression failed before the fix and passed
  after it. Public legacy professional discovery and existing bookings are not
  rewritten; pagination continues through ineligible candidates.
- Fixed three TypeScript assertions in the existing contract test fixture.
  Corrected browser-test assumptions about side-by-side money fields, named policy
  sections and a tablet form that legitimately stacks beside the sidebar. These
  were test defects, not a reason to redesign runtime layouts.

## Verified checks

| Check | Result |
| --- | --- |
| Production build | Passed; 85 pages generated |
| ESLint | Passed |
| TypeScript (`tsc --noEmit`) | Passed |
| Local backend/unit regression suite | 146 passed, none skipped |
| Consultant/checkout/finance browser regression sweep | 116 passed |
| Contract layout browser checks | 4 passed |
| Fresh-build production HTTP smoke suite | 5 passed |
| Diff whitespace check | Passed |

Browser sweep used desktop, 320px phone, 768px tablet and mobile WebKit fixtures.
It covers old payment hints, uncertain retry identity, unused-close retry, consent,
fees, availability changes, consultant edits, schedule states, rescheduling,
cancellation displays, email-failure feedback, finance and responsive geometry.
Backend fixtures cover competing reservations, payment capture/failure/late capture,
idempotency, atomic failures, cancellation/rescheduling release and final slots,
private-data projection, policy snapshots and unchanged Search Center booking.
These are local fixtures, not native Firestore transaction contention or real
provider/SMTP delivery tests.

The fresh local production server returned:

- `/api/health`: 200, `configuration`, 3 configured dependencies, status `ok`.
- `/api/health?deep=true` with JSON Accept: 200, `deep-configuration`, 6 configured
  dependencies, status `ok`. The themed `/health?deep=true` rendered successfully;
  requesting health HTML at the API retained its intended 307 redirect.
- Anonymous schedule/payment requests and 16 missing/invalid-token protected
  requests: expected 401 and no-store responses. No successful mutations attempted.
- Public consultant query: 200, 2 professionals; checked whitelist exclusions.
- Search Center list, one centre's details and packages: 200 with management-field
  exclusions; `/centers` rendered successfully. Reads were bounded.

The first sandboxed public-data check failed because outbound access was directed
to a blocked loopback proxy. Repeating the same fresh-build read-only suite with
network access passed all five tests. Configuration health alone is not proof of
permissions, payment delivery or all APIs. The temporary production server was
stopped after checks.

## Production performance measurements

Baseline and final: three fresh Chromium contexts per route/width, localhost
production builds, no throttling, software rendering, third-party requests blocked,
1.5-second observation. Protected booking measurements are the **anonymous
auth-gated shell**, not the signed-in flow. Values below are medians.

| Route / width | DOM ready ms before → after | LCP ms before → after | Gzipped JS bytes before → after |
| --- | --- | --- | --- |
| Discovery / 390 | 355 → 382 | 492 → 444 | 245,212 → 245,212 |
| Booking shell / 390 | 135 → 108 | 904 → 1,024 | 486,380 → 485,450 |
| Discovery / 1440 | 354 → 103 | 444 → 460 | 245,212 → 245,212 |
| Booking shell / 1440 | 124 → 139 | 924 → 948 | 486,380 → 485,450 |

All samples returned 200 without horizontal overflow. Booking-shell CLS was zero;
discovery CLS stayed about 0.0039 mobile / 0.00066 desktop. The measurable JS
reduction is **930 compressed bytes**; timing varies in both directions and does
not demonstrate an overall speed gain. No production database latency or complete
signed-in interaction-time improvement is claimed. Reproduce the read-only lab
probe with `node scripts/profile-consultation-pages.mjs http://127.0.0.1:3198 final`
against a fresh production server.

## Remaining limits and next priorities

1. Removing cross-page recovery hints does not cancel a payment already processing
   at Razorpay. Current-form retries retain their identity; after refresh/navigation
   the browser no longer remembers an earlier intent. Ambiguous or debited outcomes
   must be checked in My Bookings or with support before paying again. Server
   safety checks remain essential; removing them would not be a safe simplification.
2. Complete an authorized Razorpay Test-mode checkout/webhook exercise, including
   delayed capture, failed payment and SMTP acceptance/failure. Not executed here.
3. Native Firestore rules/contention testing remains unverified: installed Java 8
   cannot run the current emulator requiring Java 21+. Mock atomic tests and HTTP
   authorization failures do not prove deployed authenticated permissions.
4. Availability is bounded to eight candidates per page but can call one consultant
   query plus eight schedule-document and sixteen legacy-booking queries. Consider
   measured, compatibility-aware legacy-query reduction at higher volume; do not
   drop those overlap checks speculatively. Actual database duration was not profiled.
5. Admin appointment changes still await email-delivery outcomes before responding.
   This preserves honest feedback but SMTP latency can lengthen the action. A durable
   delivery worker with separate outcome reporting needs its own approved design.
6. Rate-limit buckets are process-local. Shared enforcement is a scaling/security
   follow-up before multi-instance traffic; no unrelated infrastructure added here.
7. Real iOS/Android devices, slow live networks and field INP were not tested.

The implemented changes passed the stated local and read-only HTTP checks; this is
not a claim that all external payment/delivery release checks have been completed.
