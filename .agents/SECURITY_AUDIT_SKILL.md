# Security Audit

## Purpose

Review a web application or backend service for security weaknesses before release.

Use this skill for:

- Next.js applications
- React applications
- Node.js / Express APIs
- Firebase
- Supabase
- REST APIs
- Server actions
- Admin portals
- Multi-tenant systems
- Authentication flows
- Payment flows
- File uploads
- Webhooks

## Objective

Identify confirmed vulnerabilities, realistic security risks, and security hardening opportunities without making unnecessary code changes.

Focus on:

- Authentication weaknesses
- Authorization flaws
- IDOR / BOLA
- Privilege escalation
- Session issues
- Token handling problems
- Exposed secrets
- Injection risks
- XSS
- CSRF
- SSRF
- Path traversal
- Unsafe file uploads
- Weak CORS
- Sensitive data exposure
- Missing rate limits
- Insecure webhooks
- Unsafe environment variables
- Misconfigured database rules
- Insecure direct client access
- Logging of sensitive information
- Dependency risks
- Multi-tenant isolation failures

---

## Review Process

### 1. Map the Security Surface

Inspect:

- Authentication entry points
- Login / logout
- Registration
- Password reset
- OAuth flows
- Admin routes
- API routes
- Middleware
- Server actions
- Database access
- File uploads
- Webhooks
- Payment handlers
- External integrations
- Environment variables
- Client-side configuration

Build an internal map:

`Entry Point → Auth Required → Role Required → Data Access → Sensitive Action`

---

## 2. Authentication Checks

Verify:

- Protected routes actually require authentication
- Sessions are validated server-side
- Expired sessions are rejected
- Tokens are verified
- Password reset flows are secure
- Logout invalidates the session where applicable
- OAuth callback handling is safe
- Authentication is not based only on client-side state

Flag:

- Client-controlled identity
- Missing auth middleware
- Missing session verification
- Authentication bypasses
- Trusting user ID from request body

---

## 3. Authorization Checks

Authentication is not authorization.

Check:

- Role checks
- Ownership checks
- Admin-only routes
- Organization boundaries
- Tenant boundaries
- Hospital/user/admin boundaries
- User-to-user data access
- Resource-level access

Look specifically for:

- IDOR
- BOLA
- Privilege escalation
- Horizontal access violations
- Vertical access violations

Example risk:

`GET /api/orders/:orderId`

If any authenticated user can change `orderId` and access another user's order, flag it.

---

## 4. Secrets and Environment Variables

Search for:

- API keys
- Service-role keys
- Private tokens
- JWT secrets
- Database URLs
- SMTP passwords
- Payment secrets
- Cloud credentials

Check:

- Secrets committed to source
- Secrets exposed to frontend bundles
- `NEXT_PUBLIC_*` misuse
- Hardcoded credentials
- Debug output exposing secrets

Do not expose secret values in the audit report.

---

## 5. Injection Risks

Check for:

- SQL injection
- NoSQL injection
- Command injection
- Template injection
- LDAP injection
- Path injection
- Header injection

Verify user-controlled values are validated and parameterized.

Do not pass raw user input directly into:

- SQL strings
- shell commands
- file paths
- database operators
- dynamic evaluation

---

## 6. Cross-Site Scripting

Check:

- `dangerouslySetInnerHTML`
- Raw HTML rendering
- Unescaped user-generated content
- Markdown rendering
- Rich text rendering
- Stored user content
- Query string rendering

Distinguish:

- Reflected XSS
- Stored XSS
- DOM-based XSS

---

## 7. CSRF

Check state-changing requests that rely on browser cookies.

Review:

- POST
- PUT
- PATCH
- DELETE
- Server actions
- Form submissions

Check whether CSRF protection is required based on the authentication model.

Do not flag token-based APIs using non-cookie authorization automatically.

---

## 8. SSRF

Check whether user input can control:

- URLs
- Webhook destinations
- Image fetch URLs
- File import URLs
- Proxy requests
- Server-side fetch requests

Verify internal IP ranges and unsafe protocols are restricted when relevant.

---

## 9. File Upload Security

Check:

- File size limits
- MIME validation
- Extension validation
- Storage location
- Public accessibility
- Filename sanitization
- Malware risk
- Executable uploads
- SVG uploads
- Image processing

Do not trust file extensions alone.

---

## 10. CORS

Check:

- Allowed origins
- Credentials
- Wildcards
- Methods
- Headers

Flag dangerous combinations such as permissive origins with authenticated requests.

---

## 11. Rate Limiting and Abuse Protection

Review:

- Login
- Registration
- Password reset
- OTP
- Search
- Public APIs
- Expensive endpoints
- Payment creation
- Contact forms

Flag missing rate limiting where abuse is realistically possible.

---

## 12. Session and Cookie Security

Check cookies for:

- `HttpOnly`
- `Secure`
- `SameSite`
- Appropriate expiry
- Session rotation
- Logout behavior

Check whether sensitive auth tokens are stored insecurely in:

- localStorage
- sessionStorage
- readable cookies

Report context-dependent risk accurately.

---

## 13. Sensitive Data Exposure

Check API responses and client state for:

- Password hashes
- Tokens
- Internal IDs where unnecessary
- Personal information
- Payment details
- Private notes
- Internal stack traces
- Debug fields

Apply least-data principles.

---

## 14. Database Security

Check:

- RLS
- Firestore security rules
- Database role permissions
- Service-role misuse
- Direct client database access
- Missing ownership rules
- Overly broad queries

For Supabase, verify RLS policies where client access exists.

For Firebase, inspect Firestore / Storage rules.

---

## 15. Webhook Security

Check:

- Signature verification
- Timestamp verification
- Replay protection
- Duplicate handling
- Idempotency
- Unknown event handling

Never trust a webhook solely because it reaches the webhook endpoint.

---

## 16. Payments

Review:

- Amount calculation
- Currency
- Order ownership
- Payment status verification
- Server-side validation
- Webhook confirmation
- Replay protection
- Duplicate processing
- Client-controlled prices

Never trust payment amount or success state supplied by the client.

---

## 17. Security Headers

Check where applicable:

- Content-Security-Policy
- HSTS
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- Frame restrictions

Do not recommend headers blindly if the hosting layer already provides equivalent protections.

---

## 18. Error Handling

Check that production responses do not expose:

- Stack traces
- SQL errors
- File paths
- Framework internals
- Secrets
- Internal service names

Log useful detail server-side while returning safe client messages.

---

## 19. Logging

Check logs for:

- Passwords
- Tokens
- API keys
- Authorization headers
- Payment details
- Sensitive personal data

Flag excessive logging of sensitive material.

---

## 20. Dependency Security

Inspect:

- Outdated high-risk packages
- Known vulnerable dependencies
- Unmaintained security-sensitive packages
- Duplicate auth/security packages

Do not treat all outdated packages as vulnerabilities.

Distinguish:

- Confirmed vulnerability
- Version risk
- Maintenance concern

---

## 21. Multi-Tenant Isolation

For systems with organizations, hospitals, companies, teams or clients:

Verify every sensitive query is scoped to the active tenant.

Check:

- Tenant ID derivation
- Ownership checks
- Admin cross-tenant access
- Storage paths
- Search endpoints
- Reports
- Export APIs

---

## Output Format

### Critical

Confirmed issues that can cause:

- Account takeover
- Unauthorized data access
- Secret exposure
- Payment manipulation
- Remote code execution
- Major data compromise

### High

Serious weaknesses with realistic exploitation paths.

### Medium

Important defense, isolation, validation or hardening gaps.

### Low

Security hygiene and minor improvements.

For each finding provide:

**Location**

File, route, function or configuration.

**Status**

Confirmed issue / Potential risk / Improvement.

**Issue**

What is wrong.

**Impact**

What an attacker could realistically do.

**Recommendation**

Minimal safe fix.

**Example fix**

Only when useful.

---

## Summary Table

| Priority | Area | Location | Finding | Recommendation |
|---|---|---|---|---|
| Critical | Authorization | API route | Missing ownership validation | Validate resource ownership server-side |
| High | Secrets | Config | Secret exposed to client | Move to server-only environment variable |
| Medium | Abuse protection | Login | No rate limit | Add login throttling |

---

## Rules

- Do not make code changes unless requested.
- Do not run destructive tests.
- Do not attempt exploitation against external systems.
- Do not expose discovered secret values.
- Do not report speculative vulnerabilities as confirmed.
- Reference exact files and line numbers where possible.
- Prefer minimal fixes compatible with the current architecture.
- Avoid generic recommendations without evidence.
- Distinguish vulnerabilities from hardening suggestions.
- Do not automatically run full builds, lint, or test suites unless requested or clearly necessary.

## Invocation Examples

`Run a security audit.`

`Check this app for security flaws.`

`Review auth and authorization security.`

`Check Supabase RLS and API security.`

`Audit this Next.js app before production.`

`Check for exposed secrets and insecure routes.`
