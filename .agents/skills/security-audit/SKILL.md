---
name: security-audit
description: Audit Ayursarga authentication, authorization, Firebase rules, API routes, secrets, data exposure, and role isolation. Use for explicit security reviews or production hardening; do not fix, deploy, or run destructive tests unless requested.
---

# Ayursarga Security Audit

Review realistic attack paths and existing controls before recommending changes.
Cover public routes, Consumer Google authentication, Hospital and Admin
email/password authentication, token verification, Firestore rules, resource
ownership, Admin SDK boundaries, sensitive projections, and audit integrity.

Treat repository `AGENTS.md` as product security policy. Do not weaken role
isolation, deletion protection, audit immutability, consent, or activation rules.
Never reveal secret values found during inspection.

Read [references/checklist.md](references/checklist.md) for a broad audit or only
the relevant sections for a focused review. Label results as confirmed issues,
potential risks, or improvements, with evidence and minimal remediation.

Do not exploit external systems, mutate production data, deploy rules, install
dependencies, or run broad validation unless explicitly requested.
