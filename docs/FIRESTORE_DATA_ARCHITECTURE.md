# Firestore data protection and audit architecture

## Collection boundaries

The application keeps the existing top-level `services` collection to preserve
working routes, queries, and indexes. Relationships use stable IDs rather than
duplicating records or introducing deeply nested documents.

- `users`: authentication profile and role. Consumer name, Google email, phone,
  and optional address live here under `role: "consumer"`; a duplicate
  `consumers` collection is intentionally not created.
- `hospitals`: hospital profile, visibility, status, and commission settings.
- `hospitalCapacity`: internal treatment-room totals and current occupancy,
  readable only by Admin and the assigned Hospital.
- `hospitalStaff`: future hospital-to-user staff assignments.
- `doctors`: future hospital doctor profiles.
- `services`: hospital services linked by `hospitalId`.
- `availability`: future doctor/service availability linked by IDs.
- `bookings`: Consumer, Hospital, and service references plus immutable price,
  commission, Consumer contact snapshots, treatment progress, and an optional
  verified rating. Only Admin, the Consumer owner, and the assigned Hospital
  can read the booking.
- `payments`: future provider transaction references; no payment workflow is
  implemented yet.
- `notifications`: future user notifications.
- `auditLogs`: centralized activity history, append-only through the client SDK
  and visible only to active Admin users.
- `systemSettings`: future platform configuration.

Reserved future collections are denied by default until their services and
field-level rules are implemented.

## Preservation policy

Client-side permanent deletion is denied for every collection. Current critical
records use archive metadata and retain their original document ID:

```text
createdAt, createdBy
updatedAt, updatedBy
archivedAt, archivedBy
lastAuditId
```

Hospitals, services, and users use `status: "archived"`. Booking workflow status
remains separate, so bookings use `archivedAt` and `archivedBy`. Normal list
helpers omit archived records while preserving cursor-limited reads.

## Audit policy

Critical browser mutations write the record and its audit entry in one atomic
Firestore batch. Each record points to the associated entry through
`lastAuditId`. Rules require the linked audit for supported creates and updates.
Audit entries contain action, module, record ID, authenticated actor and role,
previous values, changed values, server timestamp, and available device data.

Hospital approval also records `contract_generated`, `contract_signed`, and
`hospital_activated` actions. Hospital documents retain `contractStatus`,
generation/signing actor and timestamp fields, and activation actor and
timestamp fields. Rules require a Pending hospital and a confirmed signed
contract before allowing the Active/Public transition.

Audit logs are readable only by active Admins and cannot be updated or deleted
through client rules. The platform owner has approved one narrow exception:
the Admin audit page may permanently clear this collection through a server
endpoint that verifies the caller's Firebase ID token and active Admin profile.
Hospital and Consumer users cannot call or see this control. Client code
deliberately stores `ipAddress: null`: a
browser cannot provide a trustworthy source IP. Verified server endpoints may
record forwarded IP and user-agent data when available.

Admin SDK operations bypass Firestore Security Rules by design. Every controlled
Admin SDK script must therefore preserve records and create a server-sourced
audit entry in the same batch, except for the explicitly approved audit-log
clearing endpoint. That exception must never be reused for operational data.
