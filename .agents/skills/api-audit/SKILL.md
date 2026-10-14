---
name: api-audit
description: Audit Ayursarga API routes and frontend integrations for correctness, authorization, validation, data integrity, performance, and response consistency. Use for API reviews, route health, duplicate requests, or production readiness; do not modify code unless requested.
---

# Ayursarga API Audit

Map the actual API surface before reporting findings. Inspect route handlers,
shared server utilities, callers, Firebase authorization, validation, response
contracts, pagination, atomic writes, audit logging, and error handling.

Follow the repository `AGENTS.md` guardrails. Preserve role boundaries,
soft-delete requirements, atomic audit writes, bounded reads, and the public
hospital projection. Distinguish confirmed defects from risks and improvements.

Read [references/checklist.md](references/checklist.md) for a full API audit or
when several routes are involved. For a narrow endpoint issue, use only the
relevant checklist sections.

Do not run builds, lint, broad health checks, destructive requests, deployments,
or live mutations unless explicitly requested. Report only checks that ran.
