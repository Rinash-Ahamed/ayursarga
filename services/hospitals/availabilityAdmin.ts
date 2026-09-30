import "server-only";

import { FieldValue, Timestamp, type DocumentReference, type Firestore } from "firebase-admin/firestore";

type StoredRange = { availabilityId: string; startDate: Timestamp; endDate: Timestamp };

export class AvailabilityOperationError extends Error {
  constructor(message: string, public readonly status: 404 | 409) {
    super(message);
    this.name = "AvailabilityOperationError";
  }
}

function device(request: Request) {
  return {
    userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
    platform: null,
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
  };
}

function indiaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function dateKeyAsUtc(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function activeRanges(value: unknown) {
  if (!Array.isArray(value)) return [] as StoredRange[];
  const todayKey = indiaDateKey(new Date());
  return value.filter((range): range is StoredRange => Boolean(
    range && typeof range === "object"
    && typeof (range as StoredRange).availabilityId === "string"
    && (range as StoredRange).startDate instanceof Timestamp
    && (range as StoredRange).endDate instanceof Timestamp
    && indiaDateKey((range as StoredRange).endDate.toDate()) >= todayKey,
  ));
}

function validateRange(startDate: Date, endDate: Date) {
  const todayKey = indiaDateKey(new Date());
  const startKey = indiaDateKey(startDate);
  const endKey = indiaDateKey(endDate);
  const maximumEnd = dateKeyAsUtc(startKey);
  maximumEnd.setUTCFullYear(maximumEnd.getUTCFullYear() + 1);
  const maximumEndKey = maximumEnd.toISOString().slice(0, 10);
  if (startKey < todayKey || endKey < startKey || endKey > maximumEndKey) {
    throw new AvailabilityOperationError("Choose a date range from today onwards and no longer than one year.", 409);
  }
}

export async function createAdminBlock(input: {
  firestore: Firestore;
  adminUid: string;
  hospitalId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  request: Request;
}) {
  validateRange(input.startDate, input.endDate);
  const availabilityReference = input.firestore.collection("availability").doc();
  await writeBlock({
    ...input,
    availabilityReference,
    source: "admin_call",
    requirePendingRequest: false,
  });
}

export async function approveAvailabilityRequest(input: {
  firestore: Firestore;
  adminUid: string;
  availabilityReference: DocumentReference;
  availability: FirebaseFirestore.DocumentData;
  request: Request;
}) {
  if (!(input.availability.startDate instanceof Timestamp) || !(input.availability.endDate instanceof Timestamp)) {
    throw new Error("The requested dates are invalid.");
  }
  validateRange(input.availability.startDate.toDate(), input.availability.endDate.toDate());
  await writeBlock({
    firestore: input.firestore,
    adminUid: input.adminUid,
    hospitalId: String(input.availability.hospitalId),
    availabilityReference: input.availabilityReference,
    startDate: input.availability.startDate.toDate(),
    endDate: input.availability.endDate.toDate(),
    reason: String(input.availability.reason ?? "Availability requested by hospital"),
    source: "hospital_portal",
    requirePendingRequest: true,
    request: input.request,
  });
}

async function writeBlock(input: {
  firestore: Firestore;
  adminUid: string;
  hospitalId: string;
  availabilityReference: DocumentReference;
  startDate: Date;
  endDate: Date;
  reason: string;
  source: "hospital_portal" | "admin_call";
  requirePendingRequest: boolean;
  request: Request;
}) {
  const hospitalReference = input.firestore.collection("hospitals").doc(input.hospitalId);
  const availabilityAudit = input.firestore.collection("auditLogs").doc();
  const hospitalAudit = input.firestore.collection("auditLogs").doc();
  await input.firestore.runTransaction(async (transaction) => {
    const hospitalSnapshot = await transaction.get(hospitalReference);
    const availabilitySnapshot = await transaction.get(input.availabilityReference);
    const hospital = hospitalSnapshot.data();
    const previousAvailability = availabilitySnapshot.data() ?? null;
    if (!hospitalSnapshot.exists || !hospital || hospital.status === "archived") throw new AvailabilityOperationError("The selected hospital is unavailable.", 404);
    if (input.requirePendingRequest && (!availabilitySnapshot.exists || previousAvailability?.status !== "pending")) {
      throw new AvailabilityOperationError("Only a pending availability request can be approved.", 409);
    }
    if (!input.requirePendingRequest && availabilitySnapshot.exists) throw new AvailabilityOperationError("This availability block already exists.", 409);

    const ranges = activeRanges(hospital.blockedDateRanges);
    if (ranges.length >= 20) throw new AvailabilityOperationError("This hospital already has 20 upcoming availability blocks. Remove or complete an existing block first.", 409);
    const now = FieldValue.serverTimestamp();
    const startDate = Timestamp.fromDate(input.startDate);
    const endDate = Timestamp.fromDate(input.endDate);
    const updatedRanges = [...ranges, { availabilityId: input.availabilityReference.id, startDate, endDate }];
    const availabilityData = {
      ...(previousAvailability ?? {}),
      hospitalId: input.hospitalId,
      hospitalName: String(previousAvailability?.hospitalName ?? hospital.name ?? "Hospital"),
      startDate,
      endDate,
      reason: input.reason,
      source: input.source,
      status: "blocked",
      reviewedAt: now,
      reviewedBy: input.adminUid,
      createdAt: previousAvailability?.createdAt ?? now,
      createdBy: previousAvailability?.createdBy ?? input.adminUid,
      updatedAt: now,
      updatedBy: input.adminUid,
      archivedAt: null,
      archivedBy: null,
      lastAuditId: availabilityAudit.id,
    };
    const hospitalChanges = { blockedDateRanges: updatedRanges, updatedAt: now, updatedBy: input.adminUid, lastAuditId: hospitalAudit.id };
    transaction.set(input.availabilityReference, availabilityData);
    transaction.set(availabilityAudit, {
      action: previousAvailability ? "status_change" : "create", module: "availability", recordId: input.availabilityReference.id,
      actorId: input.adminUid, actorRole: "admin", previousValues: previousAvailability, updatedValues: availabilityData,
      timestamp: now, source: "server", device: device(input.request),
    });
    transaction.update(hospitalReference, hospitalChanges);
    transaction.set(hospitalAudit, {
      action: "update", module: "hospitals", recordId: input.hospitalId,
      actorId: input.adminUid, actorRole: "admin", previousValues: hospital, updatedValues: { ...hospital, ...hospitalChanges },
      timestamp: now, source: "server", device: device(input.request),
    });
  });
}

export async function closeAvailability(input: {
  firestore: Firestore;
  adminUid: string;
  availabilityReference: DocumentReference;
  availability: FirebaseFirestore.DocumentData;
  nextStatus: "rejected" | "cancelled";
  request: Request;
}) {
  const availabilityAudit = input.firestore.collection("auditLogs").doc();
  await input.firestore.runTransaction(async (transaction) => {
    const availabilitySnapshot = await transaction.get(input.availabilityReference);
    const availability = availabilitySnapshot.data();
    if (!availabilitySnapshot.exists || !availability) throw new AvailabilityOperationError("The availability request could not be found.", 404);
    const expectedStatus = input.nextStatus === "rejected" ? "pending" : "blocked";
    if (availability.status !== expectedStatus) throw new AvailabilityOperationError(`Only a ${expectedStatus} availability record can be updated this way.`, 409);
    const hospitalReference = availability.status === "blocked"
      ? input.firestore.collection("hospitals").doc(String(availability.hospitalId))
      : null;
    const hospitalSnapshot = hospitalReference ? await transaction.get(hospitalReference) : null;
    const hospital = hospitalSnapshot?.data();

    const now = FieldValue.serverTimestamp();
    const availabilityChanges = {
      status: input.nextStatus,
      reviewedAt: now,
      reviewedBy: input.adminUid,
      updatedAt: now,
      updatedBy: input.adminUid,
      lastAuditId: availabilityAudit.id,
    };
    transaction.update(input.availabilityReference, availabilityChanges);
    transaction.set(availabilityAudit, {
      action: "status_change", module: "availability", recordId: input.availabilityReference.id,
      actorId: input.adminUid, actorRole: "admin", previousValues: availability, updatedValues: { ...availability, ...availabilityChanges },
      timestamp: now, source: "server", device: device(input.request),
    });

    if (hospitalReference && hospitalSnapshot?.exists && hospital) {
        const hospitalAudit = input.firestore.collection("auditLogs").doc();
        const ranges = activeRanges(hospital.blockedDateRanges).filter((range) => range.availabilityId !== input.availabilityReference.id);
        const hospitalChanges = { blockedDateRanges: ranges, updatedAt: now, updatedBy: input.adminUid, lastAuditId: hospitalAudit.id };
        transaction.update(hospitalReference, hospitalChanges);
        transaction.set(hospitalAudit, {
          action: "update", module: "hospitals", recordId: hospitalReference.id,
          actorId: input.adminUid, actorRole: "admin", previousValues: hospital, updatedValues: { ...hospital, ...hospitalChanges },
          timestamp: now, source: "server", device: device(input.request),
        });
    }
  });
}
