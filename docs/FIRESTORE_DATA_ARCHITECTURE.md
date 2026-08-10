# Firestore data protection and audit architecture

## Collection boundaries

The application keeps the existing top-level `services` collection to preserve
working routes, queries, and indexes. Relationships use stable IDs rather than
duplicating records or introducing deeply nested documents.

- `users`: authentication profile and role. Consumer name, Google email, phone,
  and contact address live here under `role: "consumer"`; a duplicate
  `consumers` collection is intentionally not created.
- `hospitals`: hospital profile, visibility, status, and commission settings.
- `hospitalStaff`: future hospital-to-user staff assignments.
- `doctors`: future hospital doctor profiles.
- `services`: hospital services linked by `hospitalId`.
- `availability`: future doctor/service availability linked by IDs.
- `bookings`: Consumer, Hospital, and service references plus immutable price,
  commission, and Consumer contact snapshots. Only Admin, the Consumer owner,
  and the assigned Hospital can read the booking.
- `payments`: future provider transaction references; no payment workflow is
  implemented yet.
- `notifications`: future user notifications.
- `auditLogs`: centralized append-only activity history.
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

Audit logs are readable only by active admins and cannot be updated or deleted
through client rules. Client code deliberately stores `ipAddress: null`: a
browser cannot provide a trustworthy source IP. Trusted IP enrichment and
backend-guaranteed logs for out-of-band Admin SDK operations require a future
server/Cloud Function phase.

Admin SDK operations bypass Firestore Security Rules by design. Every controlled
Admin SDK script must therefore preserve records and create a server-sourced
audit entry in the same batch.
