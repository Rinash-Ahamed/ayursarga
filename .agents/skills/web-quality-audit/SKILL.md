---
name: web-quality-audit
description: Measure and audit Ayursarga web performance, runtime smoothness, responsive layout, accessibility, headers, SEO, and functional health. Use for performance checks, Lighthouse, responsive testing, or release-quality web audits.
---

# Ayursarga Web Quality Audit

Measure production behavior rather than `next dev`. Establish a baseline before
changing runtime code, address only evidenced issues within scope, and re-measure.
Preserve the public design and portal behavior defined by repository `AGENTS.md`.

Choose checks proportionate to the request:

- For performance, use a production build and report lab metrics, bundle
  evidence, request payloads, and observable bottlenecks.
- For smoothness, inspect long tasks, media cost, scroll work, animation
  properties, and unnecessary hydration.
- For responsive or accessibility work, test representative mobile, tablet,
  and desktop widths and disclose unverified areas.
- For API health, use the API audit skill; one health route does not prove every
  endpoint works.

Read [references/full-audit.md](references/full-audit.md) for a complete audit.
For a focused performance check, apply its setup, static gates, performance,
runtime-smoothness, and reporting sections.

Never invent scores or claim real-device performance from lab measurements.
Do not install tools, add test suites, modify runtime code, or make destructive
requests unless the user authorizes that scope.
