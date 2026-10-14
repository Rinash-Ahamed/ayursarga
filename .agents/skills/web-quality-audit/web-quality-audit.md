---
name: "web-quality-audit"
description: "Audit any web project for performance, accessibility (axe), responsive layout, security headers and SEO; fix issues, re-measure and report honestly. Use before shipping or when asked to test/optimise a site."
---

# Web quality audit (performance · axe · responsive · security · SEO)

A repeatable, project-agnostic audit. Works for Next.js, Vite, Astro, plain HTML. Measure first, fix root causes (never suppress warnings), re-measure, then report what was and was not verified.

## 0. Rules of honesty
- Never claim a test passed unless it was actually executed in this session. Quote real numbers.
- Lab numbers from a sandbox (software rendering, throttled CPU) are relative, not representative of real devices. Say so. Never promise a frame rate (e.g. 120fps); report measured frame/long-task data instead.
- Separate: (a) fixed and re-verified, (b) fixed but not re-run, (c) known and unfixed.
- If a tool/network is unavailable (e.g. cannot reach the live site or CDN), say so; do not invent data.
- Before saying a browser/tool is unavailable, actually look for it (`ls /opt/pw-browsers`, `which chromium google-chrome`).

## 1. Setup
1. Detect stack: `package.json` scripts, framework, package manager, test runner.
2. Production build is the only valid perf target: `npm run build && npm run start -p <port>`. Never measure `dev`.
3. Chromium: use system/preinstalled (`PW_CHROMIUM_PATH`, `/opt/pw-browsers/chromium`) with `--no-sandbox` in containers. Do not run `playwright install` if one exists.
4. Install tooling in a scratch dir when you don't want to touch the project: `npm i lighthouse` there; `npm i -D @playwright/test @axe-core/playwright` in the project.
5. Stub third-party/CDN images in tests (`page.route('**/_next/image**', ...)` returning a 1x1 PNG) so tests never depend on external hosts.

## 2. Static gates (run first, fix before anything else)
- Typecheck (`tsc --noEmit`), lint (`eslint .`), production build. Zero errors; fix warnings at the root, do not add disable comments unless justified and used.
- `npm audit --omit=dev` — report, don't blindly `--force`.
- Check the build route table: pages that should be static must show static (○), not dynamic (ƒ).

## 3. Responsive sweep (Playwright, no framework needed)
Widths: 320, 360, 390, 430, 600, 768, 820, 1024, 1180, 1280, 1440, 1920 (include tablets: 768/820 portrait, 1024/1180 landscape).
For every route and width assert:
- `document.documentElement.scrollWidth <= clientWidth` (no horizontal overflow). If it fails, bisect by listing elements whose `getBoundingClientRect().right > innerWidth`; prefer `overflow-x: clip` (not `hidden`, which breaks `position: sticky`) on the page wrapper once the real culprit is understood.
- Exactly one visible primary navigation (e.g. desktop nav vs bottom dock) — no duplicated/squashed nav at tablet widths.
- Hero/art stays inside the viewport; images keep aspect ratio; no clipped text.
- Tap targets >= 44x44 CSS px for touch widths (>= 24px is the WCAG 2.2 AA floor); check `a, button, input, select, summary` bounding boxes, ignore inline links in prose and visually-hidden honeypots.
- Text >= 16px for inputs on mobile (prevents iOS zoom); safe-area insets respected on fixed bars (`env(safe-area-inset-bottom)`).
Take screenshots at tablet widths and LOOK at them (wait ~2s for entrance animations before capturing).
Fix patterns: breakpoints for nav (switch to bottom dock below `lg` if the top nav doesn't fit), `shrink-0` on logos, cap decorative bleed to page padding, `min-h-11` on links.

## 4. Accessibility (axe-core + manual)
`@axe-core/playwright`, tags `wcag2a, wcag2aa, wcag21a, wcag21aa` (add `wcag22aa` if supported). Run for every route in every theme (light/dark) and at mobile + desktop widths. Assert zero violations; print `id: target` for failures.
```ts
const res = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
expect(res.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0,3).join(' | ')}`)).toEqual([]);
```
Axe only catches ~30–40% of issues. Also check manually:
- Keyboard: Tab order, visible focus ring, no traps, skip link, Esc closes overlays, arrow keys on custom widgets.
- `prefers-reduced-motion` honoured (animations off, theme switch still works); no auto-moving content without pause.
- Colour contrast in BOTH themes incl. hover/disabled/placeholder and text over images/gradients.
- Forms: labels, `aria-invalid`/`aria-describedby`, errors focus the first invalid field, status messages in `role=status/alert`.
- Images: meaningful `alt`, decorative `alt=""`; landmarks (`header/nav/main/footer`), one `h1`, heading order; `lang` on `<html>`; page titles unique per route.
- Zoom to 200% and 400% reflow; text-spacing overrides; no content lost.

## 5. Performance
### 5a. Lighthouse (mobile default + desktop preset)
```bash
export CHROME_PATH=/opt/pw-browsers/chromium   # or system chrome
npx lighthouse http://localhost:PORT/ --only-categories=performance,accessibility,best-practices,seo \
  --chrome-flags="--headless=new --no-sandbox" --output=json --output-path=out.json --quiet
# desktop: add --preset=desktop
```
Run each page 2–3 times and use the median (results vary). Record: score, FCP, LCP, TBT, CLS, Speed Index, total bytes, unused JS. Targets (mobile lab): LCP < 2.5s, CLS < 0.1, TBT < 200ms, INP < 200ms (field metric — cannot be measured in lab; say so).
Inspect culprits from the JSON: `largest-contentful-paint-element`, `bootup-time`, `mainthread-work-breakdown`, `long-tasks`, `unused-javascript`, `legacy-javascript`, `dom-size`, `render-blocking-resources`.

### 5b. Bundle
Sum gzip size of chunks the route loads (`curl` the HTML, grep `/_next/static/chunks/*.js`, `gzip -c | wc -c`). Look for: heavy libs on routes that don't need them (validation libs, icon packs, animation libs), duplicated deps, client components that could be server components, below-the-fold islands that can be dynamically imported.

### 5c. Things that repeatedly turned out to matter
- A root `loading.tsx`/Suspense fallback on a static site can hide the whole page behind a spinner at first load (page height tiny at `load`). Remove it unless data truly streams.
- Backdrop-filter blur on many cards and animated `filter:` (brightness/blur) are the costliest paints on phones: disable `backdrop-filter` and animate opacity/transform only below ~1024px. (Took TBT 2.1s → 0.18s on one project.)
- Animation libraries: load features lazily (`LazyMotion` + async `domMax`, `m.*` components) so they leave the critical path.
- LCP element is often the logo or hero image: ship correctly sized assets (e.g. 2x of display size, WebP/AVIF), `priority`/`fetchpriority=high` on the true LCP image only; avoid shipping a 900px logo for a 32px slot.
- Fonts: self-host, subset, `font-display: swap`, preload only the one or two used above the fold; no render-blocking third-party font CSS.
- Images: `next/image`/`<img>` with width+height (no CLS), `loading=lazy` below the fold, modern formats, don't over-quality.
- Animate only `transform`/`opacity`; avoid layout-triggering properties; use `content-visibility:auto` for long below-fold sections; pause offscreen animations (`IntersectionObserver`).
- Scroll-linked effects: use motion values/CSS variables updated in `requestAnimationFrame`, never React state per frame; passive listeners.
- Third-party scripts: none by default; if needed, `defer`/lazy-load after interaction.

### 5d. Runtime smoothness (optional, sandbox-limited)
Drive a scripted scroll with Playwright and collect `PerformanceObserver` `longtask` entries and rAF frame deltas (p50/p95/worst). Report as software-rendered/non-representative. Never state a guaranteed fps.

## 6. Security & robustness
- Headers (curl -I): `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, no `X-Powered-By`. Note any `unsafe-inline`/`unsafe-eval` as a known weakness.
- Forms/APIs: schema validation server-side (not only client), same-origin check (Origin / Sec-Fetch-Site), content-type + body-size limits, per-IP/global/per-identifier rate limiting (use rightmost trusted X-Forwarded-For entry), honeypot, signed single-use time-trap token, strip control chars/CRLF, no PII in logs, generic error messages, `Cache-Control: no-store` on API responses. Test each with `request.post` (replay, forged token, cross-origin, oversized, wrong content-type, honeypot).
- Remember in-memory rate limits are per process; recommend a shared store (Redis/KV) for multi-instance.
- Secrets only via env; confirm `.env*` not in the repo/zip.
- Test hygiene: tests that hit a rate-limited endpoint must use unique IPs (`x-forwarded-for`) and unique identifiers (e.g. random phone numbers), or they will fail from shared server state.

## 7. SEO & metadata
- Unique `<title>` and meta description per route, canonical URL, `lang`, viewport, OG/Twitter tags and an OG image, `robots.txt`, `sitemap.xml`, JSON-LD (LocalBusiness/Product/FAQ only with REAL data), favicon set, `manifest.webmanifest`, `theme-color`.
- Icons: favicon.ico (16/32/48), apple-touch 180, Android 192/512, maskable 192/512 (about 26% padding), plus intermediate sizes if wanted. Generate from the real logo (Pillow); view a contact sheet before shipping.
- Links: crawl every `<a href>` on every route; internal must return <400, external hosts must be on an allowlist, `tel:`/`mailto:`/`wa.me` well-formed, `rel="noopener noreferrer"` on `target=_blank`. 404 page exists and is useful.

## 8. Functional smoke (Playwright)
No console errors/page errors on every route; theme toggle works without reload, persists, no flash, preserves scroll; each CTA navigates; forms validate, show honest success/error states, never imply something was booked if it wasn't; both desktop and a 360px mobile project.

## 9. Environment gotchas (learned the hard way)
- Tool calls time out around 2 minutes: run long jobs in the background (`setsid nohup cmd > log 2>&1 < /dev/null &`), then poll the log with `sleep` + `tail`.
- Never `pkill -f <pattern>` / `pgrep -f` with patterns that match your own shell (kills the session, exit 144). Free ports with `fuser -k PORT/tcp`.
- Playwright `webServer` building inside the test run is slow; start your own server on the test port and rely on `reuseExistingServer`.
- Restart the server between full runs if tests mutate in-memory limits.
- `scrollTo({behavior:'instant'})` in tests (smooth scrolling makes assertions flaky).
- Strict-mode locator errors: scope locators (`getByRole('navigation',{name})`, `.filter({visible:true})`), avoid matching Next's route announcer `role=alert`.
- Sandboxes often can't reach CDNs/fonts/live sites — stub or self-host, and disclose.

## 10. Workflow
1. Task list: static gates → responsive → axe → Lighthouse baseline → fixes → re-measure → full test suite → report.
2. Baseline BEFORE changing anything; keep numbers.
3. Fix highest-impact items first; re-measure after each meaningful change.
4. Add regression tests for what you found (overflow sweep, axe, link crawl, security) to the repo so the audit is repeatable (`tests/e2e/*.spec.ts`, npm scripts).
5. Final run: typecheck, lint, build (zero warnings), full Playwright on desktop + mobile (+ tablet project if layouts differ), Lighthouse median.

## 11. Report template
- **Scores (before → after):** Lighthouse perf/a11y/best-practices/SEO, LCP, TBT, CLS, bytes (mobile + desktop), with the test conditions.
- **Fixed:** each issue, root cause, change.
- **Tested (executed):** command + result counts (e.g. 93/94 passed, 24/24 axe).
- **Not tested / not verifiable here:** field INP, real devices, real network, Safari/Firefox, screen readers, etc.
- **Known gaps:** security policy weaknesses, per-process rate limits, placeholder assets, unverified content.
- **Next steps:** ordered, short.