# Image delivery audit, 11 November 2026

Application version: 4.45.4. No deployment, remote writes, new provider or dependency.

## Result

Retained the UI, source artwork, media animations, responsive frames, public/portal boundaries and upload authorization. Optimization is still enabled globally. Small pre-sized marks bypass the optimizer; large photography remains responsive and optimized. Original source files and previously uploaded objects are not removed.

## Image inventory

| Area | Before | Current delivery |
| --- | --- | --- |
| Nav, PublicOpening, ScrollLogo, Footer, AuthFormShell, PortalShell, health page | Same 396,742-byte PNG with several widths and 75/82/90 qualities | One shared 192px transparent WebP, 11,818 bytes, direct immutable URL. Supports the largest 72 CSS-px display at over 2.5x density. Existing dimensions/styles unchanged. |
| WhatsAppBubble | Optimized 86,177-byte oversized PNG | Direct 128px WebP, 3,870 bytes; existing 42px box and styling preserved. |
| Hero | 1600x900 WebP via redundant custom optimizer loader | Identical source bytes copied to a content-hashed URL, default Next loader, responsive sizes=100vw, existing priority/poster-ready video gate retained. |
| Sanctuary / Why Ayursarga | 1402x1122 PNG, 2,411,554 bytes | Same dimensions/aspect as WebP, 280,164 bytes, still Next optimized at quality 82 with existing responsive sizes/loading. |
| WellnessGuide six cards | Two multi-megabyte JPEGs and four smaller JPEGs, quality 82 | Content-hashed WebP sources, max width 960 without upscaling, aspect preserved, responsive Next optimization retained at quality 82. No card content/layout/effects removed. |
| WellnessGuide selected 58px image | Re-optimized card source at quality 75 | Dedicated direct 128px WebP thumbnail, all under 10 KB. |
| Voices partner photo | Direct WebP picture, 640/1280 sources | Unchanged: already optimized at build time with native sizes/srcset. |
| TreatmentFilm | Direct 50 KB WebP fallback poster | Unchanged: reduced-motion/failure fallback and lazy loading retained. |
| AyuPortrait / hospital-partner login icon / neem SVG / PWA icons | Direct small WebP, SVG or application icons | Unchanged; do not use Vercel transformations. |
| Hospital Search/cards/details/comparison | Native img with managed 480/800/1200 WebP srcset; legacy HTTPS/Drive passthrough | Public source selection unchanged. Portal HospitalImageManager/Gallery now reuse the same managed srcset, declared dimensions and lazy loading instead of always downloading the 1200 source. Links still open the full image. External/legacy URLs are not rewritten into imaginary derivatives. |
| ConsultantPhoto | Direct tokenized 384x384 WebP | Unchanged; already generated and compressed at upload. No additional Storage files/fields needed. |
| Google profile avatars | Direct external Google URL | Unchanged bypass behavior; local fallback now uses the shared small logo. |
| Contract/invoice HTML, PDF/signature, email assets | Native original PNG assets, outside Next Image | Preserved to avoid changing exported-document quality/layout. Not a source of Vercel image transformations. |

There is no /_vercel/image implementation. The remaining /_next/image consumers are Hero, Sanctuary and the six WellnessGuide card photos. Existing layouts reserve space, use explicit dimensions or fill inside sized containers, and use responsive sizes. No new API/listener/polling/photo queries were added to page views.

## Cache and variants

- Existing default width pool: 15. Current explicit pool: 9, combining deviceSizes 640/800/1200/1600/1920 and imageSizes 64/128/256/384. Large sources keep enough coverage for retina phone/tablet and desktop; no benefit in upscaling the 1600px hero to the old 3840px variant.
- Quality allowlist reduced from 70/75/82/90 to 75/82. Photographic components emit 82; small marks no longer produce high-quality optimizer variants. AVIF and WebP negotiation remain enabled.
- Configured optimizer minimumCacheTTL: 31 days, versus the installed Next default of four hours. All changed local photographic inputs use content-hashed paths so replacements do not reuse an old cached source identity.
- Derived /optimized paths have one-year immutable cache headers. Regenerate with node scripts/prepare-static-images.mjs after source artwork changes; commit the new manifest and referenced assets. Never overwrite an existing content-hashed filename with different bytes. Originals remain available for contracts/source maintenance.
- Hospital uploads already generate 480/800/1200 WebP at the authenticated server endpoint, consultant uploads 384px WebP. Both use UUID object names, persistent download tokens and one-year immutable metadata. No Date.now/random query cache busting was found in these image renderers; tokens are created only on upload/replacement, not each render. Existing fixed Drive sz=w1200 URLs remain external-provider controlled.
- The theoretical configured width/quality/format space falls from 15x4x2=120 to 9x2x2=36 combinations per source. This is a ceiling, not a claim of 70% fewer billed operations. Browsers only request relevant sizes; actual regional misses and cache-unit accounting require Vercel usage data.

## Measurements

Local Chromium, production builds, same machine, external network blocked, reduced motion, fresh browser contexts. Mobile 390x844 at DPR2, tablet 820x1180 at DPR2, desktop 1440x900 at DPR1. Scripts scroll through the same sections. Source byte totals are not equivalent to delivered bytes because Next already resized the original photos before this change.

| Viewport | Optimizer requests before / after | Encoded image bytes before / after | Byte reduction |
| --- | --- | --- | --- |
| Mobile | 11 / 8 | 480,781 / 462,493 | 3.8% |
| Tablet | 11 / 8 | 1,050,722 / 1,018,276 | 3.1% |
| Desktop | 11 / 8 | 739,899 / 706,189 | 4.6% |

- 27% fewer distinct optimizer requests in this homepage journey; eliminated marks also avoid image-transformation cache reads/writes entirely. Direct assets still incur normal CDN requests/bandwidth, not free delivery.
- At a hypothetical miss per requested image, the sum of ceil(encoded optimized bytes / 8192) falls mobile 49 to 46, tablet 104 to 101, desktop 82 to 74. These are estimates using local negotiated output sizes, not measured Vercel write/read usage. Repeated regional hits, cache state and deployed formats affect actual billing.
- Nine replaced full-size static source files total 7,829,154 bytes before versus 706,072 after (91% smaller input set). New thumbnails add small assets. The hero poster is byte-identical. Source reduction is not claimed as a 91% page bandwidth saving.
- Observed initial LCP before/after: mobile 3984/3504ms, tablet 6360/7884ms, desktop 2440/6012ms. First-pass results are mixed and affected by cold encoding/cache state and concurrent local work. They do not establish a speed improvement.
- A separate after-change warm-cache repeat measured LCP mobile 784ms, tablet 492ms, desktop 544ms. No matching warm-baseline run exists, so these are descriptive local results only, not a before/after speedup or production SLO.
- All three production-page audits had zero detected broken images and no document horizontal overflow. Mobile wellness and desktop hero screenshots reviewed; geometry and appearance preserved. No physical-device or exhaustive 4K clarity claim.

## Storage permission verification

Approved bounded read-only live check selected one published hospital and an active consultant portrait, projecting only image fields. Hospital 480/800/1200 objects and consultant portrait returned HTTP 206 for one-byte range requests, image/webp, public,max-age=31536000,immutable. Removing tokens returned 403 for both sampled assets. No URLs/tokens, customer records or credentials logged; no objects, rules or permissions modified. This sample does not verify every gallery or prove bucket-wide IAM security. Public token URLs remain shareable/downloadable by anyone possessing them; removing a gallery entry does not revoke an already-public URL, per existing preservation policy.

## Validation and limits

- Lint: passed, zero errors, three pre-existing warnings (two TreatmentFilm cleanup refs, one raw-img media fixture). No suppressions added.
- Typecheck: passed as a separate no-emit run and in the final production build.
- Final production build passed compilation, TypeScript and all 87 static pages. Initial sandbox worker failed with EPERM; approved build rerun passed.
- 21 focused unit/fixture tests passed: image delivery/assets, hospital-gallery authorization/preservation, consultant photo authorization/revisions and Chromium/WebKit browser upload preparation.
- 12 media browser regressions passed across phone, desktop and mobile WebKit: video staging, rotation, pause, poster failure/reduced-motion and hero readiness gate.
- 12 centre-details browser regressions passed across phone/desktop: reserved layout, package links, empty/failure recovery and visibility behavior.
- Same final build basic/deep health JSON: 200/ok, configuration/deep-configuration modes, all six deep dependencies ready. Themed /health?deep=true: HTTP200, styled heading, no browser page errors, screenshot reviewed. Temporary audit servers stopped. Health is configuration validation, not proof of booking/email/payment delivery.
- Updated only UXP-008 F13/G13 in the local QA workbook; 25 sheets and all methods, results, execution history and other ZIP members preserved. Artifact renderer failed to load native Skia; used documented fallback via narrow XML edit, openpyxl read verification and Pillow before/after previews. Existing workbook styles/controls were not rewritten.
- No deployments, image uploads, patient-data changes, emails or payment operations. No migration/Storage rules/index deployment needed. Private portal screenshots/authenticated live workflows, all uploaded images, physical devices and production Vercel usage remain unverified.

## Follow-up

### Continuation verification

The existing uncommitted implementation and saved before/after artifacts were
reviewed without replacing their measurements. Fresh lint (zero errors, the same
three warnings), separate typecheck, production build, 21 focused tests and 24
media/centre-details browser regressions passed. A separate
`node scripts/audit-image-delivery.mjs verification` run preserved those original
artifacts and reproduced eight optimizer requests at each viewport, exactly the
same transferred image bytes as the after table, zero detected broken images and
no horizontal overflow. Its warm local LCP samples were 1004/584/656ms for
mobile/tablet/desktop, not a controlled before/after speed comparison. Production
screenshots were reviewed. Fresh-build basic/deep health JSON and the styled
health page passed; temporary servers were stopped. No live Storage sample was
repeated in this continuation, and configuration checks do not verify delivery.

Compare Vercel's transformations and cache read/write units for equal traffic windows after an owner-approved deployment. Keep an eye on ordinary CDN/Firebase egress as well as optimizer units. Validate newly generated photos before publication and keep content-hashed static paths immutable. External Drive photos have no app-controlled cache/resize guarantees; replace through existing uploads when owners supply suitable originals, not by silently fetching/migrating them.

Vercel Hobby commercial-use eligibility is separate from optimization savings; confirm the correct hosting plan for a business site. No hosting migration, plan change or CPU upgrade performed.

References: [Next Image configuration](https://nextjs.org/docs/app/api-reference/components/image), [Vercel image usage/cost guidance](https://vercel.com/docs/image-optimization/managing-image-optimization-costs), [image cache-unit accounting](https://vercel.com/docs/image-optimization/limits-and-pricing).
