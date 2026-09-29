---
name: ayursarga-design-taste
description: Preserve and refine the Ayursarga public website without redesigning it. Use for public-page visual polish, responsive layout, accessibility, typography, imagery, and motion. Do not use for portal workflows, dense product UI, legal-copy editing, or unrelated architecture work.
---

# Ayursarga Public Design Skill

Use this skill only when a task affects the visual presentation or interaction
quality of Ayursarga's public-facing pages.

This is a preservation-first skill. It does not authorize a redesign, content
rewrite, dependency migration, new imagery, or broader application changes.

## 1. Authority and precedence

Apply instructions in this order:

1. The user's current request.
2. Repository-wide `AGENTS.md` requirements.
3. Existing Ayursarga behavior and established design patterns.
4. This skill.

If this skill conflicts with any higher-priority source, ignore the conflicting
part of this skill. Reading or selecting this skill must never change application
files by itself. Inspect first and modify only what the current request requires.

## 2. Scope gate

### Use this skill for

- Public landing and informational pages.
- Public navigation and footer presentation.
- Public hospital search and centre-detail presentation.
- Public responsive layout and visual hierarchy.
- Public animations and interaction polish.
- Accessibility and clarity improvements to public interfaces.

### Do not use this skill to redesign

- Admin portal pages.
- Hospital portal pages.
- Consumer profile completion or booking-management screens.
- Dashboards, tables, operational forms, contracts, or audit views.
- Authentication, Firebase services, Firestore rules, or API routes.

Portal work must reuse `app/portal.css` and the existing portal components. A
portal task may borrow accessibility and performance checks from this skill,
but not its marketing-page composition rules.

### Protected content

Never rewrite or restyle in a way that changes the meaning of legal policies,
patient or service consent, contracts, medical disclaimers, or regulated text.
For legal pages, visual work is limited to readability, spacing, responsive
layout, navigation, and accessible semantic structure. Preserve supplied text
exactly unless the user explicitly requests a content correction.

## 3. Existing system is the design source

Before editing, inspect the affected component and nearby styles. Reuse the
current implementation wherever possible.

Ayursarga currently uses:

- Next.js App Router and React.
- Tailwind CSS 3 where utilities are already present.
- Project CSS in `app/globals.css` and `app/portal.css`.
- `framer-motion` for selected motion.
- Lenis for supported desktop smooth scrolling.
- Manrope for primary interface typography.
- Cormorant Garamond for selected established display treatments.
- An established white, forest-green, gold, and supporting neutral palette.

Do not migrate Tailwind, replace `framer-motion`, install a design system, add
an icon library, or change font loading during routine visual work. Such
migrations require an explicit request and a separate review.

## 4. Preservation rules

Unless explicitly requested, preserve:

- Routes, anchor IDs, navigation labels, and link destinations.
- Logo and wordmark treatment.
- Current colors and semantic color roles.
- Typography families and established display-font usage.
- Component order and page information architecture.
- Form fields, validation behavior, analytics identifiers, and labels.
- Existing media, content, authentication, and role boundaries.

Do not silently introduce:

- Dark mode or a theme switcher.
- New section layouts, generated images, or stock images.
- External image dependencies or decorative animations.
- Custom cursors.
- Hover movement that shifts layout boxes or causes collisions.
- Admin controls on public, Hospital, or Consumer interfaces.

## 5. Design read

For a substantial public-page task, make a short internal assessment:

- What exact visual problem did the user identify?
- Which existing component owns the problem?
- Which established Ayursarga pattern should be reused?
- What is the smallest change that solves it?
- Could it affect mobile, tablet, reduced-motion users, or page speed?

Do not force arbitrary design scores or announce a design manifesto for small
maintenance requests.

## 6. Public visual language

The intended character is calm, premium, trustworthy, modern, and grounded in
Ayurvedic care. Achieve that through clarity and restraint rather than novelty.

### Typography

- Keep Manrope as the default interface and body typeface.
- Keep Cormorant Garamond only for established display emphasis.
- Protect italic descenders with sufficient line height and lower padding.
- Maintain clear heading, label, body, and metadata hierarchy.
- Do not replace fonts globally during a local visual task.

### Color

- Reuse current semantic variables and the existing palette.
- Keep natural-white surfaces where established.
- Preserve forest and gold as primary brand roles.
- Keep semantic success, warning, pending, and error colors distinguishable.
- Do not add dark mode unless explicitly requested and approved.

### Spacing and alignment

- Prefer existing containers and spacing variables.
- Remove accidental gaps caused by fixed heights, excessive padding, grid
  alignment, or hidden elements retaining space.
- Keep related content connected without making it cramped.
- Align content to a clear grid at desktop, tablet, and mobile sizes.
- Avoid changing unrelated sections while fixing one component.

### Cards and controls

- Use cards only when they communicate grouping or interaction.
- Match neighboring radius, border, shadow, and control styles.
- Hover may change color, border, shadow, image scale, or emphasis without
  moving the component's layout box.
- Keep button labels readable and touch targets comfortably usable.

## 7. Motion and smoothness

Motion must communicate hierarchy, feedback, progress, or state change.

- Prefer `transform` and `opacity` for frequent animation.
- Keep motion isolated in small Client Components.
- Reuse `framer-motion`; do not add another animation library without approval.
- Continuous values must not cause React renders on every frame.
- Passive listeners with `requestAnimationFrame` throttling are acceptable when
  they are the simplest correct solution.
- Clean up listeners, observers, frames, timers, and animation instances.
- Respect `prefers-reduced-motion` and provide a stable static result.
- Avoid combining heavy blur, filters, video, and scroll effects on mobile.
- Do not override native scrolling on constrained or reduced-motion devices.

## 8. Images and media

- Reuse supplied Ayursarga assets before considering anything new.
- Do not invoke image generation merely because a tool is available.
- Generate or source an image only when the user asks or approves it.
- Preserve aspect ratio and avoid stretching during hover zoom.
- Reserve dimensions to prevent layout shift.
- Use responsive sizing and compression without visible blur.
- Prioritize only genuine above-the-fold LCP media.
- Keep video fallbacks stable and avoid visible image-to-video jumps.
- Avoid external placeholder services in production UI.

## 9. Responsive and accessible behavior

Every edited component must remain usable in mobile portrait and landscape,
tablet portrait and landscape, standard desktop, and wide desktop.

Check for:

- No horizontal overflow or clipped content.
- Stable image and video aspect ratios.
- Logical reading and keyboard order.
- Visible focus states and adequate contrast.
- Comfortable touch targets.
- Correct dialog focus, Escape handling, and scroll locking.
- Reduced-motion behavior.

Do not require a dark variant for Ayursarga's deliberate light presentation.

## 10. Content discipline

- Preserve user-supplied wording unless editing is requested.
- Correct display encoding issues without changing meaning.
- Use concise interface labels and clear error messages.
- Do not invent ratings, testimonials, outcomes, prices, statistics, or claims.
- Do not turn healthcare information into promotional medical claims.
- Avoid fake metadata, status indicators, version labels, and filler text.
- Use normal hyphens in new UI copy, but never alter protected source text just
  to enforce punctuation style.

## 11. Dependencies and assets

Before importing a package, verify `package.json`.

- Prefer existing dependencies and components.
- Do not install a design system for a local visual adjustment.
- Do not mix component systems.
- Do not add an animation library for an effect supported by CSS or
  `framer-motion`.
- Do not replace working icons merely to enforce an arbitrary icon family.
- Keep bundle impact proportional to user-visible benefit.

## 12. Validation policy

Inspect changed source and perform narrowly scoped, non-mutating checks only as
needed. Do not run ESLint, TypeScript typecheck, production build, API or route
health checks, Lighthouse, or other full-site audits unless the user explicitly
asks. When requested, run checks once after related changes are complete.

## 13. Ayursarga pre-flight check

Confirm only checks relevant to the edited surface:

- [ ] The requested issue is fixed without redesigning unrelated areas.
- [ ] Existing content, links, routes, and functionality are preserved.
- [ ] The change follows current Ayursarga color and typography rules.
- [ ] Desktop, tablet, and mobile layouts remain coherent.
- [ ] No component moves or collides on hover.
- [ ] Images and videos keep their intended aspect ratio.
- [ ] Motion is lightweight, cleaned up, and reduced-motion safe.
- [ ] Text, controls, focus states, and errors remain readable.
- [ ] No unnecessary dependency or external asset was introduced.
- [ ] No protected wording changed unintentionally.
- [ ] Portal and authentication boundaries are unaffected.
- [ ] Only explicitly requested validation commands were run.

If a check does not apply, omit it rather than expanding the work.
