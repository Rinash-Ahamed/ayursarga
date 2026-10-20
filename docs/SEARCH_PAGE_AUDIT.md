# Search Hospitals performance and responsive review

20 October 2026. Scope: `/centers`; no API, permissions, database, or booking changes.

## Findings and changes

- Scrolling the production page triggered seven Next.js detail-route prefetches
  before a hospital was chosen. Result links now disable speculative prefetch;
  deliberate navigation is unchanged.
- Search input rerendered galleries and the comparison workspace. Memoized those
  surfaces and result cards. React deferred rendering prioritizes input over
  result filtering/link updates without a debounce timer. The search context is
  still included in detail links.
- Next-photo decoding started when a native lazy image loaded, even if that
  gallery was outside the viewport. Search galleries now enable adjacent-photo
  preloading near the viewport, with observer cleanup. Other gallery consumers
  retain their existing default behavior.
- Updated responsive image sizes for the new card widths. Existing uploads
  already have 480/800/1200-pixel WebP variants and native lazy loading. No image
  migration, external image service, or new runtime dependency was introduced.
- Results now use two columns on phones/tablets (including landscape) and three
  above 1100px. Images remain 4:3 without distortion. Cards stretch per grid row,
  with aligned actions, compact typography, and readable text previews. Full
  information remains available in centre details. On narrow cards, arrows and
  the image counter remain visible; duplicate dot controls are hidden.
- Added static loading skeletons in the results grid instead of moving a loading
  block above comparison. Controls stay usable while results load.

## Measurement conditions and results

Actual Next.js production build served on local port 3107; Chromium at 390x844,
2x device scale and 4x CPU throttling. The public response was intercepted with
12 synthetic hospitals and two small SVG images each. No live writes or
authentication. One baseline sample; three final samples. These are diagnostic
lab observations, not field INP, real media download measurements, or physical
device benchmarks.

| Observation | Baseline | Final three runs |
| --- | ---: | ---: |
| Automatic detail-route requests | 7 | 0 in every run |
| Results API requests | 1 | 1 in every run |
| Layout shift total | 0.054 | 0 to 0.023 |
| Results ready, including navigation | 7514 ms | 2749 to 3799 ms |
| Median scripted input round trip | 105 ms | 163 to 231 ms |
| Scroll frame interval, p95 | 17 ms | 17 to 50 ms |
| Long-task duration total | 1897 ms | 1426 to 2096 ms |

The request-count saving is repeatable. Loading observations were lower, but
cache, scheduling, and different page geometry limit direct timing comparisons.
Scripted input and scroll timings **do not demonstrate a consistent improvement**;
do not claim universal smoothness or a performance percentage from this test.
The two-column layout also reaches the animated footer earlier in the scripted
scroll than the previous single-column layout. DOM count remained 498 in this
fixture. Browser-native lazy loading produced variable initial image counts;
all runs eventually requested 24 images after scrolling through results.

Three local read-only database timing probes timed out after 15 seconds. The
server reported a refused sandbox network proxy, so this does not establish a
Firestore/query bottleneck. Live backend latency remains unverified.

## Validation

- Production build, ESLint, and `npm run typecheck`: passed on final runtime code.
- Ten responsive/loading tests passed across 320px phone portrait, 844px phone
  landscape, 768px tablet, 1024px tablet landscape, and 1440px desktop.
- Checked column counts, equal row heights, image aspect ratios, horizontal
  overflow, touch input font sizes, filtering, galleries, detail links, comparison,
  and usable controls during loading. Screenshots visually reviewed.
- Three final production profiling runs passed request-count/overflow assertions.
- Chromium emulation only: physical iOS/Android, native Safari, real uploaded
  media bandwidth, deployed cold starts, and real-user INP remain unverified.
- No deployment performed.

Reproduce with a production server on port 3107:

```text
npm.cmd run test:e2e:centre-search
npm.cmd run test:e2e:search-performance -- --repeat-each=3
```
