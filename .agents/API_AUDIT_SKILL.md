# API Audit

## Purpose

Review backend APIs and identify functional, security, validation, performance, data-integrity, and integration gaps.

Use this skill when reviewing:

- REST APIs
- Next.js API routes
- Express / Node APIs
- Firebase functions
- Supabase APIs
- Backend services
- OpenAPI / Swagger definitions
- Postman collections
- Frontend-to-backend integrations

## Objective

Inspect the API implementation and produce actionable findings without unnecessarily modifying code.

Focus on identifying:

- Missing API endpoints
- Broken or inconsistent API contracts
- Missing validations
- Authentication issues
- Authorization gaps
- Incorrect HTTP methods
- Incorrect HTTP status codes
- Poor error handling
- Security vulnerabilities
- Data consistency problems
- Duplicate request risks
- Missing idempotency
- Performance bottlenecks
- Excessive database calls
- Missing pagination
- Missing filtering or sorting
- Race conditions
- Logging gaps
- Audit-log gaps
- Sensitive-data exposure
- Incorrect frontend/API integration

---

## Review Process

### 1. Discover API Surface

Inspect the project and identify:

- API routes
- Server actions
- Controllers
- Route handlers
- Middleware
- Database calls
- Authentication logic
- Authorization logic
- Validation schemas
- External API integrations

Build a temporary internal map:

`Method → Endpoint → Purpose → Auth → Input → Output`

Do not create documentation files unless requested.

---

### 2. Validate Each Endpoint

For every API endpoint check:

#### HTTP

- Correct HTTP method
- Correct route naming
- Appropriate HTTP status code
- Consistent JSON response format
- Correct headers where necessary

Examples:

- `200` successful read/update
- `201` successful creation
- `204` successful delete with no body
- `400` invalid request
- `401` unauthenticated
- `403` unauthorized
- `404` resource missing
- `409` conflict
- `422` validation failure where appropriate
- `429` rate limited
- `500` unexpected server failure

---

### 3. Input Validation

Check all user-controlled inputs.

Verify:

- Required fields
- Data types
- String length
- Number ranges
- Enum values
- Email format
- Phone format
- Date validity
- IDs
- Query parameters
- Route parameters
- Request bodies

Prefer schema validation where available:

- Zod
- Joi
- Yup
- JSON Schema

Do not rely only on frontend validation.

---

### 4. Authentication

Check whether protected APIs correctly verify identity.

Look for:

- Missing authentication
- Client-controlled user IDs
- Expired token handling
- Session validation
- Token verification
- Authentication bypasses

Never trust identity information sent directly by the frontend if it can instead be derived from the authenticated session/token.

---

### 5. Authorization

Authentication alone is not enough.

Check whether users can access or modify resources belonging to other users.

Validate:

- Ownership
- Roles
- Permissions
- Tenant boundaries
- Admin-only actions
- Hospital/user/admin boundaries
- Organization boundaries

Look specifically for IDOR/BOLA vulnerabilities.

Example:

Bad:

`GET /api/users/:userId`

where any logged-in user can change `userId`.

Prefer server-side ownership validation.

---

### 6. Security

Check for:

- SQL injection
- NoSQL injection
- Command injection
- XSS through stored API content
- SSRF
- Path traversal
- Unsafe file uploads
- Secret leakage
- Environment variables exposed to client
- Weak CORS configuration
- Missing rate limits
- Missing CSRF protection where relevant
- Sensitive data in logs
- Sensitive data in API responses

Never expose:

- Passwords
- Password hashes
- Private API keys
- Service-role keys
- Session secrets
- Internal stack traces

---

### 7. Database Safety

Check:

- Duplicate records
- Missing unique constraints
- Missing indexes
- Race conditions
- Partial writes
- Incorrect cascading deletes
- Unbounded database queries
- N+1 queries
- Missing transactions

For multi-step writes, recommend transactions when partial completion could corrupt data.

---

### 8. Data Integrity

Check business rules.

Examples:

- Duplicate bookings
- Duplicate invoices
- Duplicate users
- Invalid status transitions
- Negative amounts
- Invalid dates
- Foreign-key mismatches
- Orphan records
- Impossible state combinations

Validate critical rules on the server.

---

### 9. Pagination

Any API returning potentially large collections should be reviewed for pagination.

Check:

- `limit`
- `page`
- cursor pagination
- maximum page size
- default page size

Flag endpoints returning unlimited database results.

---

### 10. Search, Filter and Sorting

Check whether collection APIs support appropriate:

- Filtering
- Sorting
- Search
- Pagination

Validate query parameters before passing them to the database.

Do not allow arbitrary fields to become raw database queries.

---

### 11. Error Handling

Check that APIs do not silently fail.

Responses should provide:

- Appropriate status code
- Stable error structure
- Safe user-facing message
- Internal logging where necessary

Recommended format:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Resource not found"
  }
}
```

Do not return raw stack traces to clients.

---

### 12. API Response Consistency

Check whether the project uses inconsistent formats such as:

```json
{ "data": {} }
```

in one API and:

```json
{ "result": {} }
```

elsewhere.

Prefer a consistent response contract.

Example:

```json
{
  "success": true,
  "data": {}
}
```

---

### 13. Duplicate Requests and Idempotency

Check critical operations including:

- Payments
- Bookings
- Invoice creation
- Order creation
- Account creation
- Webhooks

Verify repeated requests cannot create duplicate operations.

Recommend idempotency keys when appropriate.

---

### 14. External APIs

Inspect integrations for:

- Timeouts
- Retry strategy
- Error handling
- Authentication
- API key exposure
- Rate-limit handling
- Invalid response handling

Never assume external services always return successfully.

---

### 15. Webhooks

Check:

- Signature verification
- Replay protection
- Duplicate event handling
- Idempotency
- Unknown event handling
- Safe retries

Webhook requests must not be trusted only because they hit the webhook URL.

---

### 16. Performance

Look for:

- Sequential requests that could safely run concurrently
- Repeated database calls
- N+1 queries
- Large payloads
- Unnecessary joins
- Unbounded loops
- Expensive work inside request handlers

Do not recommend optimization unless there is a meaningful reason.

---

### 17. Frontend ↔ API Contract

If frontend code exists, compare it against backend APIs.

Check:

- Endpoint URLs
- HTTP methods
- Request payloads
- Response types
- Error handling
- Optional vs required fields
- Enum mismatches
- Null handling

Flag API contract drift.

---

## Multi-Step Workflow Review

For flows such as:

`Create → Review → Approve → Pay → Complete`

verify every transition.

Check:

- Can steps be skipped?
- Can the user navigate backward safely?
- Can duplicate submissions happen?
- What happens after refresh?
- What happens after network failure?
- Are partial states stored correctly?
- Can users perform invalid status transitions?
- Are abandoned processes recoverable?

---

## Output Format

Return findings in this format:

### Critical

Issues that may cause:

- Security breach
- Unauthorized access
- Data loss
- Payment errors
- Serious data corruption

### High

Issues likely to cause broken workflows or major production problems.

### Medium

Important reliability, validation or maintainability gaps.

### Low

Smaller improvements or consistency issues.

For every finding provide:

**Location**

File, route or function.

**Issue**

What is wrong.

**Impact**

What can happen.

**Recommendation**

How to fix it.

**Example fix**

Include code only when useful.

---

## Summary Table

Finish with:

| Priority | Area | Issue | Recommendation |
|---|---|---|---|
| Critical | Authorization | Missing ownership check | Validate ownership server-side |
| High | Validation | Request body unvalidated | Add Zod schema |
| Medium | Performance | Unlimited query | Add pagination |

---

## Rules

- Do not make code changes unless requested.
- Do not run `npm run build`, lint, tests or full-project scans automatically unless necessary or requested.
- Prefer targeted inspection first.
- Do not report speculative issues as confirmed bugs.
- Distinguish:
  - Confirmed issue
  - Potential risk
  - Improvement
- Reference exact files and line numbers when possible.
- Avoid rewriting working architecture without a clear reason.
- Prefer minimal safe fixes.
- Preserve the project's existing patterns unless they are the source of the problem.

## Invocation Examples

Use this skill for prompts such as:

`Audit all APIs in this project.`

`Check API gaps.`

`Review authentication and authorization.`

`Audit this booking API.`

`Check frontend and backend API mismatches.`

`Review APIs before production deployment.`

`Check this API for security, validation and data-integrity problems.`
