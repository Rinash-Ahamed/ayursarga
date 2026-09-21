# Firestore data protection and audit architecture

## Collection boundaries

The application keeps the existing top-level `services` collection to preserve
working routes, queries, and indexes. Relationships use stable IDs rather than
duplicating records or introducing deeply nested documents.

- `users`: authentication profile and role. Consumer name, Google email, phone,
  and optional address live here under `role: "consumer"`; a duplicate
  `consumers` collection is intentionally not created.
- `hospitals`: hospital profile, visibility, status, commission settings, and
  owner WhatsApp contact in the legacy `phone` field. The public interface uses
  the required `hospitalPhone1` and optional `hospitalPhone2`; `district` stores the
  selected Kerala district. Existing records remain readable until these newer
  fields are completed through the profile form. The collection also stores
  up to four Google Drive sharing links or externally hosted HTTPS image URLs
  normalized into `imageUrls`. Hospitals must make Drive images viewable by
  anyone with the link. Gallery images use a consistent 4:3 presentation. The
  legacy nullable `imageUrl` remains readable for existing records. Firebase
  Storage and direct image uploads are intentionally not enabled in this phase.
  Hospital images and the centre map location are maintained by Admin users;
  Hospital accounts cannot modify those fields.
  Optional `ayursargaRating` and `ayursargaReviewNote` fields contain clearly
  labelled Admin-authored editorial content for active public hospitals; they
  are not patient-review data.
- `consultants`: Admin-managed Ayursarga consultant directory with sequential
  employee IDs, contact and professional details, and Active/Inactive status.
  It is not an authentication collection and is inaccessible to Hospital,
  Consumer, and public clients. Creates and updates are audit linked.
- `hospitalCapacity`: internal treatment-room totals and current occupancy,
  readable and editable only by Admin and the assigned Hospital. Both protected
  interfaces update the same audited document.
- `hospitalStaff`: future hospital-to-user staff assignments.
- `doctors`: future hospital doctor profiles.
- `services`: Hospital-created care packages linked by `hospitalId`. New
  packages store `packageDurationDays`, a keyed `procedures` map containing the
  number of included days, and optional Other-procedure details. Keyed
  procedures prevent duplicates within one package while allowing reuse across
  different packages. Legacy price/duration fields remain readable only until
  an old service is converted through the audited package editor.
- `availability`: future doctor/service availability linked by IDs.
- `bookings`: Consumer, Hospital, and service references plus immutable price,
  commission, Consumer contact snapshots, and treatment progress. Only Admin,
  the Consumer owner, and the assigned Hospital can read the booking.
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
generation fields, two signed-contract URLs with their respective signing actor
and timestamp fields, and activation actor and timestamp fields. Rules require
a Pending hospital and both confirmed signed contracts before allowing the
Active/Public transition.

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
