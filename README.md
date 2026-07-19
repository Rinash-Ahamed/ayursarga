# Ayursarga — Next.js / TypeScript build

The full stack version: Next.js 14 (App Router) + TypeScript + Tailwind CSS +
GSAP/ScrollTrigger + Lenis + Framer Motion + React Three Fiber (Three.js).

## Run it

```bash
npm install
npm run dev       # http://localhost:3000
```

```bash
npm run build      # static export -> ./out (deploy anywhere: Vercel, Netlify, S3/CloudFront)
npm run start       # only if you remove `output: "export"` in next.config.js for a Node server instead
```

Verified: `npm run build` completes clean (typechecks + static export) on Node 22.

## Structure

```
app/
├── layout.tsx        fonts (linked, not next/font — see note below), metadata
├── page.tsx           renders <PageShell/>
└── globals.css        design tokens, section layout, keyframes

components/
├── PageShell.tsx       assembles the page, gates hero animation on preloader
├── Preloader.tsx        logo line-draw intro (Framer Motion)
├── SmoothScroll.tsx     Lenis + GSAP ticker + ScrollTrigger wiring
├── ParticleField.tsx    GPU-instanced leaves/petals (react-three-fiber)
├── ProgressFlame.tsx    scroll-scrubbed logo-flame outline (GSAP ScrollTrigger)
├── CustomCursor.tsx      cursor that grows over [data-hover] elements
├── MagneticButton.tsx    spring-based magnetic hover (Framer Motion)
├── Reveal.tsx            RevealLines / RevealWords / FadeUp — shared scroll reveals
├── Nav.tsx, Hero.tsx, Philosophy.tsx, Journey.tsx, Therapies.tsx,
│   Sanctuary.tsx, Voices.tsx, Contact.tsx, Footer.tsx
└── public/logo.jpg
```

## Why GPU-instanced particles, not Canvas2D

`ParticleField.tsx` uses `@react-three/fiber` with `InstancedMesh` (leaves
and petals, split into near/far depth tiers) instead of a 2D canvas loop.
Each frame updates a transform matrix per instance and pushes one draw call
per group — five groups total — so the ambient motion stays on the GPU and
doesn't compete with React or the scroll thread. Combined with:

- **Lenis** for the actual scroll interpolation (so scroll and animation
  share one RAF loop via `gsap.ticker`),
- transform/opacity-only CSS and Framer Motion animations everywhere else,
- `will-change` hints only where things actually move,

...this is what gets the site close to a genuine 120fps feel on capable
displays, rather than just claiming it. It also respects
`prefers-reduced-motion`: the particle field and Lenis both no-op if the OS
setting is on.

## Note on fonts

`layout.tsx` links Fraunces/Manrope from Google Fonts directly rather than
using `next/font/google`. This build's sandbox couldn't reach
`fonts.googleapis.com` at build time (network allowlist), and `next/font`
fails the build hard if it can't fetch — the linked-tag approach is
network-independent at build time and degrades gracefully either way. If
your deployment has open network access, you can switch to `next/font/google`
for self-hosted/optimized fonts; both are a five-line change in `layout.tsx`.

## Extending

- `ParticleField.tsx`: tune `count`, `colorA/colorB`, and `opacity` per
  `<InstancedGroup>` in `Scene()` to change density and palette mix.
- Swap `.sanctuary-frame` / `.hero-glow` gradients for real photography via
  `next/image` when available.
- `Contact.tsx`'s form is presentational (`preventDefault`) — wire it to
  your booking backend or a form service.
- Tailwind is configured with the brand tokens (`tailwind.config.ts`) and
  handles base/reset; most section styling lives in `globals.css` because
  the animation-heavy layout (masks, gradients, keyframes) is clearer there
  than as long utility strings — mix in Tailwind utility classes freely for
  new sections.
